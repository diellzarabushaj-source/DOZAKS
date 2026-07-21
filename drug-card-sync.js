'use strict';

(() => {
  let lastSlug = '';
  let lastLoadedAt = 0;

  function exposeApplicationBridge() {
    try {
      if (typeof openModal === 'function') window.openModal = openModal;
      if (typeof closeModal === 'function') window.closeModal = closeModal;
      if (typeof showToast === 'function') window.showToast = showToast;
      if (typeof renderRecent === 'function') window.renderRecent = renderRecent;
    } catch (error) {
      console.warn('DozaKS application bridge failed', error);
    }
  }

  function loadClinicalSafety() {
    if (document.querySelector('script[data-dozaks-clinical-safety]')) return;
    const script = document.createElement('script');
    script.src = '/contraindications-ui.js';
    script.defer = true;
    script.dataset.dozaksClinicalSafety = 'true';
    document.head.appendChild(script);
  }

  function loadProductCatalog() {
    if (document.querySelector('script[data-dozaks-product-catalog]')) {
      loadClinicalSafety();
      return;
    }
    const script = document.createElement('script');
    script.src = '/product-catalog.js';
    script.defer = true;
    script.dataset.dozaksProductCatalog = 'true';
    script.addEventListener('load', loadClinicalSafety, { once: true });
    document.head.appendChild(script);
  }

  function activeSlug() {
    if (typeof state === 'undefined' || typeof catalog === 'undefined') return '';
    const item = catalog.find((entry) => entry.id === state.selectedId);
    return item?.slug || item?.id || '';
  }

  function refreshActiveDrug(force = false) {
    if (window.DozaKSProductMode) return;
    const slug = activeSlug();
    if (!slug || !window.DozaKSDatabase?.renderDrugCard) return;
    if (!force && slug === lastSlug && Date.now() - lastLoadedAt < 30000) return;
    lastSlug = slug;
    lastLoadedAt = Date.now();
    window.DozaKSDatabase.renderDrugCard(slug);
  }

  function leaveProductModeForClinicalNavigation() {
    window.DozaKSProductCatalog?.leaveProductMode?.();
    window.DozaKSProductMode = false;
  }

  function init() {
    exposeApplicationBridge();
    loadProductCatalog();
    const drugName = document.querySelector('#drugName');
    if (drugName) new MutationObserver(() => refreshActiveDrug(true)).observe(drugName, { childList: true, characterData: true, subtree: true });

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-open-item]:not([data-open-item^="product:"]), [data-result-id], #popularList button, #recentList button:not([data-open-item^="product:"])')) {
        leaveProductModeForClinicalNavigation();
        setTimeout(() => refreshActiveDrug(true), 40);
      }
    });

    document.querySelector('#searchForm')?.addEventListener('submit', () => {
      if (!window.DozaKSProductMode) setTimeout(() => refreshActiveDrug(true), 40);
    });
    window.addEventListener('dozaks:database-ready', () => refreshActiveDrug(true));
    setTimeout(() => refreshActiveDrug(true), 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
