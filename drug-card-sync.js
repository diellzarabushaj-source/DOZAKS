'use strict';

(() => {
  if (window.__dozaksDrugCardSyncLoaded) return;
  window.__dozaksDrugCardSyncLoaded = true;

  let lastSlug = '';
  let lastLoadedAt = 0;

  function exposeBridge() {
    try {
      if (typeof openModal === 'function') window.openModal = openModal;
      if (typeof closeModal === 'function') window.closeModal = closeModal;
      if (typeof showToast === 'function') window.showToast = showToast;
      if (typeof renderRecent === 'function') window.renderRecent = renderRecent;
    } catch (error) {
      console.warn('DozaKS application bridge failed', error);
    }
  }

  function loadScriptOnce(src, attribute) {
    const targetPath = new URL(src, location.href).pathname;
    const existing = [...document.scripts].find((script) => script.src && new URL(script.src, location.href).pathname === targetPath);
    if (existing) {
      existing.setAttribute(`data-${attribute}`, 'true');
      return existing;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(`data-${attribute}`, 'true');
    document.head.appendChild(script);
    return script;
  }

  function injectTypography() {
    if (document.querySelector('#dozaks-readable-ui')) return;
    const style = document.createElement('style');
    style.id = 'dozaks-readable-ui';
    style.textContent = `
      body{font-family:"Segoe UI Variable Text","Segoe UI",Inter,system-ui,-apple-system,sans-serif!important;font-size:15px;letter-spacing:-.005em}
      .heading h1{font-size:19px!important}.heading p{font-size:12px!important}
      .nav-item{min-height:46px!important}.nav-item span:nth-child(2){font-size:13.5px!important;font-weight:650!important}
      .hero h2{font-size:clamp(34px,3vw,46px)!important}.hero-copy p{font-size:14.5px!important}
      .search-box input{height:60px!important;font-size:16.5px!important;font-weight:650!important}.advanced{min-height:60px!important;font-size:13px!important}
      .filters button{font-size:12px!important;padding:7px 13px!important}.suggestions button{min-height:70px!important}.suggestions strong{font-size:14px!important}.suggestions small{font-size:11.5px!important}
      .section-heading h2{font-size:21px!important}.category strong{font-size:13px!important}.category small{font-size:10.5px!important}
      .panel-heading h3,.panel>h3{font-size:14px!important}.list span,.rank span,.emergency-list span{font-size:12px!important}
      .drug-panel{padding:24px!important}.drug-head h3{font-size:32px!important}.drug-head p{font-size:13.5px!important}.clinical-summary-strip strong{font-size:12.5px!important}
      .drug-panel h4{font-size:12px!important}.chips button{min-height:36px!important;font-size:11px!important}.notice{font-size:12px!important;line-height:1.65!important}td{font-size:11.5px!important;line-height:1.55!important}
      @media(max-width:600px){.drug-panel{padding:18px 15px!important}.drug-head h3{font-size:27px!important}.hero h2{font-size:31px!important}}
    `;
    document.head.appendChild(style);
  }

  function activeSlug() {
    if (typeof state === 'undefined' || typeof catalog === 'undefined') return '';
    const item = catalog.find((entry) => entry.id === state.selectedId);
    return item?.slug || item?.id || '';
  }

  function refreshActiveDrug(force = false) {
    if (window.DozaKSProductMode || window.DozaKSCatalogMode) return;
    const slug = activeSlug();
    if (!slug || !window.DozaKSDatabase?.renderDrugCard) return;
    if (!force && slug === lastSlug && Date.now() - lastLoadedAt < 30000) return;
    lastSlug = slug;
    lastLoadedAt = Date.now();
    window.DozaKSDatabase.renderDrugCard(slug);
  }

  function init() {
    exposeBridge();
    injectTypography();

    loadScriptOnce('/product-catalog.js?v=mega-search-20260722', 'dozaks-product-catalog');
    loadScriptOnce('/smart-search-ui.js?v=mega-search-20260722', 'dozaks-smart-search');
    loadScriptOnce('/search-audit-client.js?v=phase1-20260722', 'dozaks-search-audit');
    loadScriptOnce('/database-health.js?v=mega-search-20260722', 'dozaks-database-health');
    loadScriptOnce('/contraindications-ui.js?v=mega-search-20260722', 'dozaks-clinical-safety');
    loadScriptOnce('/clinical-workbench-runtime.js?v=mega-search-20260722', 'dozaks-workbench-runtime');
    loadScriptOnce('/atc-catalog.js?v=mega-search-20260722', 'dozaks-atc-catalog');

    const drugName = document.querySelector('#drugName');
    if (drugName) {
      new MutationObserver(() => refreshActiveDrug(true)).observe(drugName, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    document.addEventListener('click', (event) => {
      const localSelection = event.target.closest('[data-result-id], [data-open-item]:not([data-open-item^="product:"]):not([data-open-item^="drug:"]), #popularList button, #recentList button:not([data-open-item^="product:"]):not([data-open-item^="drug:"])');
      if (!localSelection) return;
      window.DozaKSProductCatalog?.leaveCatalogueMode?.();
      window.DozaKSProductMode = false;
      window.DozaKSCatalogMode = false;
      setTimeout(() => refreshActiveDrug(true), 50);
    });

    window.addEventListener('dozaks:database-ready', () => refreshActiveDrug(true));
    window.addEventListener('online', () => {
      window.DozaKSDatabaseHealth?.check?.();
      refreshActiveDrug(true);
    });
    setTimeout(() => refreshActiveDrug(true), 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
