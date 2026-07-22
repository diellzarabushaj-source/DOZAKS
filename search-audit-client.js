'use strict';

(() => {
  if (window.__dozaksSearchAuditLoaded) return;
  window.__dozaksSearchAuditLoaded = true;

  const MAX_ENTRIES = 100;
  const entries = [];

  function rounded(value) {
    return Number(Math.max(0, Number(value) || 0).toFixed(1));
  }

  function remember(payload) {
    entries.push(payload);
    if (entries.length > MAX_ENTRIES) entries.shift();
    console.info(JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('dozaks:search-performance', { detail: payload }));
  }

  function serverTimings(entry) {
    return Object.fromEntries((entry.serverTiming || []).map((item) => [
      item.name,
      rounded(item.duration),
    ]));
  }

  function recordResource(entry) {
    let url;
    try {
      url = new URL(entry.name, location.href);
    } catch {
      return;
    }

    if (url.origin !== location.origin || !['/api/search-index', '/api/smart-search'].includes(url.pathname)) return;

    remember({
      event: 'dozaks.search.resource_timing',
      endpoint: url.pathname,
      durationMs: rounded(entry.duration),
      responseStartMs: rounded(entry.responseStart - entry.startTime),
      transferSize: Number(entry.transferSize || 0),
      encodedBodySize: Number(entry.encodedBodySize || 0),
      decodedBodySize: Number(entry.decodedBodySize || 0),
      serverTiming: serverTimings(entry),
      connection: navigator.connection?.effectiveType || null,
      timestamp: new Date().toISOString(),
    });
  }

  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(recordResource);
      });
      observer.observe({ type: 'resource', buffered: true });
    } catch (error) {
      console.warn('DozaKS search audit observer failed', error);
    }
  }

  window.addEventListener('dozaks:local-search-performance', (event) => {
    const detail = event.detail || {};
    remember({
      event: 'dozaks.search.local_timing',
      durationMs: rounded(detail.durationMs),
      productCount: Number(detail.productCount || 0),
      resultCount: Number(detail.resultCount || 0),
      queryLength: Number(detail.queryLength || 0),
      timestamp: new Date().toISOString(),
    });
  });

  window.DozaKSSearchAudit = {
    getEntries: () => entries.map((entry) => ({ ...entry })),
    clear: () => { entries.length = 0; },
  };
})();
