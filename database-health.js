'use strict';

(() => {
  if (window.__dozaksDatabaseHealthLoaded) return;
  window.__dozaksDatabaseHealthLoaded = true;

  const HEALTH_URL = '/api/product-catalog?mode=health';
  let timer = null;
  let lastSuccess = 0;

  function badge() {
    return document.querySelector('#databaseStatus');
  }

  function setStatus(state, message, title = message) {
    const element = badge();
    if (!element) return;
    element.dataset.state = state;
    element.textContent = message;
    element.title = title;
    document.body.dataset.database = state;
  }

  async function check({ silent = false, retry = true } = {}) {
    if (!silent) setStatus('loading', '● Neon: duke u verifikuar');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(HEALTH_URL, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || `API ${response.status}`);
      const products = Number(data.visible_products || 0);
      const drugs = Number(data.visible_drugs || 0);
      const productLabel = products.toLocaleString('sq-AL');
      const drugLabel = drugs.toLocaleString('sq-AL');
      lastSuccess = Date.now();
      setStatus(
        'connected',
        `● Neon · ${productLabel} produkte`,
        `Databaza Neon është aktive: ${productLabel} produkte dhe ${drugLabel} barna gjenerike.`,
      );
      window.dispatchEvent(new CustomEvent('dozaks:catalog-health', { detail: data }));
      return data;
    } catch (error) {
      if (retry) {
        clearTimeout(timer);
        timer = setTimeout(() => check({ silent: true, retry: false }), 1400);
      } else if (!lastSuccess) {
        setStatus('offline', '● Neon nuk u arrit', `Gabim: ${String(error?.message || error)}`);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  function start() {
    check();
    window.addEventListener('dozaks:database-error', () => check({ silent: true }));
    window.addEventListener('online', () => check({ silent: false }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSuccess > 5 * 60 * 1000) check({ silent: true });
    });
    setInterval(() => check({ silent: true, retry: false }), 5 * 60 * 1000);
    window.DozaKSDatabaseHealth = { check, getLastSuccess: () => lastSuccess };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
