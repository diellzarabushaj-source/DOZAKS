'use strict';

(() => {
  let lastSlug = '';
  let lastLoadedAt = 0;

  function exposeClinicalCatalog() {
    try {
      if (typeof catalog !== 'undefined') window.catalog = catalog;
      if (typeof clinicalItems !== 'undefined') window.clinicalItems = clinicalItems;
      if (typeof openModal === 'function') window.openModal = openModal;
      if (typeof closeModal === 'function') window.closeModal = closeModal;
      if (typeof openItem === 'function') window.openItem = openItem;
      if (typeof showToast === 'function') window.showToast = showToast;
    } catch (error) {
      console.warn('DozaKS clinical catalog bridge failed', error);
    }
  }

  function loadRegistryProtocols() {
    if (document.querySelector('script[data-dozaks-registry-protocols]')) return;
    const script = document.createElement('script');
    script.src = '/registry-protocols.js';
    script.defer = true;
    script.dataset.dozaksRegistryProtocols = 'true';
    document.head.appendChild(script);
  }

  function activeSlug() {
    if (typeof state === 'undefined' || typeof catalog === 'undefined') return '';
    const item = catalog.find((entry) => entry.id === state.selectedId);
    return item?.slug || item?.id || '';
  }

  function refreshActiveDrug(force = false) {
    const slug = activeSlug();
    if (!slug || !window.DozaKSDatabase?.renderDrugCard) return;
    if (!force && slug === lastSlug && Date.now() - lastLoadedAt < 30000) return;
    lastSlug = slug;
    lastLoadedAt = Date.now();
    window.DozaKSDatabase.renderDrugCard(slug);
  }

  function init() {
    exposeClinicalCatalog();
    loadRegistryProtocols();
    const drugName = document.querySelector('#drugName');
    if (drugName) new MutationObserver(() => refreshActiveDrug(true)).observe(drugName, { childList: true, characterData: true, subtree: true });

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-open-item], [data-result-id], #popularList button, #recentList button')) {
        setTimeout(() => refreshActiveDrug(true), 40);
      }
    });

    document.querySelector('#searchForm')?.addEventListener('submit', () => setTimeout(() => refreshActiveDrug(true), 40));
    window.addEventListener('dozaks:database-ready', () => {
      exposeClinicalCatalog();
      refreshActiveDrug(true);
    });
    setTimeout(() => refreshActiveDrug(true), 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
