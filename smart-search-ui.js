'use strict';

(() => {
  if (window.__dozaksUnifiedSearchLoaded) return;
  window.__dozaksUnifiedSearchLoaded = true;
  window.__dozaksSmartSearchLoaded = true;

  const INDEX_API = '/api/search-index';
  const MAX_DRUG_RESULTS = 6;
  const MAX_PRODUCT_RESULTS = 12;
  const MAX_CLINICAL_RESULTS = 4;

  const state = {
    ready: false,
    loading: false,
    error: null,
    products: [],
    drugs: [],
    drugMap: new Map(),
    count: 0,
    version: '',
    timer: null,
    sequence: 0,
    highlighted: -1,
    lastResults: [],
    searchCache: new Map(),
    filters: {
      form: '',
      atc: '',
      strength: '',
      status: '',
      manufacturer: '',
      authorizationHolder: '',
    },
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const input = () => $('#searchInput');
  const box = () => $('#suggestions');

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);

  function normalize(value = '') {
    return String(value)
      .toLocaleLowerCase('sq')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9%µ+./-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const FORM_RULES = [
    [/\b(tablet|tableta|tablete|tbl|filmtablet|filmtabletten)\b/i, 'tablet'],
    [/\b(capsule|capsules|kapsul|kapsula|kapsule)\b/i, 'capsule'],
    [/\b(iv|intravenoz|intravenous|infuzion|infusion)\b/i, 'injection'],
    [/\b(im|intramuskular|intramuscular)\b/i, 'injection'],
    [/\b(injeksion|injection|injectable|ampul|ampoule|vial)\b/i, 'injection'],
    [/\b(suspension|suspens|susp)\b/i, 'suspension'],
    [/\b(syrup|shurup)\b/i, 'syrup'],
    [/\b(cream|krem)\b/i, 'cream'],
    [/\b(ointment|unguent|ungvent)\b/i, 'ointment'],
    [/\b(gel)\b/i, 'gel'],
    [/\b(inhaler|inhalim|inhalation|nebulizim|nebulizer)\b/i, 'inhal'],
    [/\b(drop|drops|pika)\b/i, 'drop'],
    [/\b(suppository|suppositor|supozitor)\b/i, 'suppository'],
    [/\b(spray|sprej)\b/i, 'spray'],
    [/\b(powder|pluhur)\b/i, 'powder'],
    [/\b(solution|solucion|tretje)\b/i, 'solution'],
  ];

  const FORM_MATCHERS = {
    tablet: ['tablet', 'tablete', 'tbl', 'film coated', 'gastro resistant', 'chewable'],
    capsule: ['capsule', 'kapsul'],
    injection: ['inject', 'injection', 'infusion', 'ampoul', 'ampule', 'vial', 'intraven', 'intramus'],
    suspension: ['suspension'],
    syrup: ['syrup', 'shurup'],
    cream: ['cream', 'krem'],
    ointment: ['ointment', 'unguent'],
    gel: ['gel'],
    inhal: ['inhal', 'nebul'],
    drop: ['drop', 'pika'],
    suppository: ['suppository', 'supozitor'],
    spray: ['spray', 'sprej'],
    powder: ['powder', 'pluhur'],
    solution: ['solution', 'solucion'],
  };

  function parse(raw) {
    let term = String(raw || '').trim();
    let atc = '';
    let form = '';
    let strength = '';

    const atcMatch = term.match(/\b([a-z]\d{2}[a-z]{0,2}\d{0,2})\b/i);
    if (atcMatch) {
      atc = atcMatch[1].toUpperCase();
      term = term.replace(atcMatch[0], ' ');
    }

    const strengthMatch = term.match(/\b\d+(?:[.,]\d+)?\s*(?:mcg|µg|ug|mg|g|ml|iu|%)\b/i);
    if (strengthMatch) {
      strength = strengthMatch[0].replace(',', '.');
      term = term.replace(strengthMatch[0], ' ');
    }

    for (const [pattern, value] of FORM_RULES) {
      const match = term.match(pattern);
      if (match) {
        form = value;
        term = term.replace(match[0], ' ');
        break;
      }
    }

    return {
      term: term.replace(/[,+;|]+/g, ' ').replace(/\s+/g, ' ').trim(),
      atc,
      form,
      strength,
    };
  }

  function effective(raw) {
    const parsed = parse(raw);
    return {
      term: parsed.term,
      atc: state.filters.atc || parsed.atc,
      form: state.filters.form || parsed.form,
      strength: state.filters.strength || parsed.strength,
      status: state.filters.status,
      manufacturer: state.filters.manufacturer,
      authorizationHolder: state.filters.authorizationHolder,
    };
  }

  function typeFilter() {
    return $('#filters button.active')?.dataset.filter || 'all';
  }

  function useful(query) {
    return normalize(query.term).length >= 2
      || Object.entries(query).some(([key, value]) => key !== 'term' && Boolean(value));
  }

  function formMatches(productForm, requestedForm) {
    if (!requestedForm) return true;
    const normalizedForm = normalize(productForm);
    const aliases = FORM_MATCHERS[requestedForm] || [requestedForm];
    return aliases.some((alias) => normalizedForm.includes(normalize(alias)));
  }

  function normalizeProduct(row) {
    const [
      id, drugId, tradeName, genericName, activeSubstance, atcCode, strength, form,
      status, retailPrice, pdid, protocolNo, manufacturer, authorizationHolder,
    ] = row;

    const product = {
      id: String(id || ''),
      drug_id: String(drugId || ''),
      trade_name: String(tradeName || ''),
      generic_name: String(genericName || ''),
      active_substance: String(activeSubstance || ''),
      atc_code: String(atcCode || ''),
      strength_text: String(strength || ''),
      pharmaceutical_form: String(form || ''),
      product_status: String(status || ''),
      retail_price: retailPrice == null ? null : Number(retailPrice),
      pdid: String(pdid || ''),
      protocol_no: String(protocolNo || ''),
      manufacturer: String(manufacturer || ''),
      marketing_authorization_holder: String(authorizationHolder || ''),
    };

    product._trade = normalize(product.trade_name);
    product._generic = normalize(product.generic_name);
    product._active = normalize(product.active_substance);
    product._atc = normalize(product.atc_code);
    product._strength = normalize(product.strength_text);
    product._form = normalize(product.pharmaceutical_form);
    product._status = normalize(product.product_status);
    product._manufacturer = normalize(product.manufacturer);
    product._holder = normalize(product.marketing_authorization_holder);
    product._pdid = normalize(product.pdid);
    product._protocol = normalize(product.protocol_no);
    product._search = [
      product._trade,
      product._generic,
      product._active,
      product._atc,
      product._strength,
      product._form,
      product._status,
      product._manufacturer,
      product._holder,
      product._pdid,
      product._protocol,
    ].filter(Boolean).join(' ');

    return product;
  }

  function buildDrugIndex(products) {
    const groups = new Map();

    products.forEach((product) => {
      const id = product.drug_id || `${product._generic}|${product._atc}`;
      if (!groups.has(id)) {
        groups.set(id, {
          id,
          generic_name: product.generic_name || product.active_substance || product.trade_name,
          atc_code: product.atc_code,
          product_count: 0,
          pharmaceutical_forms: [],
          strengths: [],
          _products: [],
        });
      }

      const group = groups.get(id);
      group.product_count += 1;
      group._products.push(product);
      if (product.pharmaceutical_form && !group.pharmaceutical_forms.includes(product.pharmaceutical_form)) {
        group.pharmaceutical_forms.push(product.pharmaceutical_form);
      }
      if (product.strength_text && !group.strengths.includes(product.strength_text)) {
        group.strengths.push(product.strength_text);
      }
    });

    return [...groups.values()].map((group) => ({
      ...group,
      _generic: normalize(group.generic_name),
      _atc: normalize(group.atc_code),
      _search: normalize(`${group.generic_name} ${group.atc_code} ${group.pharmaceutical_forms.join(' ')} ${group.strengths.join(' ')}`),
    }));
  }

  function setStatus(stateName, message) {
    const element = $('#smartDbStatus');
    if (!element) return;
    element.dataset.state = stateName;
    element.innerHTML = `<i></i><span>${esc(message)}</span>`;
  }

  async function loadIndex(force = false) {
    if (state.ready && !force) return true;
    if (state.loading) return false;

    state.loading = true;
    state.error = null;
    setStatus('loading', 'Po ngarkohet katalogu lokal nga Neon…');

    try {
      const response = await fetch(INDEX_API, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        cache: force ? 'reload' : 'default',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.products)) {
        throw new Error(data.error || `API ${response.status}`);
      }

      state.products = data.products.map(normalizeProduct);
      state.drugs = buildDrugIndex(state.products);
      state.drugMap = new Map(state.drugs.map((drug) => [drug.id, drug]));
      state.count = Number(data.count || state.products.length);
      state.version = String(data.version || data.versionLabel || 'current');
      state.ready = true;
      state.searchCache.clear();
      populateFacets();
      setStatus('ready', `Katalogu lokal aktiv · ${state.count.toLocaleString('sq-AL')} produkte`);
      window.dispatchEvent(new CustomEvent('dozaks:local-search-ready', {
        detail: { count: state.count, version: state.version },
      }));
      return true;
    } catch (error) {
      state.error = error;
      state.ready = false;
      setStatus('error', `Katalogu lokal nuk u ngarkua: ${error.message}`);
      return false;
    } finally {
      state.loading = false;
    }
  }

  function filterProduct(product, query) {
    if (query.atc && !product._atc.startsWith(normalize(query.atc))) return false;
    if (query.form && !formMatches(product.pharmaceutical_form, query.form)) return false;
    if (query.strength && !product._strength.includes(normalize(query.strength))) return false;
    if (query.status && product._status !== normalize(query.status)) return false;
    if (query.manufacturer && !product._manufacturer.includes(normalize(query.manufacturer))) return false;
    if (query.authorizationHolder && !product._holder.includes(normalize(query.authorizationHolder))) return false;
    return true;
  }

  function directScore(product, normalizedQuery, tokens) {
    if (!normalizedQuery) return 100;

    if (product._trade === normalizedQuery) return 1300;
    if (product._generic === normalizedQuery) return 1260;
    if (product._active === normalizedQuery) return 1230;
    if (product._atc === normalizedQuery) return 1210;
    if (product._pdid === normalizedQuery || product._protocol === normalizedQuery) return 1190;

    if (product._trade.startsWith(normalizedQuery)) return 1050;
    if (product._generic.startsWith(normalizedQuery)) return 1010;
    if (product._active.startsWith(normalizedQuery)) return 980;
    if (product._atc.startsWith(normalizedQuery)) return 950;

    if (product._trade.includes(normalizedQuery)) return 820;
    if (product._generic.includes(normalizedQuery)) return 790;
    if (product._active.includes(normalizedQuery)) return 760;
    if (product._atc.includes(normalizedQuery)) return 730;
    if (product._search.includes(normalizedQuery)) return 650;

    if (tokens.length && tokens.every((token) => product._search.includes(token))) {
      const prefixBonus = tokens.reduce((total, token) => total
        + [product._trade, product._generic, product._active, product._atc]
          .some((field) => field.split(' ').some((part) => part.startsWith(token))) * 20, 0);
      return 520 + prefixBonus;
    }

    return 0;
  }

  function bigrams(value) {
    const text = ` ${normalize(value)} `;
    const result = [];
    for (let index = 0; index < text.length - 1; index += 1) result.push(text.slice(index, index + 2));
    return result;
  }

  function dice(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const left = bigrams(a);
    const right = bigrams(b);
    if (!left.length || !right.length) return 0;
    const counts = new Map();
    left.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
    let matches = 0;
    right.forEach((token) => {
      const count = counts.get(token) || 0;
      if (count > 0) {
        matches += 1;
        counts.set(token, count - 1);
      }
    });
    return (2 * matches) / (left.length + right.length);
  }

  function typoScore(product, normalizedQuery) {
    if (normalizedQuery.length < 4) return 0;
    const similarity = Math.max(
      dice(normalizedQuery, product._trade),
      dice(normalizedQuery, product._generic),
      dice(normalizedQuery, product._active),
    );
    return similarity >= 0.5 ? 300 + Math.round(similarity * 200) : 0;
  }

  function searchProducts(query) {
    const normalizedQuery = normalize(query.term);
    const tokens = normalizedQuery.split(' ').filter(Boolean);
    const direct = [];

    for (const product of state.products) {
      if (!filterProduct(product, query)) continue;
      const score = directScore(product, normalizedQuery, tokens);
      if (score > 0) direct.push({ product, score });
    }

    if (!direct.length && normalizedQuery.length >= 4) {
      for (const product of state.products) {
        if (!filterProduct(product, query)) continue;
        const score = typoScore(product, normalizedQuery);
        if (score > 0) direct.push({ product, score });
      }
    }

    direct.sort((left, right) => right.score - left.score
      || left.product.trade_name.localeCompare(right.product.trade_name, 'sq'));

    return direct;
  }

  function createDrugResults(scoredProducts, query) {
    const grouped = new Map();
    const normalizedQuery = normalize(query.term);

    scoredProducts.forEach(({ product, score }) => {
      const id = product.drug_id || `${product._generic}|${product._atc}`;
      const indexedDrug = state.drugMap.get(id);
      if (!indexedDrug) return;
      const existing = grouped.get(id);
      const drugScore = Math.max(
        score,
        indexedDrug._generic === normalizedQuery ? 1320 : 0,
        indexedDrug._generic.startsWith(normalizedQuery) ? 1060 : 0,
        indexedDrug._atc === normalizedQuery ? 1220 : 0,
      );
      if (!existing || drugScore > existing._score) grouped.set(id, { ...indexedDrug, _score: drugScore });
    });

    return [...grouped.values()]
      .sort((left, right) => right._score - left._score
        || right.product_count - left.product_count
        || left.generic_name.localeCompare(right.generic_name, 'sq'))
      .slice(0, MAX_DRUG_RESULTS);
  }

  function clinicalResults(raw, filter) {
    if (!['all', 'symptom', 'diagnosis', 'group'].includes(filter)) return [];
    if (typeof window.getResults !== 'function' || normalize(raw).length < 2) return [];
    try {
      return window.getResults(raw)
        .filter((item) => filter === 'all' || item.type === filter)
        .filter((item) => ['symptom', 'diagnosis', 'group'].includes(item.type))
        .slice(0, MAX_CLINICAL_RESULTS);
    } catch {
      return [];
    }
  }

  function cacheKey(query, filter) {
    return JSON.stringify([query, filter, state.version]);
  }

  function searchLocal(raw) {
    const startedAt = performance.now();
    const query = effective(raw);
    const filter = typeFilter();
    const key = cacheKey(query, filter);

    if (state.searchCache.has(key)) {
      return { ...state.searchCache.get(key), durationMs: 0, cached: true };
    }

    const scoredProducts = ['all', 'generic', 'brand', 'group'].includes(filter) && useful(query)
      ? searchProducts(query)
      : [];

    const productResults = ['all', 'brand'].includes(filter)
      ? scoredProducts.slice(0, MAX_PRODUCT_RESULTS).map(({ product }) => product)
      : [];

    const drugResults = ['all', 'generic', 'group'].includes(filter)
      ? createDrugResults(scoredProducts, query)
      : [];

    const clinical = clinicalResults(raw, filter);
    const result = {
      query,
      drugResults,
      productResults,
      clinicalResults: clinical,
      total: scoredProducts.length,
      durationMs: Number((performance.now() - startedAt).toFixed(1)),
      cached: false,
    };

    state.searchCache.set(key, result);
    if (state.searchCache.size > 150) state.searchCache.delete(state.searchCache.keys().next().value);

    window.dispatchEvent(new CustomEvent('dozaks:local-search-performance', {
      detail: {
        durationMs: result.durationMs,
        productCount: state.count,
        resultCount: result.total,
        queryLength: normalize(raw).length,
      },
    }));

    return result;
  }

  function classify(form = '') {
    const value = normalize(form);
    const tags = [];
    const add = (label, tone = '') => {
      if (!tags.some((tag) => tag.label === label)) tags.push({ label, tone });
    };
    if (value.includes('tablet')) add('TABLETË', 'oral');
    if (value.includes('capsul')) add('KAPSULË', 'oral');
    if (value.includes('suspension')) add('SUSPENSION', 'oral');
    if (value.includes('syrup')) add('SHURUP', 'oral');
    if (value.includes('inject') || value.includes('vial') || value.includes('ampoul')) add('INJEKSION', 'injection');
    if (value.includes('infusion')) add('INFUZION', 'route');
    if (value.includes('intraven') || /\biv\b/.test(value)) add('IV', 'route');
    if (value.includes('intramus') || /\bim\b/.test(value)) add('IM', 'route');
    if (value.includes('cream')) add('KREM');
    if (value.includes('gel')) add('GEL');
    if (value.includes('inhal') || value.includes('nebul')) add('INHALIM', 'route');
    if (value.includes('drop')) add('PIKA');
    if (value.includes('suppository')) add('SUPOZITOR');
    if (value.includes('spray')) add('SPREJ');
    return tags.slice(0, 3);
  }

  function tagsHTML(tags) {
    return tags.map((tag) => `<span class="smart-tag ${esc(tag.tone)}">${esc(tag.label)}</span>`).join('');
  }

  function rowDrug(row) {
    const forms = Array.isArray(row.pharmaceutical_forms) ? row.pharmaceutical_forms : [];
    const tags = forms.flatMap(classify)
      .filter((tag, index, all) => all.findIndex((item) => item.label === tag.label) === index)
      .slice(0, 3);
    return `<button class="smart-result" type="button" role="option" data-kosovo-drug="${esc(row.id)}"><span class="smart-main"><span class="smart-icon">BAR</span><span class="smart-copy"><strong>${esc(row.generic_name)}</strong><small>${esc([row.atc_code, `${row.product_count || 0} produkte`, forms.slice(0, 2).join(', ')].filter(Boolean).join(' · '))}</small>${tags.length ? `<span class="smart-tags">${tagsHTML(tags)}</span>` : ''}</span></span><span class="smart-side"><span class="smart-atc">${esc(row.atc_code || 'ATC')}</span><span class="smart-badge">Bar gjenerik</span></span></button>`;
  }

  function rowProduct(row) {
    const tags = classify(row.pharmaceutical_form);
    const price = Number.isFinite(row.retail_price)
      ? new Intl.NumberFormat('sq-AL', { style: 'currency', currency: 'EUR' }).format(row.retail_price)
      : '';
    return `<button class="smart-result" type="button" role="option" data-kosovo-product="${esc(row.id)}"><span class="smart-main"><span class="smart-icon product">KS</span><span class="smart-copy"><strong>${esc(row.trade_name || 'Produkt medicinal')}</strong><small>${esc([row.active_substance || row.generic_name, row.strength_text, row.pharmaceutical_form].filter(Boolean).join(' · '))}</small>${tags.length ? `<span class="smart-tags">${tagsHTML(tags)}</span>` : ''}</span></span><span class="smart-side"><span class="smart-atc">${esc(row.atc_code || 'ATC')}</span>${price ? `<span class="smart-price">${esc(price)}</span>` : ''}<span class="smart-badge product">${esc(row.product_status || 'Produkt')}</span></span></button>`;
  }

  function rowClinical(item) {
    return `<button type="button" role="option" class="smart-result clinical" data-result-id="${esc(item.id)}"><span class="smart-main"><span class="smart-icon clinical">${item.type === 'symptom' ? 'S' : item.type === 'diagnosis' ? 'D' : 'G'}</span><span class="smart-copy"><strong>${esc(item.name)}</strong><small>${esc(item.group || item.summary || '')}</small></span></span><span class="smart-side"><span class="smart-badge clinical">${esc(item.typeLabel || 'Klinike')}</span></span></button>`;
  }

  function renderResult(result, raw) {
    const container = box();
    if (!container || input()?.value !== raw) return;

    container.innerHTML = '';
    state.highlighted = -1;
    $('#clearSearch')?.classList.toggle('visible', Boolean(raw));

    if (!raw.trim() && !Object.values(state.filters).some(Boolean)) {
      container.classList.remove('open');
      return;
    }

    const section = document.createElement('section');
    section.className = 'smart-search-section';
    const visibleCount = result.drugResults.length + result.productResults.length + result.clinicalResults.length;
    const totalLabel = result.total > visibleCount ? `${visibleCount} nga ${result.total}` : String(visibleCount);
    const speed = result.cached ? 'cache' : `${result.durationMs} ms`;

    section.innerHTML = `
      <div class="smart-search-heading">
        <span>LOKAL · KATALOGU ZYRTAR</span>
        <small>${esc(`${state.count.toLocaleString('sq-AL')} produkte · ${totalLabel} rezultate · ${speed}`)}</small>
      </div>
      ${result.drugResults.length ? `<div class="smart-group">BARNAT GJENERIKE</div>${result.drugResults.map(rowDrug).join('')}` : ''}
      ${result.productResults.length ? `<div class="smart-group">PRODUKTET TREGTARE</div>${result.productResults.map(rowProduct).join('')}` : ''}
      ${result.clinicalResults.length ? `<div class="smart-group">SIMPTOMA, DIAGNOZA & GRUPE</div>${result.clinicalResults.map(rowClinical).join('')}` : ''}
      ${visibleCount === 0 ? '<div class="smart-state"><strong>Nuk u gjet rezultat.</strong> Shkurto emrin, provo ATC-në ose pastro një filtër.</div>' : ''}
    `;

    container.appendChild(section);
    container.classList.add('open');
    state.lastResults = $$('.smart-result', section);
  }

  function renderLoading(raw) {
    const container = box();
    if (!container) return;
    container.innerHTML = `<section class="smart-search-section"><div class="smart-search-heading"><span>KATALOGU LOKAL</span><small>Ngarkohet vetëm një herë</small></div><div class="smart-state"><strong>Duke përgatitur 4,006 barnat…</strong> Pas ngarkimit, kërkimi bëhet pa request për çdo shkronjë.</div></section>`;
    container.classList.add('open');
    $('#clearSearch')?.classList.toggle('visible', Boolean(raw));
  }

  async function runSearch(forceLoad = false) {
    const raw = input()?.value || '';
    const sequence = ++state.sequence;

    if (!state.ready) {
      renderLoading(raw);
      const loaded = await loadIndex(forceLoad);
      if (!loaded || sequence !== state.sequence) return;
    }

    const result = searchLocal(raw);
    if (sequence !== state.sequence || input()?.value !== raw) return;
    renderResult(result, raw);
    setStatus('ready', `Katalogu lokal aktiv · ${state.count.toLocaleString('sq-AL')} produkte · ${result.durationMs} ms`);
  }

  function schedule(delay = 0) {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => runSearch(false), delay);
  }

  function moveHighlight(direction) {
    const buttons = $$('.smart-result', box());
    if (!buttons.length) return;
    state.highlighted = (state.highlighted + direction + buttons.length) % buttons.length;
    buttons.forEach((button, index) => button.classList.toggle('highlight', index === state.highlighted));
    buttons[state.highlighted]?.scrollIntoView({ block: 'nearest' });
  }

  function activateSelected() {
    const buttons = $$('.smart-result', box());
    const selected = buttons[state.highlighted] || buttons[0];
    selected?.click();
  }

  function clearSearch() {
    if (!input()) return;
    input().value = '';
    state.highlighted = -1;
    state.lastResults = [];
    box().innerHTML = '';
    box().classList.remove('open');
    $('#clearSearch')?.classList.remove('visible');
    input().focus();
  }

  function syncFilters() {
    const count = Object.values(state.filters).filter(Boolean).length;
    $('#smartSearchButton')?.classList.toggle('has-filters', count > 0);
    if ($('#smartFilterCount')) $('#smartFilterCount').textContent = String(count);
    $$('.smart-form-chips [data-form]').forEach((button) => {
      button.classList.toggle('active', button.dataset.form === state.filters.form);
    });
    const labels = Object.entries(state.filters)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`);
    if ($('#smartFilterSummary')) {
      $('#smartFilterSummary').innerHTML = labels.length
        ? `<strong>${labels.length} filtra:</strong> ${esc(labels.join(' · '))}`
        : 'Pa filtra shtesë.';
    }
  }

  function readFilters() {
    state.filters.form = $('#smartForm')?.value || '';
    state.filters.atc = $('#smartAtc')?.value.trim().toUpperCase() || '';
    state.filters.strength = $('#smartStrength')?.value.trim() || '';
    state.filters.status = $('#smartStatus')?.value || '';
    state.filters.manufacturer = $('#smartManufacturer')?.value.trim() || '';
    state.filters.authorizationHolder = $('#smartHolder')?.value.trim() || '';
    state.searchCache.clear();
    syncFilters();
  }

  function clearFilters() {
    state.filters = { form: '', atc: '', strength: '', status: '', manufacturer: '', authorizationHolder: '' };
    ['smartForm', 'smartAtc', 'smartStrength', 'smartStatus', 'smartManufacturer', 'smartHolder'].forEach((id) => {
      if ($(`#${id}`)) $(`#${id}`).value = '';
    });
    state.searchCache.clear();
    syncFilters();
    schedule();
  }

  function populateFacets() {
    const countValues = (field, limit = 120) => {
      const counts = new Map();
      state.products.forEach((product) => {
        const value = String(product[field] || '').trim();
        if (value) counts.set(value, (counts.get(value) || 0) + 1);
      });
      return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'sq'))
        .slice(0, limit);
    };

    const options = (id, rows, first) => {
      const element = $(`#${id}`);
      if (!element) return;
      const current = element.value;
      element.innerHTML = `<option value="">${esc(first)}</option>`
        + rows.map(([value, count]) => `<option value="${esc(value)}">${esc(value)} (${count})</option>`).join('');
      element.value = current;
    };

    const datalist = (id, rows) => {
      const element = $(`#${id}`);
      if (element) element.innerHTML = rows.map(([value]) => `<option value="${esc(value)}"></option>`).join('');
    };

    options('smartForm', countValues('pharmaceutical_form', 180), 'Të gjitha format');
    options('smartStatus', countValues('product_status', 30), 'Çdo status');
    datalist('smartManufacturerList', countValues('manufacturer', 80));
    datalist('smartHolderList', countValues('marketing_authorization_holder', 80));
  }

  function injectStyles() {
    if ($('#smartSearchStyles')) return;
    const style = document.createElement('style');
    style.id = 'smartSearchStyles';
    style.textContent = `
      .catalog-suggestion-section{display:none!important}
      .smart-search-button{display:inline-flex;min-height:60px;align-items:center;justify-content:center;gap:8px;padding:0 17px;border:1px solid rgba(255,255,255,.28);border-radius:11px;background:rgba(255,255,255,.09);color:#fff;font-size:13px;font-weight:850;white-space:nowrap}.smart-search-button:hover,.smart-search-button.active{border-color:#82c8ff;background:#0e5eae}.smart-search-button b{display:none;min-width:20px;height:20px;place-items:center;padding:0 6px;border-radius:999px;background:#fff;color:#0b5bab;font-size:10px}.smart-search-button.has-filters b{display:grid}
      .smart-filter-panel{margin-top:12px;padding:14px;border:1px solid rgba(255,255,255,.18);border-radius:13px;background:rgba(3,20,43,.62);box-shadow:0 18px 40px rgba(0,0,0,.16)}.smart-filter-panel[hidden]{display:none!important}.smart-filter-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}.smart-filter-head strong{display:block;font-size:13px}.smart-filter-head small{display:block;margin-top:3px;color:#aec4da;font-size:10.5px}.smart-filter-head button{border:0;background:transparent;color:#b8d3ed;font-size:11px;font-weight:850}
      .smart-filter-grid{display:grid;grid-template-columns:1.1fr .75fr .75fr .9fr 1.2fr 1.2fr;gap:9px}.smart-filter-grid label{color:#c9daeb;font-size:9px;font-weight:850;text-transform:uppercase}.smart-filter-grid input,.smart-filter-grid select{width:100%;height:42px;margin-top:5px;padding:0 10px;border:1px solid rgba(255,255,255,.25);border-radius:9px;background:#fff;color:#17253a;font-size:11.5px;outline:0}.smart-filter-grid input:focus,.smart-filter-grid select:focus{border-color:#75baff;box-shadow:0 0 0 3px rgba(91,168,255,.18)}
      .smart-form-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}.smart-form-chips button{min-height:32px;padding:5px 10px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.06);color:#dceafa;font-size:10px;font-weight:750}.smart-form-chips button:hover,.smart-form-chips button.active{border-color:#7fc7ff;background:#eaf5ff;color:#0754a4}.smart-filter-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;color:#bdd0e3;font-size:10px}.smart-filter-footer strong{color:#fff}.smart-filter-footer button{min-height:34px;padding:6px 11px;border:1px solid rgba(255,255,255,.24);border-radius:8px;background:transparent;color:#fff;font-size:10px;font-weight:800}
      .smart-db-status{display:flex;align-items:center;gap:7px;margin:10px 0 0;color:#b7c9dc;font-size:10px}.smart-db-status i{width:7px;height:7px;border-radius:50%;background:#f5b942}.smart-db-status[data-state=ready] i{background:#20ca82;box-shadow:0 0 0 4px rgba(32,202,130,.13)}.smart-db-status[data-state=error] i{background:#ff7185}
      .smart-search-section{border-bottom:5px solid #edf2f7;background:#fff}.smart-search-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid #dfe8f2;background:linear-gradient(90deg,#eef6ff,#f8fbff);color:#124c8f;font-size:10px;font-weight:950;letter-spacing:.075em}.smart-search-heading small{color:#5f7187;font-size:9px;font-weight:750;letter-spacing:0}.smart-group{padding:8px 14px 6px;background:#fbfcfe;color:#64748b;font-size:9px;font-weight:900;letter-spacing:.075em}
      .suggestions .smart-result{display:flex;min-height:76px;align-items:center;justify-content:space-between;gap:14px;padding:11px 14px;width:100%;border:0;border-bottom:1px solid #edf1f5;background:#fff;text-align:left}.suggestions .smart-result:hover,.suggestions .smart-result.highlight{background:#eef6ff;box-shadow:inset 4px 0 #0e63bc}.smart-main{display:flex;min-width:0;align-items:center;gap:11px}.smart-icon{display:grid;width:40px;height:40px;place-items:center;flex:0 0 auto;border-radius:11px;background:#e6f1ff;color:#0c57aa;font-size:9px;font-weight:950}.smart-icon.product{background:#eaf9f2;color:#087050}.smart-icon.clinical{background:#f5ecff;color:#6c2ea1}.smart-copy{min-width:0}.smart-copy strong{display:block;overflow:hidden;color:#122238;font-size:13.5px;text-overflow:ellipsis;white-space:nowrap}.smart-copy small{display:block;overflow:hidden;margin-top:4px;color:#63748a;font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}.smart-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.smart-tag{padding:3px 6px;border-radius:999px;background:#eef3f8;color:#455d79;font-size:8px;font-weight:850}.smart-tag.route{background:#e9f3ff;color:#0a57aa}.smart-tag.oral{background:#edf9f3;color:#087050}.smart-tag.injection{background:#fff4e4;color:#93520b}.smart-side{display:flex;align-items:flex-end;gap:5px;flex:0 0 auto;flex-direction:column}.smart-atc{padding:4px 7px;border-radius:7px;background:#eef3f8;color:#405977;font-size:8px;font-weight:900}.smart-price{color:#183d66;font-size:9px;font-weight:900}.smart-badge{padding:4px 7px;border-radius:999px;background:#eaf3ff;color:#1559ae;font-size:8px;font-weight:850}.smart-badge.product{background:#ecfdf3;color:#067647}.smart-badge.clinical{background:#f5ecff;color:#6c2ea1}.smart-state{padding:15px;color:#63748a;font-size:11px;line-height:1.5}.smart-state strong{color:#293b53}
      @media(max-width:1180px){.smart-filter-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:820px){.search-row{flex-direction:column}.smart-search-button{width:100%;min-height:44px}.smart-filter-grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.smart-filter-grid{grid-template-columns:1fr}.smart-filter-head,.smart-filter-footer{align-items:stretch;flex-direction:column}.smart-search-heading{align-items:flex-start;flex-direction:column}.smart-side{align-items:flex-start}.suggestions .smart-result{align-items:flex-start}.smart-copy small{white-space:normal}}
    `;
    document.head.appendChild(style);
  }

  function ensureUI() {
    if ($('#smartSearchButton')) return;
    const row = $('.search-row');
    const standard = $('#filters');
    if (!row || !standard) return;

    row.insertAdjacentHTML('beforeend', '<button class="smart-search-button" id="smartSearchButton" type="button" aria-expanded="false"><span>☷</span> Filtra profesionalë <b id="smartFilterCount">0</b></button>');
    standard.insertAdjacentHTML('afterend', `
      <section class="smart-filter-panel" id="smartFilterPanel" hidden>
        <div class="smart-filter-head"><div><strong>Filtra të avancuar të katalogut</strong><small>Kombino emrin, substancën, ATC-në, formën, fortësinë, prodhuesin dhe statusin.</small></div><button id="smartFilterClose" type="button">Mbyll ×</button></div>
        <div class="smart-filter-grid">
          <label>Forma<select id="smartForm"><option value="">Të gjitha format</option></select></label>
          <label>ATC<input id="smartAtc" placeholder="J01CA04"></label>
          <label>Fortësia<input id="smartStrength" placeholder="500 mg"></label>
          <label>Statusi<select id="smartStatus"><option value="">Çdo status</option></select></label>
          <label>Prodhuesi<input id="smartManufacturer" list="smartManufacturerList" placeholder="Prodhuesi"><datalist id="smartManufacturerList"></datalist></label>
          <label>Bartësi<input id="smartHolder" list="smartHolderList" placeholder="Bartësi i autorizimit"><datalist id="smartHolderList"></datalist></label>
        </div>
        <div class="smart-form-chips"><button data-form="" type="button">Çdo formë</button><button data-form="tablet" type="button">Tabletë</button><button data-form="capsule" type="button">Kapsulë</button><button data-form="injection" type="button">Injeksion</button><button data-form="suspension" type="button">Suspension</button><button data-form="syrup" type="button">Shurup</button><button data-form="cream" type="button">Krem</button><button data-form="inhal" type="button">Inhalim</button><button data-form="drop" type="button">Pika</button></div>
        <div class="smart-filter-footer"><span id="smartFilterSummary">Pa filtra shtesë.</span><button id="smartReset" type="button">Pastro filtrat</button></div>
      </section>
      <div class="smart-db-status" id="smartDbStatus" data-state="loading"><i></i><span>Po përgatitet katalogu lokal…</span></div>`);
  }

  function handleCapturedInput(event) {
    if (event.target !== input()) return;
    event.stopImmediatePropagation();
    schedule(0);
  }

  function handleCapturedFocus(event) {
    if (event.target !== input()) return;
    event.stopImmediatePropagation();
    if (input().value.trim()) schedule(0);
    else loadIndex(false);
  }

  function handleCapturedKeydown(event) {
    if (event.target !== input()) return;

    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    if (event.key === 'ArrowDown') moveHighlight(1);
    else if (event.key === 'ArrowUp') moveHighlight(-1);
    else if (event.key === 'Enter') activateSelected();
    else if (event.key === 'Escape') box()?.classList.remove('open');
  }

  function handleCapturedSubmit(event) {
    if (event.target?.id !== 'searchForm') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activateSelected();
  }

  function handleCapturedClick(event) {
    const clear = event.target.closest('#clearSearch');
    if (clear) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearSearch();
      return;
    }

    const filterButton = event.target.closest('#filters button');
    if (filterButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      $$('#filters button').forEach((button) => button.classList.remove('active'));
      filterButton.classList.add('active');
      state.searchCache.clear();
      schedule(0);
      return;
    }

    const smartButton = event.target.closest('#smartSearchButton');
    if (smartButton) {
      event.preventDefault();
      const panel = $('#smartFilterPanel');
      const open = panel.hidden;
      panel.hidden = !open;
      smartButton.classList.toggle('active', open);
      smartButton.setAttribute('aria-expanded', String(open));
      if (open) populateFacets();
      return;
    }

    if (event.target.closest('#smartFilterClose')) {
      event.preventDefault();
      const panel = $('#smartFilterPanel');
      panel.hidden = true;
      $('#smartSearchButton')?.classList.remove('active');
      $('#smartSearchButton')?.setAttribute('aria-expanded', 'false');
      return;
    }

    if (event.target.closest('#smartReset')) {
      event.preventDefault();
      clearFilters();
      return;
    }

    const chip = event.target.closest('.smart-form-chips [data-form]');
    if (chip) {
      event.preventDefault();
      state.filters.form = chip.dataset.form || '';
      if ($('#smartForm')) $('#smartForm').value = state.filters.form;
      state.searchCache.clear();
      syncFilters();
      schedule(0);
    }
  }

  function bindFilterInputs() {
    ['smartForm', 'smartStatus'].forEach((id) => {
      $(`#${id}`)?.addEventListener('change', () => {
        readFilters();
        schedule(0);
      });
    });

    ['smartAtc', 'smartStrength', 'smartManufacturer', 'smartHolder'].forEach((id) => {
      $(`#${id}`)?.addEventListener('input', () => {
        readFilters();
        schedule(0);
      });
    });
  }

  function start() {
    injectStyles();
    ensureUI();
    syncFilters();
    bindFilterInputs();

    document.addEventListener('input', handleCapturedInput, true);
    document.addEventListener('focus', handleCapturedFocus, true);
    document.addEventListener('keydown', handleCapturedKeydown, true);
    document.addEventListener('submit', handleCapturedSubmit, true);
    document.addEventListener('click', handleCapturedClick, true);

    window.DozaKSLocalSearch = {
      load: loadIndex,
      search(query) {
        if (!state.ready) return null;
        return searchLocal(String(query || ''));
      },
      clearCache() {
        state.searchCache.clear();
      },
      getStatus() {
        return {
          ready: state.ready,
          loading: state.loading,
          count: state.count,
          version: state.version,
          error: state.error?.message || null,
        };
      },
    };

    setTimeout(() => loadIndex(false), 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
