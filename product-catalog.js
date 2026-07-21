'use strict';

(() => {
  const API_URL = '/api/product-catalog';
  const REQUEST_TIMEOUT = 4200;
  const SEARCH_DELAY = 150;
  const MAX_RESULTS = 5;

  let activeController = null;
  let searchTimer = null;
  let latestSequence = 0;
  let activeProductId = '';

  const resultCache = new Map();
  const productsById = new Map();

  const normalize = (value = '') => String(value)
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

  function toast(message) {
    window.showToast?.(message);
  }

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
      .product-suggestion-section{border-top:5px solid #f4f7fb;background:#fff}
      .product-suggestion-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 13px;border-bottom:1px solid var(--line);background:#f8fbff;color:#1f4f87;font-size:9px;font-weight:900;letter-spacing:.085em}
      .product-suggestion-heading small{color:#74859b;font-size:8px;font-weight:750;letter-spacing:0}
      .suggestions .product-suggestion{min-height:68px;align-items:flex-start}
      .product-suggestion-main{display:flex;min-width:0;align-items:flex-start;gap:10px}
      .product-suggestion-icon{display:grid;width:34px;height:34px;place-items:center;flex:0 0 auto;border-radius:9px;background:#eaf3ff;color:#1459aa;font-size:10px;font-weight:950}
      .product-suggestion-copy{min-width:0}.product-suggestion-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .product-suggestion-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .product-suggestion-side{display:flex;align-items:flex-end;gap:5px;flex-direction:column;flex:0 0 auto}
      .product-suggestion-atc{padding:4px 7px;border-radius:7px;background:#eef3f8;color:#415977;font-size:8px;font-weight:900}
      .product-suggestion-badge{padding:4px 7px;border-radius:999px;background:#ecfdf3;color:#067647;font-size:8px;font-weight:850;white-space:nowrap}
      .product-suggestion-state{padding:11px 13px;color:#667085;font-size:10px;line-height:1.45}
      .product-suggestion-state strong{color:#344054}
      #drugPanel.product-mode{border-color:#b8d3f5;box-shadow:0 18px 48px rgba(25,83,154,.11)}
      #drugPanel.product-mode .drug-head{border-bottom-color:#d7e6f8}
      #drugPanel.product-mode .eyebrow{color:#1559ae}
      #drugPanel.product-mode .data-source-pill{background:#eaf3ff;color:#1559ae}
      #drugPanel.product-mode .notice{border-left-color:#2b7af0;background:#f2f7ff;color:#36516f}
      #drugPanel.product-mode .table-wrap{border-color:#d7e3f1}
      #drugPanel.product-mode tbody td:nth-child(2){font-weight:700;color:#203a5c}
      .product-status-pill{display:inline-flex;padding:5px 8px;border-radius:999px;background:#ecfdf3;color:#067647;font-size:9px;font-weight:850}
      @media(max-width:700px){
        .product-suggestion-heading{align-items:flex-start;flex-direction:column;gap:2px}
        .suggestions .product-suggestion{align-items:flex-start;gap:8px}
        .product-suggestion-side{align-items:flex-start}
      }
    `;
    document.head.appendChild(style);
  }

  function catalogAllowedByFilter() {
    const activeFilter = document.querySelector('#filters button.active')?.dataset.filter || 'all';
    return ['all', 'generic', 'brand'].includes(activeFilter);
  }

  function removeProductSuggestions() {
    suggestions()?.querySelector('.product-suggestion-section')?.remove();
  }

  function renderProductSuggestions(rows, query, state = 'ready') {
    const container = suggestions();
    const input = searchInput();
    if (!container || !input || normalize(input.value) !== normalize(query)) return;

    removeProductSuggestions();

    const section = document.createElement('section');
    section.className = 'product-suggestion-section';
    section.setAttribute('aria-label', 'Produkte medicinale në Kosovë');

    const heading = `
      <div class="product-suggestion-heading">
        <span>PRODUKTE MEDICINALE NË KOSOVË</span>
        <small>Lista zyrtare · Versioni 1.1</small>
      </div>`;

    if (state === 'loading') {
      section.innerHTML = `${heading}<div class="product-suggestion-state">Duke kontrolluar katalogun e Kosovës…</div>`;
    } else if (state === 'error') {
      if (container.querySelector('[data-result-id]')) return;
      section.innerHTML = `${heading}<div class="product-suggestion-state"><strong>Katalogu i Kosovës nuk u arrit.</strong> Rezultatet klinike lokale vazhdojnë të funksionojnë.</div>`;
    } else if (!rows.length) {
      if (container.querySelector('[data-result-id]')) return;
      section.innerHTML = `${heading}<div class="product-suggestion-state">Nuk u gjet produkt në listën aktuale për “${escapeHTML(query)}”.</div>`;
    } else {
      section.innerHTML = heading + rows.slice(0, MAX_RESULTS).map((row) => `
        <button class="product-suggestion" type="button" role="option" data-kosovo-product="${escapeHTML(row.id)}">
          <span class="product-suggestion-main">
            <span class="product-suggestion-icon">KS</span>
            <span class="product-suggestion-copy">
              <strong>${escapeHTML(row.trade_name)}</strong>
              <small>${escapeHTML([row.active_substance, row.strength_text, row.pharmaceutical_form].filter(Boolean).join(' · '))}</small>
            </span>
          </span>
          <span class="product-suggestion-side">
            <span class="product-suggestion-atc">${escapeHTML(row.atc_code || 'ATC')}</span>
            <span class="product-suggestion-badge">Produkt i listuar</span>
          </span>
        </button>`).join('');
    }

    container.appendChild(section);
    container.classList.add('open');
  }

  async function searchProducts(rawQuery, { force = false, showLoading = true } = {}) {
    const query = String(rawQuery || '').trim();
    const key = normalize(query);

    if (query.length < 2 || !catalogAllowedByFilter()) {
      removeProductSuggestions();
      return [];
    }

    if (!force && resultCache.has(key)) {
      const cached = resultCache.get(key);
      renderProductSuggestions(cached, query);
      return cached;
    }

    if (showLoading) renderProductSuggestions([], query, 'loading');

    const sequence = ++latestSequence;
    try {
      const data = await fetchJSON(`${API_URL}?q=${encodeURIComponent(query)}&limit=${MAX_RESULTS}`);
      if (sequence !== latestSequence) return [];
      const rows = Array.isArray(data.results) ? data.results : [];
      rows.forEach((row) => productsById.set(String(row.id), row));
      resultCache.set(key, rows);
      renderProductSuggestions(rows, query);
      return rows;
    } catch (error) {
      if (String(error?.name) === 'AbortError') return [];
      if (sequence === latestSequence) renderProductSuggestions([], query, 'error');
      return [];
    }
  }

  function scheduleSearch() {
    clearTimeout(searchTimer);
    const query = searchInput()?.value || '';
    if (String(query).trim().length < 2 || !catalogAllowedByFilter()) {
      activeController?.abort();
      removeProductSuggestions();
      return;
    }
    searchTimer = setTimeout(() => searchProducts(query), SEARCH_DELAY);
  }

  function setTableHeadings(labels) {
    const cells = [...document.querySelectorAll('#drugPanel thead th')];
    labels.forEach((label, index) => {
      if (cells[index]) cells[index].textContent = label;
    });
  }

  function leaveProductMode() {
    if (!window.DozaKSProductMode && !activeProductId) return;
    window.DozaKSProductMode = false;
    activeProductId = '';
    const panel = document.querySelector('#drugPanel');
    panel?.classList.remove('product-mode');
    document.querySelector('#favoriteButton')?.removeAttribute('hidden');
    document.querySelector('#openDetails')?.removeAttribute('hidden');
    document.querySelector('.drug-links')?.removeAttribute('hidden');
    const sourcePill = document.querySelector('.data-source-pill');
    if (sourcePill) sourcePill.innerHTML = '<i></i> Neon · vetëm të publikuarat';
    const status = document.querySelector('.clinical-summary-strip div:first-child strong');
    if (status) status.textContent = 'Në verifikim';
    setTableHeadings(['Indikacioni / moduli', 'Të rriturit', 'Fëmijët', 'Statusi']);
  }

  function saveProductHistory(row) {
    try {
      const current = JSON.parse(localStorage.getItem('dozaks-history') || '[]');
      const id = `product:${row.id}`;
      const entry = {
        id,
        name: row.trade_name,
        type: 'Produkt medicinal në Kosovë',
        time: new Date().toISOString(),
      };
      localStorage.setItem('dozaks-history', JSON.stringify([entry, ...current.filter((item) => item.id !== id)].slice(0, 30)));
      window.renderRecent?.();
    } catch {
      // History is optional; the clinical result must still open.
    }
  }

  function renderProductCard(row) {
    if (!row) return;
    window.DozaKSProductMode = true;
    activeProductId = String(row.id);
    productsById.set(activeProductId, row);

    const input = searchInput();
    if (input) input.value = row.trade_name || row.active_substance || '';
    document.querySelector('#clearSearch')?.classList.add('visible');
    suggestions()?.classList.remove('open');

    const panel = document.querySelector('#drugPanel');
    panel?.classList.add('product-mode');

    const itemType = document.querySelector('#itemType');
    const drugName = document.querySelector('#drugName');
    const drugGroup = document.querySelector('#drugGroup');
    const notice = document.querySelector('#itemNotice');
    const formChips = document.querySelector('#formChips');
    const doseRows = document.querySelector('#doseRows');
    const sourcePill = document.querySelector('.data-source-pill');
    const status = document.querySelector('.clinical-summary-strip div:first-child strong');

    if (itemType) itemType.textContent = 'PRODUKT MEDICINAL NË KOSOVË';
    if (drugName) drugName.textContent = row.trade_name || 'Produkt medicinal';
    if (drugGroup) drugGroup.textContent = [row.active_substance, row.atc_code].filter(Boolean).join(' · ');
    if (sourcePill) sourcePill.innerHTML = `<i></i> Lista zyrtare · Versioni ${escapeHTML(row.version_label || '1.1')}`;
    if (status) status.textContent = 'I listuar';

    const chips = [row.strength_text, row.pharmaceutical_form, row.package_size].filter(Boolean);
    if (formChips) formChips.innerHTML = chips.map((value, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" disabled>${escapeHTML(value)}</button>`).join('');

    if (notice) {
      notice.textContent = 'Kjo kartelë konfirmon identitetin dhe listimin e produktit në burimin zyrtar. Indikacioni, doza, intervali dhe kohëzgjatja kërkojnë verifikim klinik të veçantë.';
    }

    setTableHeadings(['Fusha', 'Vlera', 'Detaj shtesë', 'Statusi']);
    if (doseRows) {
      doseRows.innerHTML = `
        <tr><td>Produkti</td><td>${escapeHTML(row.trade_name || '—')}</td><td>${escapeHTML(row.active_substance || '—')}</td><td><span class="product-status-pill">I listuar</span></td></tr>
        <tr><td>Forma dhe paketimi</td><td>${escapeHTML([row.strength_text, row.pharmaceutical_form].filter(Boolean).join(' · ') || '—')}</td><td>${escapeHTML(row.package_size || '—')}</td><td><span class="product-status-pill">Burim zyrtar</span></td></tr>
        <tr><td>Autorizimi</td><td>${escapeHTML(row.ma_certificate || '—')}</td><td>${escapeHTML(row.marketing_authorization_holder || row.manufacturer || '—')}</td><td><span class="product-status-pill">I indeksuar</span></td></tr>
        <tr><td>Vlefshmëria / çmimi</td><td>${escapeHTML(`${formatDate(row.valid_from)} – ${formatDate(row.valid_to)}`)}</td><td>${escapeHTML(formatPrice(row.retail_price))}</td><td><span class="product-status-pill">Versioni ${escapeHTML(row.version_label || '1.1')}</span></td></tr>`;
    }

    document.querySelector('#favoriteButton')?.setAttribute('hidden', '');
    document.querySelector('#openDetails')?.setAttribute('hidden', '');
    document.querySelector('.drug-links')?.setAttribute('hidden', '');

    saveProductHistory(row);
    panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`${row.trade_name} u hap nga lista zyrtare.`);
  }

  async function openProductById(id) {
    const productId = String(id || '').replace(/^product:/, '');
    if (!productId) return;
    const cached = productsById.get(productId);
    if (cached) {
      renderProductCard(cached);
      return;
    }

    try {
      const row = await fetchJSON(`${API_URL}?mode=detail&id=${encodeURIComponent(productId)}`);
      productsById.set(productId, row);
      renderProductCard(row);
    } catch {
      toast('Produkti nuk u hap. Provo përsëri.');
    }
  }

  function getTopCachedResult(query) {
    return resultCache.get(normalize(query))?.[0] || null;
  }

  function handleClickCapture(event) {
    const product = event.target.closest('[data-kosovo-product]');
    if (product) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openProductById(product.dataset.kosovoProduct);
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

    if (event.target.closest('[data-result-id], [data-open-item]:not([data-open-item^="product:"]), #popularList button, #recentList button:not([data-open-item^="product:"])')) {
      leaveProductMode();
    }

    if (event.target.closest('#clearSearch')) {
      activeController?.abort();
      removeProductSuggestions();
    }

    if (event.target.closest('#filters button')) {
      setTimeout(scheduleSearch, 0);
    }
  }

  function handleKeydownCapture(event) {
    if (event.target !== searchInput() || event.key !== 'Enter') return;
    const highlightedProduct = suggestions()?.querySelector('button.highlight[data-kosovo-product]');
    if (highlightedProduct) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openProductById(highlightedProduct.dataset.kosovoProduct);
      return;
    }
    leaveProductMode();
  }

  async function handleSubmitCapture(event) {
    if (event.target?.id !== 'searchForm') return;
    const container = suggestions();
    const highlightedProduct = container?.querySelector('button.highlight[data-kosovo-product]');
    if (highlightedProduct) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openProductById(highlightedProduct.dataset.kosovoProduct);
      return;
    }

    const hasLocalResult = Boolean(container?.querySelector('[data-result-id]'));
    const query = searchInput()?.value || '';
    let topProduct = getTopCachedResult(query);

    if (!hasLocalResult && String(query).trim().length >= 2) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!topProduct) {
        const rows = await searchProducts(query, { force: true, showLoading: true });
        topProduct = rows[0] || null;
      }
      if (topProduct) renderProductCard(topProduct);
      else toast(`Nuk u gjet produkt për “${query}”.`);
      return;
    }

    leaveProductMode();
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
      search: searchProducts,
      openProduct: openProductById,
      getTopCachedResult,
      leaveProductMode,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
