'use strict';

(() => {
  if (window.__dozaksSearchAuditLoaded) return;
  window.__dozaksSearchAuditLoaded = true;

  const MAX_ENTRIES = 100;
  const entries = [];

  function rounded(value) {
    return Number(Math.max(0, Number(value) || 0).toFixed(1));
  }

  function serverTimings(entry) {
    return Object.fromEntries((entry.serverTiming || []).map((item) => [
      item.name,
      rounded(item.duration),
    ]));
  }

  function record(entry) {
    let url;
    try {
      url = new URL(entry.name, location.href);
    } catch {
      return;
    }

    if (url.origin !== location.origin || url.pathname !== '/api/smart-search') return;

    const payload = {
      event: 'dozaks.search.client_timing',
      durationMs: rounded(entry.duration),
      responseStartMs: rounded(entry.responseStart - entry.startTime),
      transferSize: Number(entry.transferSize || 0),
      encodedBodySize: Number(entry.encodedBodySize || 0),
      decodedBodySize: Number(entry.decodedBodySize || 0),
      serverTiming: serverTimings(entry),
      connection: navigator.connection?.effectiveType || null,
      timestamp: new Date().toISOString(),
    };

    entries.push(payload);
    if (entries.length > MAX_ENTRIES) entries.shift();

    console.info(JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('dozaks:search-performance', { detail: payload }));
  }

  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(record);
      });
      observer.observe({ type: 'resource', buffered: true });
    } catch (error) {
      console.warn('DozaKS search audit observer failed', error);
    }
  }

  window.DozaKSSearchAudit = {
    getEntries: () => entries.map((entry) => ({ ...entry })),
    clear: () => { entries.length = 0; },
  };
})();
