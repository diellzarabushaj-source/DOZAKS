'use strict';

(() => {
  const API_URL = '/api/clinical-data';
  const normalizeDb = (value = '') => String(value)
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

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

  function setDatabaseStatus(status, message) {
    let badge = document.querySelector('#databaseStatus');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'databaseStatus';
      badge.style.cssText = 'display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;vertical-align:middle;';
      const target = document.querySelector('.heading p');
      target?.appendChild(badge);
    }

    const styles = {
      loading: ['#fff7df', '#8a6200'],
      connected: ['#e8f8f1', '#087a55'],
      offline: ['#fff0f1', '#aa2e3a'],
    };
    const [background, color] = styles[status] || styles.loading;
    badge.style.background = background;
    badge.style.color = color;
    badge.textContent = message;
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
    const existing = clinicalItems.find((item) => normalizeDb(item.name) === normalizeDb(remoteItem.name));
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
      aliases: [],
      summary: remoteItem.summary || 'Moduli është në përgatitje editoriale.',
    };
    clinicalItems.push(item);
    allItems.push(item);
    return item;
  }

  function mergeEmergency(remoteItem) {
    const existing = emergencyItems.find((item) => normalizeDb(item.name) === normalizeDb(remoteItem.name));
    if (existing) {
      existing.dbId = remoteItem.id;
      existing.slug = remoteItem.slug;
      existing.summary = remoteItem.summary || existing.summary;
      return;
    }
    emergencyItems.push({
      id: remoteItem.slug,
      dbId: remoteItem.id,
      slug: remoteItem.slug,
      name: remoteItem.name,
      summary: remoteItem.summary || 'Protokoll i verifikuar editorial.',
    });
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`API ${response.status}`);
    return response.json();
  }

  async function refreshDatabase() {
    setDatabaseStatus('loading', '● Neon DB: duke u lidhur');
    try {
      const data = await fetchJson(`${API_URL}?mode=bootstrap`);
      if (typeof catalog === 'undefined' || typeof clinicalItems === 'undefined') {
        throw new Error('DozaKS interface is not ready');
      }

      (data.drugs || []).forEach(mergeDrug);
      (data.diagnoses || []).forEach((item) => mergeClinical(item, 'diagnosis'));
      (data.symptoms || []).forEach((item) => mergeClinical(item, 'symptom'));
      (data.emergencies || []).forEach(mergeEmergency);

      if (typeof renderPopular === 'function') renderPopular();
      if (typeof renderEmergencies === 'function') renderEmergencies();
      if (typeof renderSelectedDrug === 'function') renderSelectedDrug();

      setDatabaseStatus('connected', `● Neon DB: lidhur · ${data.drugs?.length || 0} barna`);
      window.dispatchEvent(new CustomEvent('dozaks:database-ready', { detail: data }));
      return data;
    } catch (error) {
      console.warn('DozaKS database fallback active', error);
      setDatabaseStatus('offline', '● Neon DB: fallback lokal');
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

  window.DozaKSDatabase = {
    refresh: refreshDatabase,
    search: searchDatabase,
    getDrug: getDrugFromDatabase,
    health: () => fetchJson(`${API_URL}?mode=health`),
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshDatabase, { once: true });
  } else {
    refreshDatabase();
  }
})();
