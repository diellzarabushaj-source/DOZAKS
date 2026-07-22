'use strict';

(() => {
  if (window.__dozaksSmartSearchLoaded) return;
  window.__dozaksSmartSearchLoaded = true;

  const API = '/api/smart-search';
  const FACETS_API = '/api/product-catalog?mode=facets';
  const state = {
    timer: null,
    sequence: 0,
    controller: null,
    cached: new Map(),
    lastResult: null,
    filters: { form: '', atc: '', strength: '', status: '', manufacturer: '', authorizationHolder: '' },
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const normalize = (value = '') => String(value).toLocaleLowerCase('sq').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const input = () => $('#searchInput');
  const box = () => $('#suggestions');

  const FORM_RULES = [
    [/\b(tablet|tableta|tabletë|tbl)\b/i, 'tablet'],
    [/\b(capsule|kapsul|kapsula|kapsulë)\b/i, 'capsule'],
    [/\b(iv|im|intravenoz|intravenous|intramuskular|intramuscular|injeksion|injection|ampul|vial|infuzion|infusion)\b/i, 'injection'],
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
  ];

  function parse(raw) {
    let term = String(raw || '').trim();
    let atc = '';
    let form = '';
    let strength = '';
    const atcMatch = term.match(/\b([a-z]\d{2}(?:[a-z]\d{0,2})?)\b/i);
    if (atcMatch) { atc = atcMatch[1].toUpperCase(); term = term.replace(atcMatch[0], ' '); }
    const strengthMatch = term.match(/\b\d+(?:[.,]\d+)?\s*(?:mcg|µg|ug|mg|g|ml|iu|%)\b/i);
    if (strengthMatch) { strength = strengthMatch[0].replace(',', '.'); term = term.replace(strengthMatch[0], ' '); }
    for (const [pattern, value] of FORM_RULES) {
      const match = term.match(pattern);
      if (match) { form = value; term = term.replace(match[0], ' '); break; }
    }
    return { term: term.replace(/[,+;|]+/g, ' ').replace(/\s+/g, ' ').trim(), atc, form, strength };
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

  function typeFilter() { return $('#filters button.active')?.dataset.filter || 'all'; }
  function enabled() { return ['all', 'generic', 'brand', 'group'].includes(typeFilter()); }
  function useful(query) { return query.term.length >= 2 || Object.entries(query).some(([key, value]) => key !== 'term' && Boolean(value)); }
  function cacheKey(query) { return JSON.stringify(query); }

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
      .suggestions .smart-result{display:flex;min-height:76px;align-items:center;justify-content:space-between;gap:14px;padding:11px 14px}.smart-main{display:flex;min-width:0;align-items:center;gap:11px}.smart-icon{display:grid;width:40px;height:40px;place-items:center;flex:0 0 auto;border-radius:11px;background:#e6f1ff;color:#0c57aa;font-size:9px;font-weight:950}.smart-icon.product{background:#eaf9f2;color:#087050}.smart-copy{min-width:0}.smart-copy strong{display:block;overflow:hidden;color:#122238;font-size:13.5px;text-overflow:ellipsis;white-space:nowrap}.smart-copy small{display:block;overflow:hidden;margin-top:4px;color:#63748a;font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}.smart-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.smart-tag{padding:3px 6px;border-radius:999px;background:#eef3f8;color:#455d79;font-size:8px;font-weight:850}.smart-tag.route{background:#e9f3ff;color:#0a57aa}.smart-tag.oral{background:#edf9f3;color:#087050}.smart-tag.injection{background:#fff4e4;color:#93520b}.smart-side{display:flex;align-items:flex-end;gap:5px;flex:0 0 auto;flex-direction:column}.smart-atc{padding:4px 7px;border-radius:7px;background:#eef3f8;color:#405977;font-size:8px;font-weight:900}.smart-badge{padding:4px 7px;border-radius:999px;background:#eaf3ff;color:#1559ae;font-size:8px;font-weight:850}.smart-badge.product{background:#ecfdf3;color:#067647}.smart-state{padding:15px;color:#63748a;font-size:11px;line-height:1.5}.smart-state strong{color:#293b53}.smart-retry{margin-left:8px;padding:5px 8px;border:1px solid #b8d2ee;border-radius:7px;background:#fff;color:#0d58a8;font-size:9px;font-weight:850}
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
      <div class="smart-db-status" id="smartDbStatus" data-state="loading"><i></i><span>Po verifikohet kërkimi Neon…</span></div>`);
  }

  function classify(form = '') {
    const value = normalize(form);
    const tags = [];
    const add = (label, tone = '') => { if (!tags.some((tag) => tag.label === label)) tags.push({ label, tone }); };
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
    return tags.slice(0, 3);
  }

  function tagsHTML(tags) { return tags.map((tag) => `<span class="smart-tag ${esc(tag.tone)}">${esc(tag.label)}</span>`).join(''); }
  function removeSection() { $('.smart-search-section', box())?.remove(); }
  function status(stateName, message) { const el = $('#smartDbStatus'); if (el) { el.dataset.state = stateName; el.innerHTML = `<i></i><span>${esc(message)}</span>`; } }

  function syncFilters() {
    const count = Object.values(state.filters).filter(Boolean).length;
    $('#smartSearchButton')?.classList.toggle('has-filters', count > 0);
    if ($('#smartFilterCount')) $('#smartFilterCount').textContent = String(count);
    document.querySelectorAll('.smart-form-chips [data-form]').forEach((button) => button.classList.toggle('active', button.dataset.form === state.filters.form));
    const labels = Object.entries(state.filters).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`);
    if ($('#smartFilterSummary')) $('#smartFilterSummary').innerHTML = labels.length ? `<strong>${labels.length} filtra:</strong> ${esc(labels.join(' · '))}` : 'Pa filtra shtesë.';
  }

  function readFilters() {
    state.filters.form = $('#smartForm')?.value || state.filters.form || '';
    state.filters.atc = $('#smartAtc')?.value.trim().toUpperCase() || '';
    state.filters.strength = $('#smartStrength')?.value.trim() || '';
    state.filters.status = $('#smartStatus')?.value || '';
    state.filters.manufacturer = $('#smartManufacturer')?.value.trim() || '';
    state.filters.authorizationHolder = $('#smartHolder')?.value.trim() || '';
    syncFilters();
  }

  function clearFilters() {
    state.filters = { form: '', atc: '', strength: '', status: '', manufacturer: '', authorizationHolder: '' };
    ['smartForm', 'smartAtc', 'smartStrength', 'smartStatus', 'smartManufacturer', 'smartHolder'].forEach((id) => { if ($(`#${id}`)) $(`#${id}`).value = ''; });
    syncFilters();
    schedule(true);
  }

  async function fetchJSON(url) {
    state.controller?.abort();
    const controller = new AbortController();
    state.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `API ${response.status}`);
      return data;
    } finally { clearTimeout(timeout); }
  }

  function buildURL(query) {
    const params = new URLSearchParams({ q: query.term, drugLimit: '6', limit: '12' });
    Object.entries(query).forEach(([key, value]) => { if (key !== 'term' && value) params.set(key, value); });
    return `${API}?${params}`;
  }

  function rowDrug(row) {
    const forms = Array.isArray(row.pharmaceutical_forms) ? row.pharmaceutical_forms : [];
    const tags = forms.flatMap(classify).filter((tag, index, all) => all.findIndex((item) => item.label === tag.label) === index).slice(0, 3);
    return `<button class="smart-result" type="button" data-kosovo-drug="${esc(row.id)}"><span class="smart-main"><span class="smart-icon">BAR</span><span class="smart-copy"><strong>${esc(row.generic_name)}</strong><small>${esc([row.atc_code, `${row.product_count || 0} produkte`, forms.slice(0, 2).join(', ')].filter(Boolean).join(' · '))}</small>${tags.length ? `<span class="smart-tags">${tagsHTML(tags)}</span>` : ''}</span></span><span class="smart-side"><span class="smart-atc">${esc(row.atc_code || 'ATC')}</span><span class="smart-badge">Bar gjenerik</span></span></button>`;
  }

  function rowProduct(row) {
    const tags = classify(row.pharmaceutical_form);
    return `<button class="smart-result" type="button" data-kosovo-product="${esc(row.id)}"><span class="smart-main"><span class="smart-icon product">KS</span><span class="smart-copy"><strong>${esc(row.trade_name || 'Produkt medicinal')}</strong><small>${esc([row.active_substance || row.generic_name, row.strength_text, row.pharmaceutical_form].filter(Boolean).join(' · '))}</small>${tags.length ? `<span class="smart-tags">${tagsHTML(tags)}</span>` : ''}</span></span><span class="smart-side"><span class="smart-atc">${esc(row.atc_code || 'ATC')}</span><span class="smart-badge product">Emër tregtar</span></span></button>`;
  }

  function render(data, raw, mode = 'ready') {
    if (!box() || input()?.value !== raw) return;
    removeSection();
    const section = document.createElement('section');
    section.className = 'smart-search-section';
    const total = Number(data?.total || 0).toLocaleString('sq-AL');
    const heading = `<div class="smart-search-heading"><span>NEON · KATALOGU ZYRTAR</span><small>${mode === 'ready' ? `${total} rezultate` : 'Kërkim në 4,006 produkte'}</small></div>`;
    if (mode === 'loading') section.innerHTML = `${heading}<div class="smart-state"><strong>Duke kërkuar…</strong> Analizohen emri, substanca, ATC-ja, forma, fortësia dhe gabimet në shkrim.</div>`;
    else if (mode === 'error') section.innerHTML = `${heading}<div class="smart-state"><strong>Neon nuk u arrit.</strong><button class="smart-retry" data-smart-retry type="button">Provo përsëri</button></div>`;
    else {
      const type = typeFilter();
      const drugs = ['all', 'generic', 'group'].includes(type) ? (data.drugResults || []) : [];
      const products = ['all', 'brand'].includes(type) ? (data.productResults || []) : [];
      section.innerHTML = heading + (drugs.length ? `<div class="smart-group">BARNAT GJENERIKE</div>${drugs.map(rowDrug).join('')}` : '') + (products.length ? `<div class="smart-group">PRODUKTET TREGTARE</div>${products.map(rowProduct).join('')}` : '') + (!drugs.length && !products.length ? '<div class="smart-state">Nuk u gjet rezultat. Shkurto emrin ose pastro një filtër.</div>' : '');
    }
    box().prepend(section);
    box().classList.add('open');
  }

  async function search(force = false) {
    const raw = input()?.value || '';
    const query = effective(raw);
    syncFilters();
    if (!enabled() || !useful(query)) { removeSection(); status('ready', 'Neon aktiv · shkruaj 2 shkronja ose zgjidh një filtër.'); return { drugResults: [], productResults: [], total: 0 }; }
    const key = cacheKey(query);
    if (!force && state.cached.has(key)) { const cached = state.cached.get(key); state.lastResult = cached; render(cached, raw); status('ready', `Neon · ${Number(cached.total || 0).toLocaleString('sq-AL')} rezultate`); return cached; }
    render({}, raw, 'loading'); status('loading', 'Neon po kërkon në katalog…');
    const sequence = ++state.sequence;
    try {
      const data = await fetchJSON(buildURL(query));
      if (sequence !== state.sequence || input()?.value !== raw) return { drugResults: [], productResults: [], total: 0 };
      state.cached.set(key, data); state.lastResult = data; render(data, raw); status('ready', `Neon · ${Number(data.total || 0).toLocaleString('sq-AL')} rezultate · smart search aktiv`); return data;
    } catch (error) {
      if (error.name === 'AbortError') return { drugResults: [], productResults: [], total: 0 };
      render({}, raw, 'error'); status('error', `Gabim në Neon: ${error.message}`); return { drugResults: [], productResults: [], total: 0 };
    }
  }

  function schedule(force = false) { clearTimeout(state.timer); state.timer = setTimeout(() => search(force), 180); }

  async function facets() {
    try {
      const response = await fetch(`${FACETS_API}&q=${encodeURIComponent(input()?.value || '')}`, { headers: { accept: 'application/json' }, credentials: 'same-origin' });
      if (!response.ok) return;
      const data = await response.json();
      const select = (id, rows, first) => { const el = $(`#${id}`); if (el) el.innerHTML = `<option value="">${first}</option>` + (rows || []).map((row) => `<option value="${esc(row.value)}">${esc(row.value)} (${row.count})</option>`).join(''); };
      const list = (id, rows) => { const el = $(`#${id}`); if (el) el.innerHTML = (rows || []).map((row) => `<option value="${esc(row.value)}"></option>`).join(''); };
      select('smartForm', data.forms, 'Të gjitha format'); select('smartStatus', data.statuses, 'Çdo status'); list('smartManufacturerList', data.manufacturers); list('smartHolderList', data.authorizationHolders);
    } catch (error) { console.warn('Smart facets failed', error); }
  }

  function bind() {
    const panel = $('#smartFilterPanel'); const button = $('#smartSearchButton');
    const toggle = (open) => { panel.hidden = !open; button.classList.toggle('active', open); button.setAttribute('aria-expanded', String(open)); if (open) facets(); };
    button?.addEventListener('click', () => toggle(panel.hidden)); $('#smartFilterClose')?.addEventListener('click', () => toggle(false)); $('#smartReset')?.addEventListener('click', clearFilters);
    document.querySelectorAll('.smart-form-chips [data-form]').forEach((chip) => chip.addEventListener('click', () => { state.filters.form = chip.dataset.form; if ($('#smartForm')) $('#smartForm').value = state.filters.form; syncFilters(); schedule(true); }));
    ['smartForm', 'smartStatus'].forEach((id) => $(`#${id}`)?.addEventListener('change', () => { readFilters(); schedule(true); }));
    ['smartAtc', 'smartStrength', 'smartManufacturer', 'smartHolder'].forEach((id) => $(`#${id}`)?.addEventListener('input', () => { readFilters(); schedule(true); }));
    input()?.addEventListener('input', () => schedule(false)); input()?.addEventListener('focus', () => schedule(false));
    document.addEventListener('click', (event) => { if (event.target.closest('[data-smart-retry]')) search(true); if (event.target.closest('#filters button')) setTimeout(() => schedule(true), 0); }, true);
    $('#searchForm')?.addEventListener('submit', async (event) => { if (!enabled()) return; const query = effective(input()?.value || ''); if (!useful(query)) return; event.preventDefault(); event.stopImmediatePropagation(); const data = await search(true); if (data.drugResults?.[0]) window.DozaKSProductCatalog?.openDrug?.(data.drugResults[0].id); else if (data.productResults?.[0]) window.DozaKSProductCatalog?.openProduct?.(data.productResults[0].id); }, true);
  }

  function start() { injectStyles(); ensureUI(); bind(); syncFilters(); status('ready', 'Neon aktiv · smart search po verifikohet.'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
