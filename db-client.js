'use strict';

(() => {
  const API_URL = '/api/clinical-data';
  const REQUEST_TIMEOUT_MS = 5500;
  let lastSuccessfulRefresh = 0;
  let drugCardRequest = 0;

  const normalizeDb = (value = '') => String(value)
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const escapeDbHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);

  function inferCategory(group = '') {
    const value = normalizeDb(group);
    if (value.includes('antibiotik') || value.includes('antimikrobik')) return 'antibiotic';
    if (value.includes('analgjezik') || value.includes('nsaid')) return 'analgesic';
    if (value.includes('proton') || value.includes('gastro')) return 'gastro';
    if (value.includes('antiemetik')) return 'antiemetic';
    if (value.includes('respir') || value.includes('bronk')) return 'respiratory';
    if (value.includes('kard') || value.includes('diuretik')) return 'cardio';
    if (value.includes('kortikosteroid')) return 'steroid';
    if (value.includes('neuro') || value.includes('benzodiazep')) return 'neurology';
    return 'other';
  }

  function setDatabaseStatus(status, message, title = '') {
    let badge = document.querySelector('#databaseStatus');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'databaseStatus';
      badge.className = 'database-status';
      badge.setAttribute('role', 'status');
      badge.setAttribute('aria-live', 'polite');
      document.querySelector('.heading p')?.appendChild(badge);
    }
    badge.dataset.state = status;
    badge.textContent = message;
    badge.title = title || message;
    document.body.dataset.database = status;
  }

  function mergeDrug(remoteDrug) {
    const remoteName = remoteDrug.generic_name;
    const existing = catalog.find((item) =>
      item.id === remoteDrug.slug || normalizeDb(item.name) === normalizeDb(remoteName)
    );

    const aliases = Array.isArray(remoteDrug.aliases) ? remoteDrug.aliases.filter(Boolean) : [];
    const forms = Array.isArray(remoteDrug.forms)
      ? remoteDrug.forms.map((form) => [form.name, form.strength, form.route].filter(Boolean).join(' ')).filter(Boolean)
      : [];

    if (existing) {
      existing.dbId = remoteDrug.id;
      existing.slug = remoteDrug.slug;
      existing.group = remoteDrug.therapeutic_group || existing.group;
      existing.aliases = [...new Set([...(existing.aliases || []), ...aliases])];
      if (forms.length) existing.forms = forms;
      existing.publishedDoseCount = Number(remoteDrug.published_dose_count || 0);
      existing.notice = existing.publishedDoseCount > 0
        ? 'Të dhënat e publikuara janë marrë nga databaza editoriale DozaKS.'
        : 'Kartela është lidhur me Neon. Dozat numerike mbeten të fshehura derisa të aprovohen editorialist.';
      return existing;
    }

    const item = {
      id: remoteDrug.slug,
      dbId: remoteDrug.id,
      slug: remoteDrug.slug,
      name: remoteName,
      type: 'generic',
      typeLabel: 'Bar gjenerik',
      group: remoteDrug.therapeutic_group || 'Grup terapeutik',
      category: inferCategory(remoteDrug.therapeutic_group),
      forms: forms.length ? forms : ['Forma në verifikim'],
      aliases,
      indications: ['Indikacionet në verifikim editorial'],
      notice: 'Kartela është marrë nga Neon. Dozat publikohen vetëm pas verifikimit editorial.',
      publishedDoseCount: Number(remoteDrug.published_dose_count || 0),
    };
    catalog.push(item);
    allItems.push(item);
    return item;
  }

  function mergeClinical(remoteItem, type) {
    const existing = clinicalItems.find((item) =>
      item.id === remoteItem.slug || normalizeDb(item.name) === normalizeDb(remoteItem.name)
    );
    if (existing) {
      existing.dbId = remoteItem.id;
      existing.slug = remoteItem.slug;
      existing.summary = remoteItem.summary || existing.summary;
      if (type === 'diagnosis' && remoteItem.specialty) existing.group = remoteItem.specialty;
      return existing;
    }

    const item = {
      id: remoteItem.slug,
      dbId: remoteItem.id,
      slug: remoteItem.slug,
      name: remoteItem.name,
      type,
      typeLabel: type === 'diagnosis' ? 'Diagnozë' : 'Simptomë',
      group: type === 'diagnosis' ? (remoteItem.specialty || 'Algoritëm klinik') : 'Vlerësim klinik',
      aliases: Array.isArray(remoteItem.aliases) ? remoteItem.aliases : [],
      summary: remoteItem.summary || 'Moduli është në përgatitje editoriale.',
    };
    clinicalItems.push(item);
    allItems.push(item);
    return item;
  }

  function mergeEmergency(remoteItem) {
    const existing = emergencyItems.find((item) =>
      item.id === remoteItem.slug || normalizeDb(item.name) === normalizeDb(remoteItem.name)
    );
    if (existing) {
      existing.dbId = remoteItem.id;
      existing.slug = remoteItem.slug;
      existing.summary = remoteItem.summary || existing.summary;
      return existing;
    }
    const item = {
      id: remoteItem.slug,
      dbId: remoteItem.id,
      slug: remoteItem.slug,
      name: remoteItem.name,
      summary: remoteItem.summary || 'Protokoll i verifikuar editorial.',
    };
    emergencyItems.push(item);
    return item;
  }

  function mergeSearchResult(remoteItem) {
    if (remoteItem.type === 'generic') {
      return mergeDrug({
        id: remoteItem.id,
        slug: remoteItem.slug,
        generic_name: remoteItem.name,
        therapeutic_group: remoteItem.group_name,
        description: remoteItem.summary,
        aliases: remoteItem.aliases || [],
        forms: [],
        published_dose_count: 0,
      });
    }
    if (remoteItem.type === 'diagnosis' || remoteItem.type === 'symptom') {
      return mergeClinical({
        id: remoteItem.id,
        slug: remoteItem.slug,
        name: remoteItem.name,
        specialty: remoteItem.type === 'diagnosis' ? remoteItem.group_name : null,
        summary: remoteItem.summary,
        aliases: remoteItem.aliases || [],
      }, remoteItem.type);
    }
    return null;
  }

  function hydrateSearchResults(results = []) {
    return results.map(mergeSearchResult).filter(Boolean);
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function refreshDatabase({ silent = false } = {}) {
    if (!silent) setDatabaseStatus('loading', '● Neon: duke u lidhur');
    const startedAt = performance.now();
    try {
      const data = await fetchJson(`${API_URL}?mode=bootstrap`);
      if (typeof catalog === 'undefined' || typeof clinicalItems === 'undefined') throw new Error('DozaKS interface is not ready');

      (data.drugs || []).forEach(mergeDrug);
      (data.diagnoses || []).forEach((item) => mergeClinical(item, 'diagnosis'));
      (data.symptoms || []).forEach((item) => mergeClinical(item, 'symptom'));
      (data.emergencies || []).forEach(mergeEmergency);

      if (typeof renderPopular === 'function') renderPopular();
      if (typeof renderEmergencies === 'function') renderEmergencies();
      if (typeof renderSelectedDrug === 'function') renderSelectedDrug();

      const elapsed = Math.round(performance.now() - startedAt);
      lastSuccessfulRefresh = Date.now();
      setDatabaseStatus('connected', `● Neon · ${data.drugs?.length || 0} barna`, `Databaza u lidh në ${elapsed} ms. Shfaqen vetëm rekordet e publikuara.`);
      window.dispatchEvent(new CustomEvent('dozaks:database-ready', { detail: { ...data, elapsed } }));
      return data;
    } catch (error) {
      console.warn('DozaKS database fallback active', error);
      setDatabaseStatus('offline', '● Fallback lokal', 'Neon nuk u arrit. Po përdoret katalogu lokal pa doza të publikuara.');
      window.dispatchEvent(new CustomEvent('dozaks:database-error', { detail: { message: String(error?.message || error) } }));
      return null;
    }
  }

  async function searchDatabase(query, limit = 12) {
    const value = String(query || '').trim();
    if (value.length < 2) return [];
    const data = await fetchJson(`${API_URL}?mode=search&q=${encodeURIComponent(value)}&limit=${limit}`);
    return data.results || [];
  }

  async function getDrugFromDatabase(slug) {
    return fetchJson(`${API_URL}?mode=drug&slug=${encodeURIComponent(slug)}`);
  }

  function currentDrugSlug() {
    if (typeof state === 'undefined' || typeof catalog === 'undefined') return '';
    const item = catalog.find((entry) => entry.id === state.selectedId);
    return item?.slug || item?.id || '';
  }

  async function renderDrugCard(slug = currentDrugSlug()) {
    if (!slug) return null;
    const requestNumber = ++drugCardRequest;
    const panel = document.querySelector('#drugPanel');
    panel?.setAttribute('aria-busy', 'true');
    panel?.classList.add('loading-data');

    try {
      const data = await getDrugFromDatabase(slug);
      if (requestNumber !== drugCardRequest || currentDrugSlug() !== slug) return null;

      const forms = Array.isArray(data.forms) ? data.forms : [];
      const dosingRules = Array.isArray(data.dosingRules) ? data.dosingRules : [];
      const formContainer = document.querySelector('#formChips');
      const doseRows = document.querySelector('#doseRows');
      const notice = document.querySelector('#itemNotice');

      if (forms.length && formContainer) {
        formContainer.innerHTML = forms.map((form, index) => {
          const label = [form.form_name, form.strength_text, form.route].filter(Boolean).join(' · ');
          return `<button type="button" class="${index === 0 ? 'active' : ''}" data-form="${escapeDbHTML(label)}">${escapeDbHTML(label)}</button>`;
        }).join('');
      }

      if (dosingRules.length && doseRows) {
        doseRows.innerHTML = dosingRules.map((rule) => {
          const population = normalizeDb(rule.population);
          const dose = [rule.dose_text, rule.interval_text, rule.duration_text].filter(Boolean).join(' · ');
          const adultDose = population.includes('adult') || population.includes('rritur') ? dose : '—';
          const childDose = population.includes('child') || population.includes('pediatr') || population.includes('femij') ? dose : '—';
          const label = [rule.route, rule.population].filter(Boolean).join(' · ') || 'Rregull i verifikuar';
          return `<tr><td>${escapeDbHTML(label)}</td><td>${escapeDbHTML(adultDose)}</td><td>${escapeDbHTML(childDose)}</td><td><span class="status published">Publikuar</span></td></tr>`;
        }).join('');
      }

      if (notice) {
        notice.classList.toggle('verified', dosingRules.length > 0);
        notice.textContent = dosingRules.length > 0
          ? `${dosingRules.length} rregulla dozimi të aprovuara u ngarkuan nga Neon. Verifiko indikacionin dhe burimin para përdorimit.`
          : 'Kartela është sinkronizuar me Neon. Nuk ka ende dozë numerike të aprovuar për publikim.';
      }
      panel?.classList.toggle('has-published-data', dosingRules.length > 0);
      return data;
    } catch (error) {
      if (!String(error?.message || '').includes('404')) console.warn('DozaKS drug detail loading failed', error);
      return null;
    } finally {
      if (requestNumber === drugCardRequest) {
        panel?.removeAttribute('aria-busy');
        panel?.classList.remove('loading-data');
      }
    }
  }

  window.DozaKSDatabase = {
    refresh: refreshDatabase,
    search: searchDatabase,
    hydrateSearchResults,
    getDrug: getDrugFromDatabase,
    renderDrugCard,
    health: () => fetchJson(`${API_URL}?mode=health`),
    getLastSuccessfulRefresh: () => lastSuccessfulRefresh,
  };

  const start = () => refreshDatabase();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastSuccessfulRefresh > 5 * 60 * 1000) refreshDatabase({ silent: true });
  });
})();
