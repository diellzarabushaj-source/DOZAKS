'use strict';

(() => {
  const API_URL = '/api/product-catalog';
  const REQUEST_TIMEOUT = 4500;
  let activeController = null;
  let searchTimer = null;
  let latestSequence = 0;
  const cache = new Map();

  const normalize = (value = '') => String(value)
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);

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
      .catalog-launch-card{display:flex;align-items:center;gap:13px;min-height:88px;padding:15px;border:1px solid var(--line);border-radius:14px;background:#fff;text-align:left;box-shadow:0 4px 17px rgba(8,30,66,.04);transition:.16s}
      .catalog-launch-card:hover{transform:translateY(-2px);border-color:#b9d1f3;box-shadow:var(--shadow)}
      .catalog-launch-card>span:nth-child(2){min-width:0;flex:1}.catalog-launch-card strong{display:block;font-size:14px}.catalog-launch-card small{display:block;margin-top:5px;color:var(--muted);line-height:1.45}.catalog-launch-card .arrow{color:var(--blue);font-weight:900}
      .catalog-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;margin-bottom:12px}.catalog-toolbar input{min-height:46px;padding:10px 13px;border:1px solid #ccd8e8;border-radius:10px;background:#fff;font:inherit}.catalog-toolbar button{min-height:46px;padding:0 15px;border:0;border-radius:10px;background:var(--blue);color:#fff;font-weight:800}
      .catalog-status{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;border-radius:10px;background:#f4f8fe;color:#3b5575;font-size:11px}.catalog-status strong{color:var(--navy)}
      .catalog-results{display:grid;gap:8px}.catalog-empty{padding:30px 16px;border:1px dashed #cbd8e8;border-radius:12px;background:#fbfcfe;text-align:center;color:var(--muted)}
      .catalog-result{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:13px;border:1px solid var(--line);border-radius:12px;background:#fff;text-align:left}.catalog-result:hover{border-color:#b8cff0;background:#fbfdff}.catalog-result h3{margin:0;font-size:14px}.catalog-result p{margin:4px 0 0;color:#49617e;font-size:12px;line-height:1.45}.catalog-result small{display:block;margin-top:7px;color:var(--muted);font-size:10px;line-height:1.45}.catalog-result-side{display:flex;flex-direction:column;align-items:flex-end;gap:7px}.catalog-code{display:inline-flex;align-items:center;justify-content:center;min-width:68px;padding:6px 8px;border-radius:8px;background:#eaf2ff;color:#1559ae;font-size:11px;font-weight:900}.catalog-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#edf7f3;color:#087254;font-size:9px;font-weight:800}.catalog-price{font-size:12px;font-weight:900;color:var(--navy)}
      .catalog-detail{display:grid;gap:12px}.catalog-detail-header{padding:14px;border-radius:12px;background:linear-gradient(135deg,#eef5ff,#f9fbff)}.catalog-detail-header h3{margin:0 0 5px;font-size:18px}.catalog-detail-header p{margin:0;color:#49617e}.catalog-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.catalog-detail-grid div{padding:11px;border:1px solid var(--line);border-radius:10px;background:#fff}.catalog-detail-grid span{display:block;color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.catalog-detail-grid strong{display:block;margin-top:4px;font-size:12px;line-height:1.45}.catalog-note{padding:11px 12px;border-left:3px solid var(--blue);border-radius:8px;background:#f2f7ff;color:#36516f;font-size:11px;line-height:1.55}
      @media(max-width:700px){.catalog-toolbar{grid-template-columns:1fr}.catalog-result{grid-template-columns:1fr}.catalog-result-side{align-items:flex-start;flex-direction:row;flex-wrap:wrap}.catalog-detail-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function injectNavigation() {
    if (document.querySelector('[data-product-catalog]')) return;
    const drugsButton = document.querySelector('.nav-item[data-action="drugs"]');
    if (!drugsButton) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item';
    button.dataset.productCatalog = 'open';
    button.innerHTML = '<span class="nav-icon">K</span><span>Produktet në Kosovë</span>';
    drugsButton.insertAdjacentElement('afterend', button);
  }

  function injectLaunchCard() {
    if (document.querySelector('.catalog-launch-card')) return;
    const categories = document.querySelector('.categories');
    if (!categories) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-launch-card';
    button.dataset.productCatalog = 'open';
    button.innerHTML = '<span class="bubble cyan">K</span><span><strong>Produktet në Kosovë</strong><small>Emër tregtar, substancë, ATC, formë dhe certifikatë MA</small></span><span class="arrow">→</span>';
    categories.appendChild(button);
  }

  function openCatalog() {
    if (!window.openModal) {
      toast('Moduli nuk është gati. Rifresko faqen.');
      return;
    }
    window.openModal({
      title: 'Produktet medicinale në Kosovë',
      subtitle: 'Kërkim në Listën zyrtare të çmimeve të produkteve medicinale – Versioni 1.1.',
      kicker: 'BURIM ZYRTAR I BRENDSHËM',
      body: `
        <form class="catalog-toolbar" id="catalogSearchForm" role="search">
          <input id="catalogSearchInput" type="search" placeholder="P.sh. ceftriaxone, NovoRapid, J01DD04, MA-…" autocomplete="off" aria-label="Kërko produktin medicinal">
          <button type="submit">Kërko</button>
        </form>
        <div class="catalog-status" id="catalogStatus"><span>Po kontrollohet databaza…</span><strong>Pilot klinik</strong></div>
        <div class="catalog-results" id="catalogResults"><div class="catalog-empty">Shkruaj të paktën dy shkronja.</div></div>
        <div class="catalog-note">Ky katalog konfirmon identitetin e produktit, formën, fortësinë, certifikatën MA, çmimin dhe afatin e listës. Nuk konfirmon indikacionin ose dozën klinike.</div>`,
    });

    const form = document.querySelector('#catalogSearchForm');
    const input = document.querySelector('#catalogSearchInput');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      searchProducts(input?.value || '', true);
    });
    input?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => searchProducts(input.value), 170);
    });
    setTimeout(() => input?.focus(), 60);
    loadHealth();
  }

  async function loadHealth() {
    const status = document.querySelector('#catalogStatus');
    if (!status) return;
    try {
      const data = await fetchJSON(`${API_URL}?mode=health`);
      status.innerHTML = `<span><strong>${Number(data.visible_products || 0)}</strong> produkte aktive · ${Number(data.atc_codes || 0)} kode ATC</span><strong>Versioni ${escapeHTML(data.version_label || '1.1')}</strong>`;
    } catch {
      status.innerHTML = '<span>Katalogu nuk u arrit për momentin.</span><strong>Fallback i sigurt</strong>';
    }
  }

  async function searchProducts(query, force = false) {
    const value = String(query || '').trim();
    const results = document.querySelector('#catalogResults');
    if (!results) return;
    if (value.length < 2) {
      results.innerHTML = '<div class="catalog-empty">Shkruaj të paktën dy shkronja.</div>';
      return;
    }

    const key = normalize(value);
    if (!force && cache.has(key)) {
      renderResults(cache.get(key));
      return;
    }

    const sequence = ++latestSequence;
    results.innerHTML = '<div class="catalog-empty">Duke kërkuar…</div>';
    try {
      const data = await fetchJSON(`${API_URL}?q=${encodeURIComponent(value)}&limit=30`);
      if (sequence !== latestSequence) return;
      const rows = Array.isArray(data.results) ? data.results : [];
      cache.set(key, rows);
      renderResults(rows);
    } catch (error) {
      if (String(error?.name) === 'AbortError') return;
      results.innerHTML = '<div class="catalog-empty">Kërkimi nuk u përfundua. Provo përsëri.</div>';
    }
  }

  function renderResults(rows) {
    const container = document.querySelector('#catalogResults');
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = '<div class="catalog-empty">Nuk u gjet produkt në pilotin aktual. Importi i plotë do ta zgjerojë katalogun.</div>';
      return;
    }
    container.innerHTML = rows.map((row) => `
      <button class="catalog-result" type="button" data-catalog-product="${escapeHTML(row.id)}">
        <span><h3>${escapeHTML(row.trade_name)}</h3><p>${escapeHTML(row.active_substance)} · ${escapeHTML(row.strength_text)} · ${escapeHTML(row.pharmaceutical_form)}</p><small>${escapeHTML(row.marketing_authorization_holder || 'Bartësi në verifikim')} · ${escapeHTML(row.ma_certificate || 'Pa certifikatë')}</small></span>
        <span class="catalog-result-side"><span class="catalog-code">${escapeHTML(row.atc_code || 'ATC')}</span><span class="catalog-badge">Vlefshëm</span>${row.retail_price != null ? `<span class="catalog-price">€${Number(row.retail_price).toFixed(2)}</span>` : ''}</span>
      </button>`).join('');
  }

  async function openProductDetail(id) {
    const previousBody = document.querySelector('#modalBody')?.innerHTML || '';
    const modalBody = document.querySelector('#modalBody');
    if (modalBody) modalBody.innerHTML = '<div class="catalog-empty">Duke hapur produktin…</div>';
    try {
      const row = await fetchJSON(`${API_URL}?mode=detail&id=${encodeURIComponent(id)}`);
      window.openModal?.({
        title: row.trade_name,
        subtitle: `${row.active_substance} · ${row.atc_code}`,
        kicker: 'PRODUKT MEDICINAL',
        body: `<div class="catalog-detail"><section class="catalog-detail-header"><h3>${escapeHTML(row.trade_name)}</h3><p>${escapeHTML(row.active_substance)} · ${escapeHTML(row.strength_text)} · ${escapeHTML(row.pharmaceutical_form)}</p></section><div class="catalog-detail-grid"><div><span>ATC</span><strong>${escapeHTML(row.atc_code)}</strong></div><div><span>Statusi</span><strong>${escapeHTML(row.product_status || '—')}</strong></div><div><span>Paketimi</span><strong>${escapeHTML(row.package_size || '—')}</strong></div><div><span>Certifikata MA</span><strong>${escapeHTML(row.ma_certificate || '—')}</strong></div><div><span>Bartësi</span><strong>${escapeHTML(row.marketing_authorization_holder || '—')}</strong></div><div><span>Prodhuesi</span><strong>${escapeHTML(row.manufacturer || '—')}</strong></div><div><span>Vlefshmëria</span><strong>${escapeHTML(row.valid_from || '—')} – ${escapeHTML(row.valid_to || '—')}</strong></div><div><span>Çmimi me pakicë</span><strong>${row.retail_price != null ? `€${Number(row.retail_price).toFixed(2)}` : '—'}</strong></div></div><div class="catalog-note">Burimi: ${escapeHTML(row.source_title || 'Lista zyrtare')} · Versioni ${escapeHTML(row.version_label || '1.1')}. Për përdorim klinik verifiko indikacionin, dozën, SPC-në dhe karakteristikat e pacientit.</div></div>`,
      });
    } catch {
      if (modalBody) modalBody.innerHTML = previousBody;
      toast('Produkti nuk u hap.');
    }
  }

  function handleClick(event) {
    const launch = event.target.closest('[data-product-catalog]');
    if (launch) {
      event.preventDefault();
      openCatalog();
      return;
    }
    const product = event.target.closest('[data-catalog-product]');
    if (product) openProductDetail(product.dataset.catalogProduct);
  }

  function start() {
    injectStyles();
    injectNavigation();
    injectLaunchCard();
    document.addEventListener('click', handleClick);
    window.DozaKSProductCatalog = { open: openCatalog, search: searchProducts };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
