'use strict';

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isTypingTarget = (target) => target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

  let lastModalTrigger = null;
  let remoteSearchTimer = null;
  let remoteSearchSequence = 0;
  let lastRemoteQuery = '';

  function announce(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function renderContext() {
    const stored = (() => {
      try { return JSON.parse(localStorage.getItem('dozaks-context') || 'null'); } catch { return null; }
    })();
    const patient = stored?.patient || $('#patientType')?.selectedOptions?.[0]?.textContent || 'I rritur';
    const care = stored?.context || $('#careContext')?.selectedOptions?.[0]?.textContent || 'Ambulancë';
    const special = stored?.special || $('#specialState')?.selectedOptions?.[0]?.textContent || 'Asnjë';
    const badge = $('#contextBadge');
    if (badge) badge.innerHTML = `Konteksti: ${patient} · ${care} · ${special} <span>Ndrysho</span>`;
    if ($('#activePatientSummary')) $('#activePatientSummary').textContent = patient;
    if ($('#activeCareSummary')) $('#activeCareSummary').textContent = care;
  }

  function syncAdvancedState() {
    const panel = $('#advancedPanel');
    const button = $('#advancedButton');
    if (!panel || !button) return;
    button.setAttribute('aria-expanded', String(panel.classList.contains('open')));
  }

  function setFocusMode(enabled, source = 'toolbar') {
    document.body.classList.toggle('focus-mode', enabled);
    sessionStorage.setItem('dozaks-focus-mode', enabled ? '1' : '0');
    [$('#focusModeButton'), $('#focusCardButton')].filter(Boolean).forEach((button) => {
      button.classList.toggle('active', enabled);
      button.setAttribute('aria-pressed', String(enabled));
    });
    if (enabled && source === 'card') $('#drugPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    announce(enabled ? 'Fokusi klinik u aktivizua.' : 'Pamja e plotë u rikthye.');
  }

  function toggleFocusMode(source) {
    setFocusMode(!document.body.classList.contains('focus-mode'), source);
  }

  function updateNetworkState() {
    document.body.dataset.network = navigator.onLine ? 'online' : 'offline';
    if (!navigator.onLine) announce('Je offline. Ndërfaqja punon, por databaza kërkon internet.');
  }

  function syncActiveNavigation() {
    $$('.nav-item').forEach((item) => {
      if (item.classList.contains('active')) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function trapModalFocus(event) {
    const modal = $('#modal');
    if (!modal || modal.hidden || event.key !== 'Tab') return;
    const focusable = $$(focusableSelector, modal).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function enrichSearchFromDatabase(query) {
    const trimmed = String(query || '').trim();
    if (trimmed.length < 3 || trimmed === lastRemoteQuery || !window.DozaKSDatabase) return;
    const localCount = typeof window.getResults === 'function' ? window.getResults(trimmed).length : 0;
    if (localCount >= 5) return;

    const sequence = ++remoteSearchSequence;
    lastRemoteQuery = trimmed;
    document.body.dataset.search = 'remote';
    try {
      const results = await window.DozaKSDatabase.search(trimmed, 8);
      if (sequence !== remoteSearchSequence || $('#searchInput')?.value.trim() !== trimmed) return;
      window.DozaKSDatabase.hydrateSearchResults?.(results);
      if (typeof window.renderSuggestions === 'function') window.renderSuggestions();
    } catch (error) {
      console.warn('DozaKS remote search enrichment failed', error);
    } finally {
      if (sequence === remoteSearchSequence) document.body.dataset.search = 'idle';
    }
  }

  function scheduleRemoteSearch(value) {
    clearTimeout(remoteSearchTimer);
    remoteSearchTimer = setTimeout(() => enrichSearchFromDatabase(value), 260);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('DozaKS service worker registration failed', error));
  }

  function init() {
    const focusModeButton = $('#focusModeButton');
    const focusCardButton = $('#focusCardButton');
    const contextBadge = $('#contextBadge');
    const advancedButton = $('#advancedButton');
    const applyContext = $('#applyContext');
    const searchInput = $('#searchInput');
    const modal = $('#modal');

    renderContext();
    syncAdvancedState();
    syncActiveNavigation();
    updateNetworkState();
    setFocusMode(sessionStorage.getItem('dozaks-focus-mode') === '1');

    focusModeButton?.addEventListener('click', () => toggleFocusMode('toolbar'));
    focusCardButton?.addEventListener('click', () => toggleFocusMode('card'));

    contextBadge?.addEventListener('click', () => {
      $('#advancedPanel')?.classList.add('open');
      advancedButton?.classList.add('active');
      syncAdvancedState();
      $('#patientType')?.focus();
    });

    advancedButton?.addEventListener('click', () => requestAnimationFrame(syncAdvancedState));
    applyContext?.addEventListener('click', () => setTimeout(renderContext, 0));
    ['patientType', 'careContext', 'specialState'].forEach((id) => $(`#${id}`)?.addEventListener('change', () => {
      if ($('#advancedPanel')?.classList.contains('open')) {
        const patient = $('#patientType')?.selectedOptions?.[0]?.textContent || 'I rritur';
        const care = $('#careContext')?.selectedOptions?.[0]?.textContent || 'Ambulancë';
        if ($('#activePatientSummary')) $('#activePatientSummary').textContent = patient;
        if ($('#activeCareSummary')) $('#activeCareSummary').textContent = care;
      }
    }));

    searchInput?.addEventListener('input', (event) => scheduleRemoteSearch(event.target.value));

    document.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-action], [data-open-item], [data-emergency], [data-clinical], #openDetails');
      if (opener && modal?.hidden) lastModalTrigger = opener;
      requestAnimationFrame(syncActiveNavigation);
    }, true);

    document.addEventListener('keydown', (event) => {
      trapModalFocus(event);
      if (event.defaultPrevented) return;
      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        $('#searchSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => searchInput?.focus(), 180);
      }
      if (event.key.toLowerCase() === 'f' && !isTypingTarget(event.target) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        toggleFocusMode('keyboard');
      }
      if (event.altKey && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        const action = ({ '1': 'quick-dose', '2': 'emergency', '3': 'calc-mgkg', '4': 'calc-renal' })[event.key];
        document.querySelector(`[data-action="${action}"]`)?.click();
      }
    });

    if (modal) {
      new MutationObserver(() => {
        if (modal.hidden && lastModalTrigger instanceof HTMLElement) {
          lastModalTrigger.focus({ preventScroll: true });
          lastModalTrigger = null;
        }
      }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
    }

    const nav = $('.sidebar nav');
    if (nav) new MutationObserver(syncActiveNavigation).observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });

    window.addEventListener('online', () => {
      updateNetworkState();
      window.DozaKSDatabase?.refresh?.();
    });
    window.addEventListener('offline', updateNetworkState);
    window.addEventListener('dozaks:database-ready', renderContext);

    document.body.classList.add('app-ready');
    const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 800));
    idle(registerServiceWorker);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
