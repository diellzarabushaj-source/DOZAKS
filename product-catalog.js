'use strict';

(() => {
  const API_URL = '/api/product-catalog';
  const REQUEST_TIMEOUT = 4500;
  const SEARCH_DELAY = 130;
  const MAX_DRUG_RESULTS = 4;
  const MAX_PRODUCT_RESULTS = 6;

  let activeController = null;
  let searchTimer = null;
  let latestSequence = 0;
  let activeCatalogId = '';

  const searchCache = new Map();
  const productsById = new Map();
  const drugsById = new Map();

  const normalize = (value = '') => String(value)
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);

  const formatPrice = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('sq-AL', { style: 'currency', currency: 'EUR' }).format(amount)
      : '—';
  };

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

  const searchInput = () => document.querySelector('#searchInput');
  const suggestions = () => document.querySelector('#suggestions');
  const toast = (message) => window.showToast?.(message);

  async function fetchJSON(url) {
    activeController?.abort();
    activeController = new AbortController();
    const timeout = setTimeout(() => activeController.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        signal: activeController.signal,
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function injectStyles() {
    if (document.querySelector('#productCatalogStyles')) return;
    const style = document.createElement('style');
    style.id = 'productCatalogStyles';
    style.textContent = `
      .catalog-suggestion-section{border-bottom:5px solid #f2f5f9;background:#fff}
      .catalog-suggestion-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 13px;border-bottom:1px solid var(--line);background:#f4f8ff;color:#164f93;font-size:9px;font-weight:950;letter-spacing:.085em}
      .catalog-suggestion-heading small{color:#65758a;font-size:8px;font-weight:750;letter-spacing:0}
      .catalog-group-label{padding:7px 13px 5px;color:#667085;font-size:8px;font-weight:900;letter-spacing:.08em;background:#fbfcfe}
      .suggestions .catalog-suggestion{min-height:64px;align-items:flex-start}
      .catalog-suggestion-main{display:flex;min-width:0;align-items:flex-start;gap:10px}
      .catalog-suggestion-icon{display:grid;width:35px;height:35px;place-items:center;flex:0 0 auto;border-radius:10px;background:#e7f1ff;color:#1358aa;font-size:9px;font-weight:950}
      .catalog-suggestion-icon.product{background:#edf8f3;color:#087254}
      .catalog-suggestion-copy{min-width:0}.catalog-suggestion-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .catalog-suggestion-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .catalog-suggestion-side{display:flex;align-items:flex-end;gap:5px;flex-direction:column;flex:0 0 auto}
      .catalog-atc{padding:4px 7px;border-radius:7px;background:#eef3f8;color:#415977;font-size:8px;font-weight:900}
      .catalog-badge{padding:4px 7px;border-radius:999px;background:#eaf3ff;color:#1559ae;font-size:8px;font-weight:850;white-space:nowrap}
      .catalog-badge.product{background:#ecfdf3;color:#067647}
      .catalog-state{padding:11px 13px;color:#667085;font-size:10px;line-height:1.45}.catalog-state strong{color:#344054}
      #drugPanel.catalog-mode{border-color:#b8d3f5;box-shadow:0 18px 48px rgba(25,83,154,.11)}
      #drugPanel.catalog-mode .drug-head{border-bottom-color:#d7e6f8}
      #drugPanel.catalog-mode .eyebrow{color:#1559ae}
      #drugPanel.catalog-mode .data-source-pill{background:#eaf3ff;color:#1559ae}
      #drugPanel.catalog-mode .notice{border-left-color:#2b7af0;background:#f2f7ff;color:#36516f}
      #drugPanel.catalog-mode .table-wrap{border-color:#d7e3f1}
      #drugPanel.catalog-mode tbody td:nth-child(2){font-weight:700;color:#203a5c}
      .catalog-status-pill{display:inline-flex;padding:5px 8px;border-radius:999px;background:#ecfdf3;color:#067647;font-size:9px;font-weight:850}
      .catalog-product-link{padding:0;border:0;background:none;color:#164f93;font:inherit;font-weight:850;text-align:left;cursor:pointer}.catalog-product-link:hover{text-decoration:underline}
      @media(max-width:700px){.catalog-suggestion-heading{align-items:flex-start;flex-direction:column;gap:2px}.catalog-suggestion-side{align-items:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function catalogueAllowedByFilter() {
    const activeFilter = document.querySelector('#filters button.active')?.dataset.filter || 'all';
    return ['all', 'generic', 'brand', 'group'].includes(activeFilter);
  }

  function removeCatalogueSuggestions() {
    suggestions()?.querySelector('.catalog-suggestion-section')?.remove();
  }

  function genericResultRow(row) {
    return `
      <button class="catalog-suggestion" type="button" role="option" data-kosovo-drug="${escapeHTML(row.id)}">
        <span class="catalog-suggestion-main">
          <span class="catalog-suggestion-icon">BAR</span>
          <span class="catalog-suggestion-copy">
            <strong>${escapeHTML(row.generic_name)}</strong>
            <small>${escapeHTML([row.atc_code, `${row.product_count || 0} produkte`, (row.pharmaceutical_forms || []).slice(0, 2).join(', ')].filter(Boolean).join(' · '))}</small>
          </span>
        </span>
        <span class="catalog-suggestion-side"><span class="catalog-atc">${escapeHTML(row.atc_code || 'ATC')}</span><span class="catalog-badge">Bar gjenerik</span></span>
      </button>`;
  }

  function productResultRow(row) {
    return `
      <button class="catalog-suggestion" type="button" role="option" data-kosovo-product="${escapeHTML(row.id)}">
        <span class="catalog-suggestion-main">
          <span class="catalog-suggestion-icon product">KS</span>
          <span class="catalog-suggestion-copy">
            <strong>${escapeHTML(row.trade_name)}</strong>
            <small>${escapeHTML([row.active_substance, row.strength_text, row.pharmaceutical_form].filter(Boolean).join(' · '))}</small>
          </span>
        </span>
        <span class="catalog-suggestion-side"><span class="catalog-atc">${escapeHTML(row.atc_code || 'ATC')}</span><span class="catalog-badge product">Emër tregtar</span></span>
      </button>`;
  }

  function renderCatalogueSuggestions(result, query, state = 'ready') {
    const container = suggestions();
    const input = searchInput();
    if (!container || !input || normalize(input.value) !== normalize(query)) return;

    removeCatalogueSuggestions();
    const section = document.createElement('section');
    section.className = 'catalog-suggestion-section';
    section.setAttribute('aria-label', 'Katalogu kryesor i barnave në Kosovë');

    const heading = `<div class="catalog-suggestion-heading"><span>KATALOGU KRYESOR I BARNAVE</span><small>4,006 produkte · Lista zyrtare V1.1</small></div>`;
    const drugs = result?.drugResults || [];
    const products = result?.productResults || [];

    if (state === 'loading') {
      section.innerHTML = `${heading}<div class="catalog-state">Duke kërkuar në katalogun zyrtar…</div>`;
    } else if (state === 'error') {
      section.innerHTML = `${heading}<div class="catalog-state"><strong>Katalogu nuk u arrit.</strong> Kërkimi klinik lokal vazhdon të funksionojë.</div>`;
    } else if (!drugs.length && !products.length) {
      if (container.querySelector('[data-result-id]')) return;
      section.innerHTML = `${heading}<div class="catalog-state">Nuk u gjet bar ose produkt për “${escapeHTML(query)}”.</div>`;
    } else {
      section.innerHTML = heading
        + (drugs.length ? `<div class="catalog-group-label">BARNAT GJENERIKE</div>${drugs.slice(0, MAX_DRUG_RESULTS).map(genericResultRow).join('')}` : '')
        + (products.length ? `<div class="catalog-group-label">PRODUKTET TREGTARE</div>${products.slice(0, MAX_PRODUCT_RESULTS).map(productResultRow).join('')}` : '');
    }

    container.prepend(section);
    container.classList.add('open');
  }

  async function searchCatalogue(rawQuery, { force = false, showLoading = true } = {}) {
    const query = String(rawQuery || '').trim();
    const key = normalize(query);
    if (query.length < 2 || !catalogueAllowedByFilter()) {
      removeCatalogueSuggestions();
      return { drugResults: [], productResults: [] };
    }

    if (!force && searchCache.has(key)) {
      const cached = searchCache.get(key);
      renderCatalogueSuggestions(cached, query);
      return cached;
    }

    if (showLoading) renderCatalogueSuggestions({}, query, 'loading');
    const sequence = ++latestSequence;
    try {
      const data = await fetchJSON(`${API_URL}?q=${encodeURIComponent(query)}&drugLimit=${MAX_DRUG_RESULTS}&limit=${MAX_PRODUCT_RESULTS}`);
      if (sequence !== latestSequence) return { drugResults: [], productResults: [] };
      const result = {
        drugResults: Array.isArray(data.drugResults) ? data.drugResults : [],
        productResults: Array.isArray(data.productResults) ? data.productResults : (Array.isArray(data.results) ? data.results : []),
      };
      result.drugResults.forEach((row) => drugsById.set(String(row.id), row));
      result.productResults.forEach((row) => productsById.set(String(row.id), row));
      searchCache.set(key, result);
      renderCatalogueSuggestions(result, query);
      return result;
    } catch (error) {
      if (String(error?.name) === 'AbortError') return { drugResults: [], productResults: [] };
      if (sequence === latestSequence) renderCatalogueSuggestions({}, query, 'error');
      return { drugResults: [], productResults: [] };
    }
  }

  function scheduleSearch() {
    clearTimeout(searchTimer);
    const query = searchInput()?.value || '';
    if (String(query).trim().length < 2 || !catalogueAllowedByFilter()) {
      activeController?.abort();
      removeCatalogueSuggestions();
      return;
    }
    searchTimer = setTimeout(() => searchCatalogue(query), SEARCH_DELAY);
  }

  function setTableHeadings(labels) {
    [...document.querySelectorAll('#drugPanel thead th')].forEach((cell, index) => {
      if (labels[index]) cell.textContent = labels[index];
    });
  }

  function prepareMainCard() {
    window.DozaKSProductMode = true;
    window.DozaKSCatalogMode = true;
    const panel = document.querySelector('#drugPanel');
    panel?.classList.add('catalog-mode', 'product-mode');
    document.querySelector('#favoriteButton')?.setAttribute('hidden', '');
    document.querySelector('#openDetails')?.setAttribute('hidden', '');
    document.querySelector('.drug-links')?.setAttribute('hidden', '');
    suggestions()?.classList.remove('open');
    return panel;
  }

  function leaveCatalogueMode() {
    if (!window.DozaKSCatalogMode && !activeCatalogId) return;
    window.DozaKSProductMode = false;
    window.DozaKSCatalogMode = false;
    activeCatalogId = '';
    const panel = document.querySelector('#drugPanel');
    panel?.classList.remove('catalog-mode', 'product-mode');
    document.querySelector('#favoriteButton')?.removeAttribute('hidden');
    document.querySelector('#openDetails')?.removeAttribute('hidden');
    document.querySelector('.drug-links')?.removeAttribute('hidden');
    const sourcePill = document.querySelector('.data-source-pill');
    if (sourcePill) sourcePill.innerHTML = '<i></i> Neon · vetëm të publikuarat';
    const status = document.querySelector('.clinical-summary-strip div:first-child strong');
    if (status) status.textContent = 'Në verifikim';
    setTableHeadings(['Indikacioni / moduli', 'Të rriturit', 'Fëmijët', 'Statusi']);
  }

  function saveHistory({ id, name, type }) {
    try {
      const current = JSON.parse(localStorage.getItem('dozaks-history') || '[]');
      const entry = { id, name, type, time: new Date().toISOString() };
      localStorage.setItem('dozaks-history', JSON.stringify([entry, ...current.filter((item) => item.id !== id)].slice(0, 30)));
      window.renderRecent?.();
    } catch {
      // History is optional.
    }
  }

  function renderProductCard(row) {
    if (!row) return;
    activeCatalogId = `product:${row.id}`;
    productsById.set(String(row.id), row);
    const panel = prepareMainCard();
    const input = searchInput();
    if (input) input.value = row.trade_name || row.active_substance || '';
    document.querySelector('#clearSearch')?.classList.add('visible');

    document.querySelector('#itemType').textContent = 'PRODUKT MEDICINAL NË KOSOVË';
    document.querySelector('#drugName').textContent = row.trade_name || 'Produkt medicinal';
    document.querySelector('#drugGroup').textContent = [row.generic_name || row.active_substance, row.atc_code].filter(Boolean).join(' · ');
    const sourcePill = document.querySelector('.data-source-pill');
    if (sourcePill) sourcePill.innerHTML = `<i></i> Lista zyrtare · Versioni ${escapeHTML(row.version_label || '1.1')}`;
    const status = document.querySelector('.clinical-summary-strip div:first-child strong');
    if (status) status.textContent = 'Produkt i listuar';

    const chips = [row.strength_text, row.pharmaceutical_form, row.package_size].filter(Boolean);
    document.querySelector('#formChips').innerHTML = chips.map((value, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" disabled>${escapeHTML(value)}</button>`).join('');
    document.querySelector('#itemNotice').textContent = 'Kjo kartelë konfirmon identitetin dhe listimin e produktit. Indikacioni dhe doza shtohen vetëm nga burime klinike të verifikuara.';

    setTableHeadings(['Fusha', 'Vlera', 'Detaj shtesë', 'Statusi']);
    document.querySelector('#doseRows').innerHTML = `
      <tr><td>Produkti</td><td>${escapeHTML(row.trade_name || '—')}</td><td>${escapeHTML(row.active_substance || row.generic_name || '—')}</td><td><span class="catalog-status-pill">I listuar</span></td></tr>
      <tr><td>Forma dhe paketimi</td><td>${escapeHTML([row.strength_text, row.pharmaceutical_form].filter(Boolean).join(' · ') || '—')}</td><td>${escapeHTML(row.package_size || '—')}</td><td><span class="catalog-status-pill">Burim zyrtar</span></td></tr>
      <tr><td>Autorizimi</td><td>${escapeHTML(row.ma_certificate || '—')}</td><td>${escapeHTML(row.marketing_authorization_holder || row.manufacturer || '—')}</td><td><span class="catalog-status-pill">I indeksuar</span></td></tr>
      <tr><td>Vlefshmëria / çmimi</td><td>${escapeHTML(`${formatDate(row.valid_from)} – ${formatDate(row.valid_to)}`)}</td><td>${escapeHTML(formatPrice(row.retail_price))}</td><td><span class="catalog-status-pill">V${escapeHTML(row.version_label || '1.1')}</span></td></tr>`;

    saveHistory({ id: `product:${row.id}`, name: row.trade_name, type: 'Produkt medicinal në Kosovë' });
    panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`${row.trade_name} u hap nga katalogu zyrtar.`);
  }

  function renderDrugCard(drug, products) {
    if (!drug) return;
    activeCatalogId = `drug:${drug.id}`;
    drugsById.set(String(drug.id), drug);
    products.forEach((row) => productsById.set(String(row.id), row));
    const panel = prepareMainCard();
    const input = searchInput();
    if (input) input.value = drug.generic_name || '';
    document.querySelector('#clearSearch')?.classList.add('visible');

    document.querySelector('#itemType').textContent = 'BAR GJENERIK · KATALOGU I KOSOVËS';
    document.querySelector('#drugName').textContent = drug.generic_name || 'Bar gjenerik';
    document.querySelector('#drugGroup').textContent = `${drug.atc_code || 'Pa ATC'} · ${drug.product_count || products.length} produkte të listuara`;
    const sourcePill = document.querySelector('.data-source-pill');
    if (sourcePill) sourcePill.innerHTML = `<i></i> Baza kryesore · Versioni ${escapeHTML(drug.version_label || '1.1')}`;
    const status = document.querySelector('.clinical-summary-strip div:first-child strong');
    if (status) status.textContent = 'Bar nga katalogu';

    const chips = [...(drug.pharmaceutical_forms || []).slice(0, 5), ...(drug.strengths || []).slice(0, 3)];
    document.querySelector('#formChips').innerHTML = chips.map((value, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" disabled>${escapeHTML(value)}</button>`).join('');
    document.querySelector('#itemNotice').textContent = 'Ky është entiteti kryesor i barit. Produktet tregtare, format dhe fortësitë lidhen nga lista zyrtare; dozat do të shtohen si shtresë klinike e veçantë.';

    setTableHeadings(['Produkti', 'Forma / fortësia', 'Paketimi', 'Statusi']);
    document.querySelector('#doseRows').innerHTML = products.slice(0, 40).map((row) => `
      <tr>
        <td><button class="catalog-product-link" type="button" data-kosovo-product="${escapeHTML(row.id)}">${escapeHTML(row.trade_name)}</button></td>
        <td>${escapeHTML([row.strength_text, row.pharmaceutical_form].filter(Boolean).join(' · ') || '—')}</td>
        <td>${escapeHTML(row.package_size || '—')}</td>
        <td><span class="catalog-status-pill">${escapeHTML(row.product_status || 'I listuar')}</span></td>
      </tr>`).join('') || '<tr><td colspan="4">Nuk u gjet produkt aktiv.</td></tr>';

    saveHistory({ id: `drug:${drug.id}`, name: drug.generic_name, type: 'Bar gjenerik nga katalogu' });
    panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`${drug.generic_name} u hap me ${products.length} produkte.`);
  }

  async function openProductById(id) {
    const productId = String(id || '').replace(/^product:/, '');
    if (!productId) return;
    const cached = productsById.get(productId);
    if (cached) return renderProductCard(cached);
    try {
      const row = await fetchJSON(`${API_URL}?mode=detail&id=${encodeURIComponent(productId)}`);
      renderProductCard(row);
    } catch {
      toast('Produkti nuk u hap. Provo përsëri.');
    }
  }

  async function openDrugById(id) {
    const drugId = String(id || '').replace(/^drug:/, '');
    if (!drugId) return;
    try {
      const data = await fetchJSON(`${API_URL}?mode=drug-detail&id=${encodeURIComponent(drugId)}`);
      renderDrugCard(data.drug, Array.isArray(data.products) ? data.products : []);
    } catch {
      toast('Bari nuk u hap. Provo përsëri.');
    }
  }

  function getCachedResult(query) {
    return searchCache.get(normalize(query)) || { drugResults: [], productResults: [] };
  }

  function handleClickCapture(event) {
    const drug = event.target.closest('[data-kosovo-drug]');
    if (drug) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openDrugById(drug.dataset.kosovoDrug);
      return;
    }
    const product = event.target.closest('[data-kosovo-product]');
    if (product) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openProductById(product.dataset.kosovoProduct);
      return;
    }
    const historyDrug = event.target.closest('[data-open-item^="drug:"]');
    if (historyDrug) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.closeModal?.();
      openDrugById(historyDrug.dataset.openItem);
      return;
    }
    const historyProduct = event.target.closest('[data-open-item^="product:"]');
    if (historyProduct) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.closeModal?.();
      openProductById(historyProduct.dataset.openItem);
      return;
    }
    if (event.target.closest('[data-result-id], [data-open-item]:not([data-open-item^="product:"]):not([data-open-item^="drug:"]), #popularList button')) leaveCatalogueMode();
    if (event.target.closest('#clearSearch')) {
      activeController?.abort();
      removeCatalogueSuggestions();
    }
    if (event.target.closest('#filters button')) setTimeout(scheduleSearch, 0);
  }

  function handleKeydownCapture(event) {
    if (event.target !== searchInput() || event.key !== 'Enter') return;
    const highlighted = suggestions()?.querySelector('button.highlight[data-kosovo-drug], button.highlight[data-kosovo-product]');
    if (!highlighted) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (highlighted.dataset.kosovoDrug) openDrugById(highlighted.dataset.kosovoDrug);
    else openProductById(highlighted.dataset.kosovoProduct);
  }

  async function handleSubmitCapture(event) {
    if (event.target?.id !== 'searchForm') return;
    const container = suggestions();
    const highlighted = container?.querySelector('button.highlight[data-kosovo-drug], button.highlight[data-kosovo-product]');
    if (highlighted) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (highlighted.dataset.kosovoDrug) openDrugById(highlighted.dataset.kosovoDrug);
      else openProductById(highlighted.dataset.kosovoProduct);
      return;
    }

    const query = searchInput()?.value || '';
    let result = getCachedResult(query);
    if (!result.drugResults.length && !result.productResults.length && String(query).trim().length >= 2) {
      result = await searchCatalogue(query, { force: true, showLoading: true });
    }
    const topDrug = result.drugResults[0];
    const topProduct = result.productResults[0];
    const exactDrug = topDrug && [topDrug.generic_name, topDrug.normalized_name, topDrug.atc_code].some((value) => normalize(value) === normalize(query));
    const hasLocalResult = Boolean(container?.querySelector('[data-result-id]'));

    if (topDrug && (exactDrug || !hasLocalResult)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openDrugById(topDrug.id);
    } else if (topProduct && !hasLocalResult) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openProductById(topProduct.id);
    } else {
      leaveCatalogueMode();
    }
  }

  function start() {
    injectStyles();
    const input = searchInput();
    if (!input) return;
    input.addEventListener('input', scheduleSearch);
    input.addEventListener('focus', scheduleSearch);
    document.addEventListener('click', handleClickCapture, true);
    document.addEventListener('keydown', handleKeydownCapture, true);
    document.querySelector('#searchForm')?.addEventListener('submit', handleSubmitCapture, true);

    window.DozaKSProductCatalog = {
      search: searchCatalogue,
      openDrug: openDrugById,
      openProduct: openProductById,
      getCachedResult,
      leaveProductMode: leaveCatalogueMode,
      leaveCatalogueMode,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
