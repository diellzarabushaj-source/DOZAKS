'use strict';

(() => {
  const CATALOG_API = '/api/product-catalog';
  const SAFETY_API = '/api/protocol-safety';
  const FILTER_KEY = 'dozaks-catalog-filters-v1';
  const PROTOCOL_KEY = 'dozaks-personal-protocols-v3';
  const COMPARE_KEY = 'dozaks-product-comparison-v1';
  const MAX_COMPARE = 4;
  const MAX_PROTOCOL_VERSIONS = 20;

  const defaultFilters = {
    atc: '',
    form: '',
    status: '',
    manufacturer: '',
    authorizationHolder: '',
    drugId: '',
  };

  let filters = readJSON(FILTER_KEY, defaultFilters);
  let nativeFetch = window.fetch.bind(window);
  let facetsLoaded = false;
  let currentProductCache = new Map();
  let latestSearchTotal = null;

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);

  const normalize = (value = '') => String(value)
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? structuredClone(fallback);
    } catch {
      return structuredClone(fallback);
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function createId(prefix = 'item') {
    return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function toast(message) {
    window.showToast?.(message);
  }

  function activeFilterCount() {
    return Object.values(filters).filter(Boolean).length;
  }

  function currentSelection() {
    try {
      const history = readJSON('dozaks-history', []);
      const latest = history[0];
      if (!latest?.id) return null;
      const raw = String(latest.id);
      if (raw.startsWith('product:')) return { type: 'product', id: raw.slice(8), name: latest.name || '' };
      if (raw.startsWith('drug:')) return { type: 'drug', id: raw.slice(5), name: latest.name || '' };
      return null;
    } catch {
      return null;
    }
  }

  function patchCatalogFetch() {
    if (window.__dozaksCatalogFetchPatched) return;
    window.__dozaksCatalogFetchPatched = true;

    window.fetch = async (input, init) => {
      const sourceUrl = typeof input === 'string' ? input : input?.url;
      if (!sourceUrl) return nativeFetch(input, init);

      let url;
      try {
        url = new URL(sourceUrl, location.href);
      } catch {
        return nativeFetch(input, init);
      }

      const isCatalogSearch = url.origin === location.origin
        && url.pathname === CATALOG_API
        && (!url.searchParams.get('mode') || url.searchParams.get('mode') === 'search');

      if (isCatalogSearch) {
        for (const [key, value] of Object.entries(filters)) {
          if (value) url.searchParams.set(key, value);
          else url.searchParams.delete(key);
        }
      }

      const requestInput = typeof input === 'string'
        ? url.toString()
        : new Request(url.toString(), input);
      const response = await nativeFetch(requestInput, init);

      if (isCatalogSearch && response.ok) {
        response.clone().json().then((data) => {
          latestSearchTotal = Number.isFinite(Number(data.total)) ? Number(data.total) : null;
          updateFilterSummary();
        }).catch(() => {});
      }
      return response;
    };
  }

  function injectStyles() {
    if (document.querySelector('#clinicalWorkbenchStyles')) return;
    const style = document.createElement('style');
    style.id = 'clinicalWorkbenchStyles';
    style.textContent = `
      .catalog-filter-toggle{display:inline-flex;min-height:48px;align-items:center;gap:8px;padding:0 14px;border:1px solid rgba(255,255,255,.25);border-radius:10px;background:rgba(255,255,255,.1);color:#fff;font-weight:850;white-space:nowrap}
      .catalog-filter-toggle:hover,.catalog-filter-toggle.active{background:#fff;color:#123b70}.catalog-filter-toggle b{display:grid;min-width:20px;height:20px;place-items:center;border-radius:999px;background:#2b7af0;color:#fff;font-size:9px}
      .catalog-filter-panel{display:none;margin:10px 0 8px;padding:14px;border:1px solid #cbd9ea;border-radius:13px;background:#f8fbff;box-shadow:0 12px 34px rgba(12,43,82,.08)}
      .catalog-filter-panel.open{display:block}.catalog-filter-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}.catalog-filter-head span{display:block;color:#1559ae;font-size:9px;font-weight:950;letter-spacing:.085em}.catalog-filter-head h3{margin:3px 0 0;font-size:16px}.catalog-filter-head button{padding:7px 9px;border:0;background:none;color:#1559ae;font-size:10px;font-weight:850}
      .catalog-filter-grid{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:10px}.catalog-filter-grid label{display:grid;gap:5px;color:#536079;font-size:10px;font-weight:800}.catalog-filter-grid select{min-height:42px;padding:8px 10px;border:1px solid #c9d5e5;border-radius:9px;background:#fff;color:#17263b}
      .catalog-filter-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}.catalog-filter-chips{display:flex;gap:6px;flex-wrap:wrap}.catalog-filter-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid #c9dbf4;border-radius:999px;background:#fff;color:#1c568f;font-size:9px;font-weight:800}.catalog-filter-chip button{border:0;background:none;color:#6d7f95;font-size:12px}.catalog-result-summary{color:#5d6d82;font-size:10px;font-weight:750}
      .clinical-card-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:13px 0;padding:10px;border:1px solid #d7e2ef;border-radius:11px;background:#f8fafc}.clinical-card-actions button{display:inline-flex;min-height:38px;align-items:center;gap:7px;padding:8px 11px;border:1px solid #cbd7e6;border-radius:9px;background:#fff;color:#28435f;font-size:10px;font-weight:850}.clinical-card-actions button.primary{border-color:#1664c0;background:#1664c0;color:#fff}.clinical-card-actions button:disabled{cursor:not-allowed;opacity:.48}.clinical-card-actions .selection-state{margin-left:auto;color:#69788c;font-size:9px;font-weight:750}
      .workbench-backdrop{position:fixed;inset:0;z-index:1500;background:rgba(5,19,39,.58);backdrop-filter:blur(3px)}.workbench-drawer{position:fixed;top:0;right:0;bottom:0;z-index:1501;display:flex;width:min(720px,100%);flex-direction:column;background:#f7f9fc;box-shadow:-20px 0 60px rgba(5,24,51,.25);animation:workbenchIn .18s ease-out}.workbench-drawer.wide{width:min(1050px,100%)}
      @keyframes workbenchIn{from{transform:translateX(24px);opacity:.7}to{transform:none;opacity:1}}.workbench-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px;border-bottom:1px solid #dce3ec;background:#fff}.workbench-kicker{display:block;color:#1559ae;font-size:9px;font-weight:950;letter-spacing:.09em}.workbench-header h2{margin:5px 0 4px;font-size:21px}.workbench-header p{margin:0;color:#69788c;font-size:11px;line-height:1.5}.workbench-close{display:grid;width:42px;height:42px;place-items:center;border:1px solid #d6dfeb;border-radius:11px;background:#f6f8fb;color:#24405f;font-size:20px}.workbench-body{flex:1;overflow:auto;padding:18px 22px 34px}.workbench-toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:14px}.workbench-toolbar button,.workbench-button{min-height:40px;padding:9px 12px;border:1px solid #ccd7e5;border-radius:9px;background:#fff;color:#28435f;font-size:10px;font-weight:850}.workbench-toolbar .primary,.workbench-button.primary{border-color:#1664c0;background:#1664c0;color:#fff}.workbench-button.danger{color:#a52a3b}.workbench-empty{padding:28px 15px;border:1px dashed #c8d4e4;border-radius:12px;background:#fff;text-align:center;color:#67768a;font-size:11px;line-height:1.6}
      .protocol-list{display:grid;gap:10px}.protocol-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;padding:15px;border:1px solid #d9e2ee;border-radius:12px;background:#fff}.protocol-card h3{margin:3px 0 5px;font-size:15px}.protocol-card p{margin:0;color:#68788d;font-size:10px;line-height:1.5}.protocol-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.protocol-pill{padding:4px 7px;border-radius:999px;background:#edf4ff;color:#1559ae;font-size:8px;font-weight:850}.protocol-pill.safe{background:#ecfdf3;color:#067647}.protocol-pill.warn{background:#fff4dd;color:#8a5b00}.protocol-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.protocol-actions button{padding:7px 9px;border:1px solid #d7e0eb;border-radius:8px;background:#fff;color:#29455f;font-size:9px;font-weight:850}
      .workbench-form{display:grid;gap:14px}.workbench-section{padding:15px;border:1px solid #d9e2ed;border-radius:12px;background:#fff}.workbench-section h3{margin:0 0 11px;font-size:14px}.workbench-section>p{margin:-4px 0 12px;color:#6c7b8f;font-size:10px;line-height:1.5}.workbench-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.workbench-grid .full{grid-column:1/-1}.workbench-grid label{display:grid;gap:5px;color:#536079;font-size:10px;font-weight:800}.workbench-grid input,.workbench-grid select,.workbench-grid textarea,.protocol-item input,.protocol-item textarea{width:100%;min-height:42px;padding:9px 10px;border:1px solid #cbd6e4;border-radius:9px;background:#fff;color:#17263b}.workbench-grid textarea,.protocol-item textarea{min-height:72px;resize:vertical}
      .protocol-items{display:grid;gap:10px}.protocol-item{padding:13px;border:1px solid #dce4ee;border-radius:11px;background:#fbfcfe}.protocol-item-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.protocol-item-head strong{display:block;font-size:12px}.protocol-item-head small{display:block;margin-top:3px;color:#6c7b8f;font-size:9px}.protocol-item-controls{display:flex;gap:5px}.protocol-item-controls button{padding:5px 7px;border:1px solid #d4deea;border-radius:7px;background:#fff;font-size:9px}.protocol-item-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.protocol-item-grid .full{grid-column:1/-1}.protocol-item-grid label{display:grid;gap:4px;color:#66758a;font-size:9px;font-weight:800}
      .safety-context-note{padding:10px 11px;border-left:3px solid #1664c0;border-radius:8px;background:#eef5ff;color:#36516f;font-size:10px;line-height:1.55}.safety-result{margin-top:14px;padding:13px;border:1px solid #d8e2ee;border-radius:11px;background:#fff}.safety-result.blocked{border-color:#f0b6c0;background:#fff6f7}.safety-result.warning,.safety-result.incomplete{border-color:#ecd39c;background:#fffaf0}.safety-result.clear{border-color:#a9dec9;background:#f4fdf9}.safety-result h3{margin:0 0 7px;font-size:14px}.safety-result p{margin:0;color:#506078;font-size:10px;line-height:1.55}.safety-findings{display:grid;gap:8px;margin-top:11px}.safety-finding{padding:10px;border:1px solid rgba(120,140,165,.25);border-radius:9px;background:rgba(255,255,255,.75)}.safety-finding strong{display:block;font-size:11px}.safety-finding small{display:block;margin-top:4px;color:#65758a;font-size:9px;line-height:1.5}
      .compare-table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #d8e1ec;border-radius:12px;background:#fff}.compare-table th,.compare-table td{padding:10px;border-right:1px solid #e3e8ef;border-bottom:1px solid #e3e8ef;text-align:left;vertical-align:top;font-size:10px}.compare-table th{background:#f5f8fc;color:#536079;font-size:9px}.compare-table tr:last-child td{border-bottom:0}.compare-table th:last-child,.compare-table td:last-child{border-right:0}.compare-product-name{font-size:12px;font-weight:900;color:#183a63}.compare-remove{margin-top:7px;padding:5px 7px;border:1px solid #d8e0ea;border-radius:7px;background:#fff;color:#a52a3b;font-size:8px;font-weight:850}
      @media(max-width:1000px){.catalog-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.protocol-item-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:650px){.search-row{flex-wrap:wrap}.catalog-filter-toggle{width:100%;justify-content:center}.catalog-filter-grid,.workbench-grid,.protocol-item-grid{grid-template-columns:1fr}.workbench-grid .full,.protocol-item-grid .full{grid-column:auto}.catalog-filter-foot,.protocol-card{align-items:stretch;grid-template-columns:1fr}.catalog-filter-foot{flex-direction:column}.clinical-card-actions .selection-state{width:100%;margin-left:0}.workbench-header,.workbench-body{padding-left:15px;padding-right:15px}.compare-table{display:block;overflow-x:auto}}
    `;
    document.head.appendChild(style);
  }

  function ensureFilterUI() {
    const searchRow = document.querySelector('.search-row');
    const filtersRow = document.querySelector('#filters');
    if (!searchRow || !filtersRow || document.querySelector('#catalogFilterToggle')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'catalogFilterToggle';
    button.className = 'catalog-filter-toggle';
    button.innerHTML = '<span>☷</span><span>Filtra profesionalë</span><b id="catalogFilterCount">0</b>';
    searchRow.appendChild(button);

    const panel = document.createElement('section');
    panel.id = 'catalogFilterPanel';
    panel.className = 'catalog-filter-panel';
    panel.innerHTML = `
      <div class="catalog-filter-head"><div><span>KATALOGU I BARNAVE</span><h3>Ngushto rezultatet pa humbur shpejtësinë</h3></div><button type="button" data-workbench-action="clear-filters">Pastro të gjitha</button></div>
      <div class="catalog-filter-grid">
        <label>Grupi ATC<select data-catalog-filter="atc"><option value="">Të gjitha grupet</option><option value="A">A · Trakti gastrointestinal</option><option value="B">B · Gjaku</option><option value="C">C · Kardiovaskular</option><option value="D">D · Dermatologjik</option><option value="G">G · Urogjenital</option><option value="H">H · Hormonet sistemike</option><option value="J">J · Antiinfektivët sistemikë</option><option value="L">L · Antineoplastikë/imunomodulues</option><option value="M">M · Muskuloskeletal</option><option value="N">N · Sistemi nervor</option><option value="P">P · Antiparazitarë</option><option value="R">R · Respirator</option><option value="S">S · Organet shqisore</option><option value="V">V · Të ndryshme</option></select></label>
        <label>Forma farmaceutike<select data-catalog-filter="form"><option value="">Të gjitha format</option></select></label>
        <label>Statusi i produktit<select data-catalog-filter="status"><option value="">Të gjitha statuset</option></select></label>
        <label>Prodhuesi<select data-catalog-filter="manufacturer"><option value="">Të gjithë prodhuesit</option></select></label>
        <label>Bartësi i autorizimit<select data-catalog-filter="authorizationHolder"><option value="">Të gjithë bartësit</option></select></label>
      </div>
      <div class="catalog-filter-foot"><div class="catalog-filter-chips" id="catalogFilterChips"></div><div class="catalog-result-summary" id="catalogResultSummary">Pa filtra aktivë</div></div>`;
    filtersRow.insertAdjacentElement('afterend', panel);

    button.addEventListener('click', () => {
      panel.classList.toggle('open');
      button.classList.toggle('active', panel.classList.contains('open'));
      button.setAttribute('aria-expanded', String(panel.classList.contains('open')));
      if (panel.classList.contains('open')) loadFacets();
    });

    panel.querySelectorAll('[data-catalog-filter]').forEach((select) => {
      select.value = filters[select.dataset.catalogFilter] || '';
      select.addEventListener('change', () => {
        filters[select.dataset.catalogFilter] = select.value;
        saveFiltersAndRefresh();
      });
    });
    updateFilterSummary();
  }

  async function loadFacets() {
    if (facetsLoaded) return;
    const query = document.querySelector('#searchInput')?.value.trim() || '';
    try {
      const response = await nativeFetch(`${CATALOG_API}?mode=facets&q=${encodeURIComponent(query)}`, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      fillFacet('form', data.forms);
      fillFacet('status', data.statuses);
      fillFacet('manufacturer', data.manufacturers);
      fillFacet('authorizationHolder', data.authorizationHolders);
      facetsLoaded = true;
    } catch {
      toast('Facetet do të ngarkohen sapo API-ja e Vercel-it të jetë aktive.');
    }
  }

  function fillFacet(name, rows = []) {
    const select = document.querySelector(`[data-catalog-filter="${name}"]`);
    if (!select) return;
    const current = filters[name] || '';
    const first = select.options[0]?.outerHTML || '<option value="">Të gjitha</option>';
    select.innerHTML = first + rows
      .filter((row) => row?.value)
      .map((row) => `<option value="${escapeHTML(row.value)}">${escapeHTML(row.value)}${row.count != null ? ` (${Number(row.count).toLocaleString('sq-AL')})` : ''}</option>`)
      .join('');
    select.value = current;
  }

  function saveFiltersAndRefresh() {
    writeJSON(FILTER_KEY, filters);
    updateFilterSummary();
    const input = document.querySelector('#searchInput');
    const query = input?.value.trim() || '';
    if (query.length >= 2) {
      window.DozaKSProductCatalog?.search?.(query, { force: true, showLoading: true });
      input?.focus();
    }
  }

  function clearFilters() {
    filters = structuredClone(defaultFilters);
    writeJSON(FILTER_KEY, filters);
    document.querySelectorAll('[data-catalog-filter]').forEach((select) => { select.value = ''; });
    saveFiltersAndRefresh();
  }

  function removeFilter(name) {
    filters[name] = '';
    const select = document.querySelector(`[data-catalog-filter="${name}"]`);
    if (select) select.value = '';
    saveFiltersAndRefresh();
  }

  function updateFilterSummary() {
    const count = activeFilterCount();
    const badge = document.querySelector('#catalogFilterCount');
    const button = document.querySelector('#catalogFilterToggle');
    const chips = document.querySelector('#catalogFilterChips');
    const summary = document.querySelector('#catalogResultSummary');
    if (badge) badge.textContent = String(count);
    button?.classList.toggle('active', count > 0 || document.querySelector('#catalogFilterPanel')?.classList.contains('open'));

    const labels = {
      atc: 'ATC', form: 'Forma', status: 'Statusi', manufacturer: 'Prodhuesi', authorizationHolder: 'Bartësi', drugId: 'I njëjti bar',
    };
    if (chips) {
      chips.innerHTML = Object.entries(filters).filter(([, value]) => value).map(([name, value]) => `
        <span class="catalog-filter-chip">${escapeHTML(labels[name] || name)}: ${escapeHTML(name === 'drugId' ? 'aktiv' : value)}<button type="button" data-remove-filter="${escapeHTML(name)}" aria-label="Hiq filtrin">×</button></span>`).join('');
    }
    if (summary) {
      const total = latestSearchTotal == null ? '' : ` · ${latestSearchTotal.toLocaleString('sq-AL')} rezultate`;
      summary.textContent = count ? `${count} filtra aktivë${total}` : `Pa filtra aktivë${total}`;
    }
  }

  function ensureNavigation() {
    const nav = document.querySelector('#sidebar nav');
    if (!nav || nav.querySelector('[data-workbench-nav]')) return;
    const label = document.createElement('div');
    label.className = 'nav-label';
    label.dataset.workbenchNav = 'label';
    label.textContent = 'HAPËSIRA PERSONALE';
    const protocols = document.createElement('button');
    protocols.type = 'button';
    protocols.className = 'nav-item';
    protocols.dataset.workbenchNav = 'protocols';
    protocols.innerHTML = '<span class="nav-icon">▣</span><span>Protokollet e mia</span>';
    const compare = document.createElement('button');
    compare.type = 'button';
    compare.className = 'nav-item';
    compare.dataset.workbenchNav = 'compare';
    compare.innerHTML = '<span class="nav-icon">⇆</span><span>Krahaso produktet</span>';
    nav.append(label, protocols, compare);
  }

  function ensureCardActions() {
    const strip = document.querySelector('#drugPanel .clinical-summary-strip');
    if (!strip || document.querySelector('#clinicalCardActions')) return;
    const actions = document.createElement('div');
    actions.id = 'clinicalCardActions';
    actions.className = 'clinical-card-actions';
    actions.innerHTML = `
      <button class="primary" type="button" data-workbench-action="add-to-protocol">＋ Shto në protokoll</button>
      <button type="button" data-workbench-action="compare-current">⇆ Krahaso</button>
      <button type="button" data-workbench-action="same-drug">≡ Vetëm produktet e këtij bari</button>
      <button type="button" data-workbench-action="open-protocols">▣ Protokollet e mia</button>
      <span class="selection-state" id="clinicalSelectionState">Zgjidh një produkt nga katalogu.</span>`;
    strip.insertAdjacentElement('afterend', actions);
    syncCardActions();
  }

  function syncCardActions() {
    const selection = currentSelection();
    const add = document.querySelector('[data-workbench-action="add-to-protocol"]');
    const compare = document.querySelector('[data-workbench-action="compare-current"]');
    const sameDrug = document.querySelector('[data-workbench-action="same-drug"]');
    const label = document.querySelector('#clinicalSelectionState');
    const isProduct = selection?.type === 'product';
    const isDrug = selection?.type === 'drug';
    if (add) add.disabled = !isProduct;
    if (compare) compare.disabled = !isProduct;
    if (sameDrug) sameDrug.disabled = !selection;
    if (label) {
      label.textContent = isProduct
        ? `Produkti aktiv: ${selection.name}`
        : isDrug
          ? `Bari aktiv: ${selection.name} · zgjidh një produkt tregtar për protokoll`
          : 'Zgjidh një produkt nga katalogu.';
    }
  }

  function createDrawer({ kicker = 'DOZAKS', title, subtitle = '', content = '', wide = false }) {
    closeDrawer();
    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'workbench-backdrop';
    backdrop.setAttribute('aria-label', 'Mbyll panelin');
    const drawer = document.createElement('section');
    drawer.id = 'workbenchDrawer';
    drawer.className = `workbench-drawer${wide ? ' wide' : ''}`;
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.innerHTML = `
      <header class="workbench-header"><div><span class="workbench-kicker">${escapeHTML(kicker)}</span><h2>${escapeHTML(title)}</h2><p>${escapeHTML(subtitle)}</p></div><button class="workbench-close" type="button" data-workbench-action="close" aria-label="Mbyll">×</button></header>
      <div class="workbench-body">${content}</div>`;
    backdrop.addEventListener('click', closeDrawer);
    document.body.append(backdrop, drawer);
    document.body.style.overflow = 'hidden';
    setTimeout(() => drawer.querySelector('button, input, select, textarea')?.focus(), 0);
    return drawer;
  }

  function closeDrawer() {
    document.querySelector('.workbench-backdrop')?.remove();
    document.querySelector('#workbenchDrawer')?.remove();
    document.body.style.overflow = '';
  }

  function protocols() {
    return readJSON(PROTOCOL_KEY, []);
  }

  function saveProtocols(rows) {
    writeJSON(PROTOCOL_KEY, rows);
    updateProtocolCount();
  }

  function updateProtocolCount() {
    const count = protocols().filter((row) => !row.archivedAt).length;
    document.querySelectorAll('[data-protocol-count]').forEach((node) => { node.textContent = String(count); });
  }

  function openProtocols() {
    const rows = protocols().filter((row) => !row.archivedAt).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    createDrawer({
      kicker: 'HAPËSIRA PERSONALE',
      title: 'Protokollet e mia',
      subtitle: 'Vetëm produktet nga katalogu zyrtar. Draftet ruhen në këtë pajisje dhe mund të editohen kurdo.',
      content: `
        <div class="workbench-toolbar"><button class="primary" type="button" data-workbench-action="new-protocol">＋ Protokoll i ri</button><button type="button" data-workbench-action="import-protocol">Importo JSON</button><span class="protocol-pill"><b data-protocol-count>${rows.length}</b> protokolle</span></div>
        <div class="protocol-list">${rows.length ? rows.map(protocolCardHTML).join('') : '<div class="workbench-empty"><strong>Nuk ke ende protokoll personal.</strong><br>Krijoje të parin dhe shto vetëm produktet që zgjedh nga katalogu i Kosovës.</div>'}</div>
        <input id="protocolImportInput" type="file" accept="application/json" hidden>`,
    });
  }

  function protocolCardHTML(protocol) {
    const safety = protocol.lastSafety?.status || 'not-checked';
    const safetyLabel = ({ clear: 'Kontrolluar', warning: 'Kërkon rishikim', blocked: 'I bllokuar', incomplete: 'Mbulim i paplotë' })[safety] || 'Pa kontroll';
    const safetyClass = safety === 'clear' ? 'safe' : safety === 'not-checked' ? '' : 'warn';
    return `<article class="protocol-card">
      <div><span class="workbench-kicker">VERSIONI ${Number(protocol.currentVersion || 1)}</span><h3>${escapeHTML(protocol.title)}</h3><p>${escapeHTML([protocol.icdCode, protocol.clinicalContext, `${(protocol.items || []).length} produkte`].filter(Boolean).join(' · '))}</p><div class="protocol-meta"><span class="protocol-pill">Private</span><span class="protocol-pill ${safetyClass}">${escapeHTML(safetyLabel)}</span>${protocol.aiAssisted ? '<span class="protocol-pill">AI-assisted</span>' : ''}</div></div>
      <div class="protocol-actions"><button type="button" data-protocol-action="edit" data-id="${escapeHTML(protocol.id)}">Hap</button><button type="button" data-protocol-action="safety" data-id="${escapeHTML(protocol.id)}">Siguria</button><button type="button" data-protocol-action="export" data-id="${escapeHTML(protocol.id)}">Eksporto</button><button type="button" data-protocol-action="archive" data-id="${escapeHTML(protocol.id)}">Arkivo</button></div>
    </article>`;
  }

  function openNewProtocol(prefillProduct = null) {
    const id = createId('protocol');
    const now = new Date().toISOString();
    const protocol = {
      id,
      title: '',
      description: '',
      icdCode: '',
      clinicalContext: 'Ambulancë',
      status: 'draft',
      currentVersion: 1,
      aiAssisted: false,
      items: prefillProduct ? [productToProtocolItem(prefillProduct)] : [],
      versions: [],
      createdAt: now,
      updatedAt: now,
    };
    openProtocolEditor(protocol, true);
  }

  function openProtocolEditor(protocolOrId, isNew = false) {
    const protocol = typeof protocolOrId === 'string'
      ? protocols().find((row) => row.id === protocolOrId)
      : protocolOrId;
    if (!protocol) return;

    createDrawer({
      kicker: 'PROTOKOLL PERSONAL',
      title: isNew ? 'Krijo protokoll' : protocol.title,
      subtitle: 'Zgjidh dhe edito vetëm produktet që figurojnë në katalog. Dozat mbeten përgjegjësi klinike dhe kërkojnë burim.',
      wide: true,
      content: `
        <form class="workbench-form" id="protocolEditorForm" data-protocol-id="${escapeHTML(protocol.id)}">
          <section class="workbench-section"><h3>1. Identiteti i protokollit</h3><div class="workbench-grid">
            <label class="full">Titulli<input id="protocolTitle" required maxlength="140" value="${escapeHTML(protocol.title)}" placeholder="P.sh. Menaxhimi fillestar i dhimbjes së barkut"></label>
            <label>Kodi ICD<input id="protocolIcd" value="${escapeHTML(protocol.icdCode || '')}" placeholder="P.sh. R10.4"></label>
            <label>Konteksti<select id="protocolContext">${['Ambulancë','Urgjencë','Spital','Kujdes shtëpiak'].map((value) => `<option ${value === protocol.clinicalContext ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
            <label class="full">Përshkrimi<textarea id="protocolDescription" placeholder="Qëllimi, kriteret e përfshirjes dhe kur nuk duhet përdorur…">${escapeHTML(protocol.description || '')}</textarea></label>
          </div></section>
          <section class="workbench-section"><h3>2. Produktet e zgjedhura</h3><p>Çdo produkt ruhet me ID-në e katalogut. As Gemini dhe as përdoruesi nuk mund të shtojnë një produkt jashtë databazës.</p><div class="protocol-items" id="protocolItems">${renderProtocolItems(protocol.items || [])}</div></section>
          <section class="workbench-section"><h3>3. Kontrolli dhe versionimi</h3><div class="workbench-toolbar"><button type="button" data-protocol-action="check-current" data-id="${escapeHTML(protocol.id)}">⚠ Kontrollo kundërindikacionet</button><button type="button" data-protocol-action="versions" data-id="${escapeHTML(protocol.id)}">◴ Versionet</button><span class="protocol-pill">Versioni ${Number(protocol.currentVersion || 1)}</span></div><div id="inlineSafetyResult"></div></section>
          <div class="workbench-toolbar"><button class="primary" type="submit">Ruaj ndryshimet</button><button type="button" data-workbench-action="open-protocols">Kthehu te lista</button></div>
        </form>`,
    });

    const form = document.querySelector('#protocolEditorForm');
    form?.addEventListener('submit', (event) => saveProtocolEditor(event, protocol, isNew));
  }

  function renderProtocolItems(items) {
    if (!items.length) return '<div class="workbench-empty">Nuk ka produkte. Hape një produkt nga katalogu dhe zgjidh “Shto në protokoll”.</div>';
    return items.map((item, index) => `
      <article class="protocol-item" data-protocol-item="${escapeHTML(item.productId)}">
        <div class="protocol-item-head"><div><strong>${escapeHTML(item.tradeName || 'Produkt')}</strong><small>${escapeHTML([item.activeSubstance, item.strength, item.form, item.atcCode].filter(Boolean).join(' · '))}</small></div><div class="protocol-item-controls"><button type="button" data-item-action="up" data-index="${index}">↑</button><button type="button" data-item-action="down" data-index="${index}">↓</button><button type="button" data-item-action="remove" data-index="${index}">Hiq</button></div></div>
        <div class="protocol-item-grid">
          <label>Indikacioni<input data-item-field="indication" value="${escapeHTML(item.indication || '')}"></label>
          <label>Doza<input data-item-field="dose" value="${escapeHTML(item.dose || '')}" placeholder="Nga burim i verifikuar"></label>
          <label>Rruga<input data-item-field="route" value="${escapeHTML(item.route || '')}"></label>
          <label>Frekuenca<input data-item-field="frequency" value="${escapeHTML(item.frequency || '')}"></label>
          <label>Kohëzgjatja<input data-item-field="duration" value="${escapeHTML(item.duration || '')}"></label>
          <label>Opsional<select data-item-field="optional"><option value="false" ${!item.optional ? 'selected' : ''}>Jo</option><option value="true" ${item.optional ? 'selected' : ''}>Po</option></select></label>
          <label class="full">Udhëzime / siguria<textarea data-item-field="instructions">${escapeHTML(item.instructions || '')}</textarea></label>
        </div>
      </article>`).join('');
  }

  function collectEditorItems() {
    return [...document.querySelectorAll('[data-protocol-item]')].map((node) => {
      const productId = node.dataset.protocolItem;
      const existing = currentEditorProtocol()?.items?.find((item) => item.productId === productId) || {};
      const value = (field) => node.querySelector(`[data-item-field="${field}"]`)?.value.trim() || '';
      return {
        ...existing,
        productId,
        indication: value('indication'),
        dose: value('dose'),
        route: value('route'),
        frequency: value('frequency'),
        duration: value('duration'),
        optional: value('optional') === 'true',
        instructions: value('instructions'),
      };
    });
  }

  function currentEditorProtocol() {
    const id = document.querySelector('#protocolEditorForm')?.dataset.protocolId;
    return protocols().find((row) => row.id === id) || null;
  }

  function saveProtocolEditor(event, original, isNew) {
    event.preventDefault();
    const title = document.querySelector('#protocolTitle')?.value.trim() || '';
    if (!title) return toast('Shkruaj titullin e protokollit.');
    const rows = protocols();
    const previous = rows.find((row) => row.id === original.id);
    const items = collectEditorItems();
    const now = new Date().toISOString();
    const next = {
      ...original,
      title,
      icdCode: document.querySelector('#protocolIcd')?.value.trim() || '',
      clinicalContext: document.querySelector('#protocolContext')?.value || 'Ambulancë',
      description: document.querySelector('#protocolDescription')?.value.trim() || '',
      items,
      currentVersion: previous ? Number(previous.currentVersion || 1) + 1 : 1,
      updatedAt: now,
    };
    const snapshot = {
      version: next.currentVersion,
      savedAt: now,
      title: next.title,
      icdCode: next.icdCode,
      clinicalContext: next.clinicalContext,
      description: next.description,
      items: next.items,
    };
    next.versions = [...(previous?.versions || original.versions || []), snapshot].slice(-MAX_PROTOCOL_VERSIONS);
    saveProtocols([next, ...rows.filter((row) => row.id !== next.id)]);
    toast(isNew ? 'Protokolli u krijua.' : 'Protokolli u ruajt si version i ri.');
    openProtocolEditor(next.id);
  }

  function productToProtocolItem(product) {
    return {
      productId: String(product.id),
      drugId: String(product.drug_id || ''),
      tradeName: product.trade_name || '',
      activeSubstance: product.active_substance || product.generic_name || '',
      atcCode: product.atc_code || '',
      strength: product.strength_text || '',
      form: product.pharmaceutical_form || '',
      packageSize: product.package_size || '',
      indication: '', dose: '', route: '', frequency: '', duration: '', instructions: '', optional: false,
    };
  }

  async function fetchProduct(id) {
    const productId = String(id || '').replace(/^product:/, '');
    if (currentProductCache.has(productId)) return currentProductCache.get(productId);
    const response = await nativeFetch(`${CATALOG_API}?mode=detail&id=${encodeURIComponent(productId)}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const row = await response.json();
    currentProductCache.set(productId, row);
    return row;
  }

  async function addCurrentProduct() {
    const selection = currentSelection();
    if (!selection || selection.type !== 'product') return toast('Zgjidh së pari një produkt tregtar nga katalogu.');
    let product;
    try {
      product = await fetchProduct(selection.id);
    } catch {
      return toast('Produkti nuk u ngarkua.');
    }
    const rows = protocols().filter((row) => !row.archivedAt);
    if (!rows.length) return openNewProtocol(product);

    createDrawer({
      kicker: 'SHTO NË PROTOKOLL',
      title: product.trade_name,
      subtitle: [product.active_substance, product.strength_text, product.pharmaceutical_form].filter(Boolean).join(' · '),
      content: `<div class="protocol-list">${rows.map((protocol) => `<button class="protocol-card" type="button" data-add-product-to-protocol="${escapeHTML(protocol.id)}" data-product-id="${escapeHTML(product.id)}"><div><h3>${escapeHTML(protocol.title)}</h3><p>${(protocol.items || []).length} produkte · ${escapeHTML(protocol.icdCode || 'pa ICD')}</p></div><span>＋</span></button>`).join('')}</div><div class="workbench-toolbar"><button type="button" data-workbench-action="new-protocol-with-product" data-product-id="${escapeHTML(product.id)}">Krijo protokoll të ri</button></div>`,
    });
  }

  async function addProductToProtocol(protocolId, productId) {
    const product = await fetchProduct(productId);
    const rows = protocols();
    const protocol = rows.find((row) => row.id === protocolId);
    if (!protocol) return;
    if ((protocol.items || []).some((item) => item.productId === String(product.id))) {
      toast('Ky produkt është tashmë në protokoll.');
      return openProtocolEditor(protocolId);
    }
    protocol.items = [...(protocol.items || []), productToProtocolItem(product)];
    protocol.updatedAt = new Date().toISOString();
    saveProtocols(rows);
    toast(`${product.trade_name} u shtua në protokoll.`);
    openProtocolEditor(protocolId);
  }

  function moveProtocolItem(index, direction) {
    const protocol = currentEditorProtocol();
    if (!protocol) return;
    const items = collectEditorItems();
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    protocol.items = items;
    document.querySelector('#protocolItems').innerHTML = renderProtocolItems(items);
  }

  function removeProtocolItem(index) {
    const protocol = currentEditorProtocol();
    if (!protocol) return;
    const items = collectEditorItems();
    items.splice(index, 1);
    protocol.items = items;
    document.querySelector('#protocolItems').innerHTML = renderProtocolItems(items);
  }

  function archiveProtocol(id) {
    const rows = protocols();
    const protocol = rows.find((row) => row.id === id);
    if (!protocol || !confirm(`Ta arkivoj protokollin “${protocol.title}”?`)) return;
    protocol.archivedAt = new Date().toISOString();
    saveProtocols(rows);
    openProtocols();
  }

  function exportProtocol(id) {
    const protocol = protocols().find((row) => row.id === id);
    if (!protocol) return;
    const blob = new Blob([JSON.stringify(protocol, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${normalize(protocol.title).replace(/[^a-z0-9]+/g, '-') || 'dozaks-protokoll'}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function importProtocol(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const protocol = JSON.parse(reader.result);
        if (!protocol?.title || !Array.isArray(protocol.items)) throw new Error('Invalid protocol');
        const validItems = protocol.items.filter((item) => item?.productId && item?.tradeName);
        const now = new Date().toISOString();
        const imported = { ...protocol, id: createId('protocol'), items: validItems, status: 'draft', importedAt: now, createdAt: now, updatedAt: now };
        saveProtocols([imported, ...protocols()]);
        toast('Protokolli u importua si draft i ri.');
        openProtocols();
      } catch {
        toast('Skedari nuk është protokoll valid DozaKS.');
      }
    };
    reader.readAsText(file);
  }

  function openVersions(id) {
    const protocol = protocols().find((row) => row.id === id);
    if (!protocol) return;
    const versions = [...(protocol.versions || [])].reverse();
    createDrawer({
      kicker: 'HISTORIKU',
      title: `Versionet · ${protocol.title}`,
      subtitle: 'Çdo ruajtje krijon një version. Rikthimi krijon një version të ri dhe nuk fshin historikun.',
      content: `<div class="protocol-list">${versions.length ? versions.map((version) => `<article class="protocol-card"><div><h3>Versioni ${version.version}</h3><p>${new Date(version.savedAt).toLocaleString('sq-AL')} · ${(version.items || []).length} produkte</p></div><div class="protocol-actions"><button type="button" data-restore-version="${version.version}" data-id="${escapeHTML(protocol.id)}">Rikthe</button></div></article>`).join('') : '<div class="workbench-empty">Nuk ka ende versione të ruajtura.</div>'}</div>`,
    });
  }

  function restoreVersion(protocolId, versionNumber) {
    const rows = protocols();
    const protocol = rows.find((row) => row.id === protocolId);
    const version = protocol?.versions?.find((row) => Number(row.version) === Number(versionNumber));
    if (!protocol || !version) return;
    Object.assign(protocol, {
      title: version.title,
      icdCode: version.icdCode,
      clinicalContext: version.clinicalContext,
      description: version.description,
      items: version.items,
      currentVersion: Number(protocol.currentVersion || 1) + 1,
      updatedAt: new Date().toISOString(),
    });
    saveProtocols(rows);
    toast(`Versioni ${versionNumber} u rikthye si version i ri.`);
    openProtocolEditor(protocolId);
  }

  function openSafetyCheck(protocolId, inline = false) {
    const protocol = protocols().find((row) => row.id === protocolId) || currentEditorProtocol();
    if (!protocol) return;
    const form = `
      <form class="workbench-form" id="protocolSafetyForm" data-protocol-id="${escapeHTML(protocol.id)}">
        <div class="safety-context-note"><strong>Pa të dhëna identifikuese.</strong> Vendos vetëm faktorët klinikë që ndikojnë në siguri. Emri, emaili, telefoni dhe numrat personalë refuzohen nga backend-i.</div>
        <section class="workbench-section"><div class="workbench-grid">
          <label>Mosha<input id="safetyAge" type="number" min="0" max="130" placeholder="Vite"></label>
          <label>eGFR<input id="safetyEgfr" type="number" min="0" max="200" placeholder="mL/min/1.73m²"></label>
          <label>Statusi hepatik<select id="safetyHepatic"><option value="">Pa të dhëna</option><option value="mild">I lehtë</option><option value="moderate">I moderuar</option><option value="severe">I rëndë</option></select></label>
          <label>Shtatzënia<select id="safetyPregnancy"><option value="false">Jo / nuk aplikohet</option><option value="true">Po</option></select></label>
          <label>Gjidhënia<select id="safetyBreastfeeding"><option value="false">Jo / nuk aplikohet</option><option value="true">Po</option></select></label>
          <label>Alergjitë<input id="safetyAllergies" placeholder="P.sh. penicillin, sulfonamide"></label>
          <label class="full">Diagnozat / gjendjet<input id="safetyDiagnoses" value="${escapeHTML(protocol.icdCode || '')}" placeholder="Kode ICD ose terma, të ndara me presje"></label>
        </div></section>
        <div class="workbench-toolbar"><button class="primary" type="submit">Kontrollo ${(protocol.items || []).length} produkte</button></div>
      </form><div id="safetyResult"></div>`;

    if (inline) {
      const target = document.querySelector('#inlineSafetyResult');
      if (target) target.innerHTML = form;
    } else {
      createDrawer({ kicker: 'MOTORI I SIGURISË', title: `Kontrollo · ${protocol.title}`, subtitle: 'Kontrolli përdor vetëm kundërindikacionet e publikuara dhe raporton qartë mbulimin e paplotë.', content: form });
    }
    document.querySelector('#protocolSafetyForm')?.addEventListener('submit', runSafetyCheck);
  }

  async function runSafetyCheck(event) {
    event.preventDefault();
    const protocolId = event.currentTarget.dataset.protocolId;
    const rows = protocols();
    const protocol = rows.find((row) => row.id === protocolId);
    if (!protocol?.items?.length) return toast('Protokolli nuk ka produkte.');
    const context = {
      ageYears: numberOrNull(document.querySelector('#safetyAge')?.value),
      eGfr: numberOrNull(document.querySelector('#safetyEgfr')?.value),
      hepaticStatus: document.querySelector('#safetyHepatic')?.value || '',
      pregnancy: document.querySelector('#safetyPregnancy')?.value === 'true',
      breastfeeding: document.querySelector('#safetyBreastfeeding')?.value === 'true',
      allergies: splitValues(document.querySelector('#safetyAllergies')?.value),
      diagnoses: splitValues(document.querySelector('#safetyDiagnoses')?.value),
    };
    const resultNode = document.querySelector('#safetyResult') || document.querySelector('#inlineSafetyResult');
    if (resultNode) resultNode.innerHTML = '<div class="workbench-empty">Duke kontrolluar rregullat e publikuara…</div>';
    try {
      const response = await nativeFetch(SAFETY_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ selectedProductIds: protocol.items.map((item) => item.productId), patientContext: context }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `API ${response.status}`);
      protocol.lastSafety = { ...data, checkedAt: new Date().toISOString() };
      protocol.updatedAt = new Date().toISOString();
      saveProtocols(rows);
      renderSafetyResult(data, resultNode);
    } catch (error) {
      if (resultNode) resultNode.innerHTML = `<div class="safety-result warning"><h3>Kontrolli nuk u përfundua</h3><p>${escapeHTML(error.message || 'Provo përsëri.')}</p></div>`;
    }
  }

  function renderSafetyResult(data, target) {
    if (!target) return;
    const findings = [...(data.matchedFindings || []), ...(data.manualReview || [])];
    target.innerHTML = `<section class="safety-result ${escapeHTML(data.status || 'incomplete')}"><h3>${escapeHTML(({ blocked: 'I bllokuar', warning: 'Kërkon rishikim', clear: 'Nuk u gjet përputhje', incomplete: 'Mbulim i paplotë' })[data.status] || 'Rezultati')}</h3><p>${escapeHTML(data.message || '')}</p><p>Mbulimi: ${escapeHTML(data.coverage || 'i panjohur')} · ${Number(data.validatedProductCount || 0)} nga ${Number(data.selectedProductCount || 0)} produkte të validuara.</p>${findings.length ? `<div class="safety-findings">${findings.map((row) => `<div class="safety-finding"><strong>${escapeHTML(row.conditionLabel || 'Kusht klinik')} · ${escapeHTML(row.severity || 'review')}</strong><small>${escapeHTML(row.displayText || row.reason || '')}<br>${escapeHTML([row.sourceTitle, row.sourceOrganization, row.publicationYear].filter(Boolean).join(' · '))}</small></div>`).join('')}</div>` : ''}</section>`;
  }

  function numberOrNull(value) {
    const number = Number(value);
    return value !== '' && Number.isFinite(number) ? number : null;
  }

  function splitValues(value = '') {
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }

  async function addCurrentToComparison() {
    const selection = currentSelection();
    if (!selection || selection.type !== 'product') return toast('Zgjidh një produkt tregtar për krahasim.');
    const ids = readJSON(COMPARE_KEY, []);
    if (ids.includes(selection.id)) return openComparison();
    if (ids.length >= MAX_COMPARE) return toast(`Mund të krahasohen maksimumi ${MAX_COMPARE} produkte.`);
    writeJSON(COMPARE_KEY, [...ids, selection.id]);
    toast('Produkti u shtua në krahasim.');
    openComparison();
  }

  async function openComparison() {
    const ids = readJSON(COMPARE_KEY, []);
    const products = (await Promise.all(ids.map((id) => fetchProduct(id).catch(() => null)))).filter(Boolean);
    createDrawer({
      kicker: 'KRAHASIMI',
      title: 'Krahaso produktet',
      subtitle: 'Krahasimi paraqet identitetin, formën dhe të dhënat e katalogut. Nuk deklaron ekuivalencë terapeutike.',
      wide: true,
      content: products.length ? `<div class="workbench-toolbar"><button type="button" data-workbench-action="clear-comparison">Pastro krahasimin</button><span class="protocol-pill">${products.length}/${MAX_COMPARE} produkte</span></div>${comparisonTable(products)}` : '<div class="workbench-empty"><strong>Nuk ka produkte për krahasim.</strong><br>Hape një produkt dhe zgjidh “Krahaso”.</div>',
    });
  }

  function comparisonTable(products) {
    const fields = [
      ['Substanca aktive', 'active_substance'], ['ATC', 'atc_code'], ['Fortësia', 'strength_text'], ['Forma', 'pharmaceutical_form'], ['Paketimi', 'package_size'], ['Prodhuesi', 'manufacturer'], ['Bartësi MA', 'marketing_authorization_holder'], ['Certifikata MA', 'ma_certificate'], ['Statusi', 'product_status'], ['Çmimi', 'retail_price'], ['Vlefshmëria', 'valid_to'],
    ];
    return `<table class="compare-table"><thead><tr><th>Fusha</th>${products.map((product) => `<th><div class="compare-product-name">${escapeHTML(product.trade_name)}</div><button class="compare-remove" type="button" data-remove-comparison="${escapeHTML(product.id)}">Hiq</button></th>`).join('')}</tr></thead><tbody>${fields.map(([label, key]) => `<tr><td><strong>${escapeHTML(label)}</strong></td>${products.map((product) => `<td>${escapeHTML(formatCompareValue(key, product[key]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function formatCompareValue(key, value) {
    if (value == null || value === '') return '—';
    if (key === 'retail_price') return `${Number(value).toFixed(2)} €`;
    if (key === 'valid_to') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('sq-AL');
    }
    return String(value);
  }

  function removeComparison(id) {
    writeJSON(COMPARE_KEY, readJSON(COMPARE_KEY, []).filter((row) => row !== String(id)));
    openComparison();
  }

  function filterSameDrug() {
    const selection = currentSelection();
    if (!selection) return;
    if (selection.type === 'drug') {
      filters.drugId = selection.id;
      saveFiltersAndRefresh();
      document.querySelector('#catalogFilterPanel')?.classList.add('open');
      document.querySelector('#catalogFilterToggle')?.classList.add('active');
      return;
    }
    fetchProduct(selection.id).then((product) => {
      filters.drugId = product.drug_id || '';
      saveFiltersAndRefresh();
      document.querySelector('#catalogFilterPanel')?.classList.add('open');
      document.querySelector('#catalogFilterToggle')?.classList.add('active');
    }).catch(() => toast('Nuk u gjet grupi i substancës aktive.'));
  }

  function handleClicks(event) {
    const workbenchAction = event.target.closest('[data-workbench-action]');
    if (workbenchAction) {
      const action = workbenchAction.dataset.workbenchAction;
      if (action === 'close') closeDrawer();
      if (action === 'clear-filters') clearFilters();
      if (action === 'add-to-protocol') addCurrentProduct();
      if (action === 'compare-current') addCurrentToComparison();
      if (action === 'same-drug') filterSameDrug();
      if (action === 'open-protocols') openProtocols();
      if (action === 'new-protocol') openNewProtocol();
      if (action === 'new-protocol-with-product') fetchProduct(workbenchAction.dataset.productId).then(openNewProtocol);
      if (action === 'import-protocol') document.querySelector('#protocolImportInput')?.click();
      if (action === 'clear-comparison') { writeJSON(COMPARE_KEY, []); openComparison(); }
      return;
    }

    const nav = event.target.closest('[data-workbench-nav]');
    if (nav?.dataset.workbenchNav === 'protocols') return openProtocols();
    if (nav?.dataset.workbenchNav === 'compare') return openComparison();

    const removeFilterButton = event.target.closest('[data-remove-filter]');
    if (removeFilterButton) return removeFilter(removeFilterButton.dataset.removeFilter);

    const addToProtocol = event.target.closest('[data-add-product-to-protocol]');
    if (addToProtocol) return addProductToProtocol(addToProtocol.dataset.addProductToProtocol, addToProtocol.dataset.productId);

    const protocolAction = event.target.closest('[data-protocol-action]');
    if (protocolAction) {
      const id = protocolAction.dataset.id;
      const action = protocolAction.dataset.protocolAction;
      if (action === 'edit') openProtocolEditor(id);
      if (action === 'safety') openSafetyCheck(id);
      if (action === 'export') exportProtocol(id);
      if (action === 'archive') archiveProtocol(id);
      if (action === 'check-current') openSafetyCheck(id, true);
      if (action === 'versions') openVersions(id);
      return;
    }

    const itemAction = event.target.closest('[data-item-action]');
    if (itemAction) {
      const index = Number(itemAction.dataset.index);
      if (itemAction.dataset.itemAction === 'up') moveProtocolItem(index, -1);
      if (itemAction.dataset.itemAction === 'down') moveProtocolItem(index, 1);
      if (itemAction.dataset.itemAction === 'remove') removeProtocolItem(index);
      return;
    }

    const removeCompare = event.target.closest('[data-remove-comparison]');
    if (removeCompare) return removeComparison(removeCompare.dataset.removeComparison);

    const restore = event.target.closest('[data-restore-version]');
    if (restore) return restoreVersion(restore.dataset.id, Number(restore.dataset.restoreVersion));
  }

  function observeCard() {
    const name = document.querySelector('#drugName');
    const type = document.querySelector('#itemType');
    const sync = () => setTimeout(syncCardActions, 0);
    if (name) new MutationObserver(sync).observe(name, { childList: true, characterData: true, subtree: true });
    if (type) new MutationObserver(sync).observe(type, { childList: true, characterData: true, subtree: true });
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-kosovo-product], [data-kosovo-drug]')) setTimeout(syncCardActions, 120);
    });
  }

  function start() {
    injectStyles();
    ensureFilterUI();
    ensureNavigation();
    ensureCardActions();
    updateProtocolCount();
    observeCard();
    document.addEventListener('click', handleClicks);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.querySelector('#workbenchDrawer')) closeDrawer();
    });
    document.addEventListener('change', (event) => {
      if (event.target?.id === 'protocolImportInput' && event.target.files?.[0]) importProtocol(event.target.files[0]);
    });
    window.DozaKSWorkbench = { openProtocols, openComparison, clearFilters, getFilters: () => ({ ...filters }) };
  }

  patchCatalogFetch();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
