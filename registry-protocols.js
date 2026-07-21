'use strict';

(() => {
  const API_URL = '/api/clinical-reference';
  const STORAGE_KEY = 'dozaks-registry-protocols-v1';
  let registryProducts = null;

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
  const normalize = (value = '') => String(value).toLocaleLowerCase('sq').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const readProtocols = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
  const writeProtocols = (rows) => localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  const createId = () => crypto.randomUUID?.() || `protocol-${Date.now()}`;
  const diagnoses = () => (window.clinicalItems || []).filter((item) => item.type === 'diagnosis');

  const icdFallback = {
    hypertension: { code: 'I10', title: 'Essential (primary) hypertension' },
    uti: { code: 'N39.0', title: 'Urinary tract infection, site not specified' },
    'urinary-tract-infection': { code: 'N39.0', title: 'Urinary tract infection, site not specified' },
    'community-pneumonia': { code: 'J18.9', title: 'Pneumonia, unspecified organism' },
    'community-acquired-pneumonia': { code: 'J18.9', title: 'Pneumonia, unspecified organism' },
  };

  function toast(message) { window.showToast?.(message); }
  function modal(config) {
    if (!window.openModal) { toast('Moduli nuk është ende gati. Rifresko faqen.'); return; }
    window.openModal(config);
  }

  async function getRegisteredProducts(force = false) {
    if (registryProducts && !force) return registryProducts;
    const response = await fetch(`${API_URL}?mode=registered&limit=250`, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    registryProducts = Array.isArray(data.results) ? data.results : [];
    return registryProducts;
  }

  function protocolRow(protocol) {
    const products = protocol.products || [];
    return `<article class="protocol-row">
      <div><span class="workspace-kicker">VERSIONI ${Number(protocol.version || 1)}</span><h3>${escapeHTML(protocol.title)}</h3><p>${escapeHTML(protocol.diagnosis?.name || 'Pa diagnozë')} · ${escapeHTML(protocol.diagnosis?.icdCode || 'pa ICD')} · ${products.length} produkte të regjistruara</p><div class="protocol-meta"><span class="privacy-pill">Private</span><span class="source-pill">Regjistri i Kosovës</span><span class="review-pill">Draft</span></div></div>
      <div class="protocol-actions"><button type="button" data-registry-protocol="view" data-id="${escapeHTML(protocol.id)}">Hap</button><button type="button" data-registry-protocol="edit" data-id="${escapeHTML(protocol.id)}">Ndrysho</button><button class="danger-text" type="button" data-registry-protocol="delete" data-id="${escapeHTML(protocol.id)}">Fshi</button></div>
    </article>`;
  }

  function openProtocols() {
    const rows = readProtocols().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    modal({
      title: 'Protokollet e mia',
      subtitle: 'ICD lidhet me diagnozën; barnat lejohen vetëm kur kanë autorizim aktiv në regjistrin aktual të Kosovës.',
      kicker: 'PROTOKOLLE PRIVATE',
      body: `<div class="workspace-toolbar"><span class="privacy-pill">● Private · kjo pajisje</span><button class="primary" type="button" data-registry-protocol="new">+ Protokoll i ri</button></div><div class="protocol-list">${rows.length ? rows.map(protocolRow).join('') : '<div class="workspace-empty"><strong>Nuk ka ende protokoll.</strong><br><small>Krijo një protokoll me diagnozë ICD dhe produkte të regjistruara në Kosovë.</small></div>'}</div><div class="reference-note">Lista esenciale përdoret si etiketë shtesë. Ajo nuk zëvendëson regjistrin e produkteve me autorizim aktiv për marketing.</div>`,
    });
  }

  async function openEditor(id = '') {
    const previous = readProtocols().find((row) => row.id === id);
    modal({ title: previous ? 'Ndrysho protokollin' : 'Krijo protokoll', subtitle: 'Duke ngarkuar regjistrin aktiv të Kosovës…', kicker: 'REGJISTRI I KOSOVËS', body: '<div class="workspace-empty">Duke verifikuar produktet e autorizuara…</div>' });

    let products = [];
    let loadError = '';
    try { products = await getRegisteredProducts(); } catch (error) { loadError = String(error?.message || error); }

    const selected = new Set((previous?.products || []).map((row) => row.product_id));
    const diagnosisOptions = diagnoses().map((item) => `<option value="${escapeHTML(item.id)}" ${item.id === previous?.diagnosis?.id ? 'selected' : ''}>${escapeHTML(item.name)}</option>`).join('');
    const productRows = products.map((product) => {
      const label = [product.brand_name, product.generic_name, product.dosage_form, product.strength_text].filter(Boolean).join(' · ');
      const metadata = [product.manufacturer, product.authorization_number ? `Nr. ${product.authorization_number}` : '', product.is_essential ? 'Esencial' : 'Jo-esencial'].filter(Boolean).join(' · ');
      return `<label data-registry-product-label="${escapeHTML(normalize(`${label} ${metadata} ${product.atc_code || ''}`))}"><input type="checkbox" value="${escapeHTML(product.product_id)}" ${selected.has(product.product_id) ? 'checked' : ''}><span><strong>${escapeHTML(label)}</strong><br><small>${escapeHTML(metadata)}</small></span></label>`;
    }).join('');

    modal({
      title: previous ? 'Ndrysho protokollin' : 'Krijo protokoll',
      subtitle: products.length ? `${products.length} produkte me autorizim aktiv janë të disponueshme.` : 'Selektimi i barnave është i bllokuar derisa të importohet regjistri aktual.',
      kicker: 'ICD + REGJISTRI I KOSOVËS',
      body: `<form class="protocol-editor" id="registryProtocolForm">
        <input type="hidden" id="registryProtocolId" value="${escapeHTML(previous?.id || createId())}">
        <section class="editor-section"><h3>1. Diagnoza dhe konteksti</h3><div class="editor-grid">
          <label class="full">Titulli<input id="registryProtocolTitle" required maxlength="120" value="${escapeHTML(previous?.title || '')}" placeholder="P.sh. Pneumonia e komunitetit – menaxhimi fillestar"></label>
          <label>Diagnoza<select id="registryProtocolDiagnosis"><option value="">Zgjidh diagnozën</option>${diagnosisOptions}</select></label>
          <label>Konteksti<select id="registryProtocolSetting">${['Ambulancë','Urgjencë','Spital'].map((value) => `<option ${value === previous?.careSetting ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
          <div class="diagnosis-code-preview" id="registryIcdPreview">${renderIcd(previous?.diagnosis)}</div>
          <label class="full">Përmbledhja<textarea id="registryProtocolSummary">${escapeHTML(previous?.summary || '')}</textarea></label>
        </div></section>
        <section class="editor-section"><h3>2. Produkte të regjistruara</h3><p>Shfaqen vetëm autorizimet aktive dhe aktuale. Produktet e skaduara, të tërhequra ose historike nuk mund të zgjidhen.</p>
          ${products.length ? `<div class="workspace-toolbar"><input id="registryProductSearch" type="search" placeholder="Kërko emrin tregtar, gjenerikun, ATC-në…"><label style="display:flex;align-items:center;gap:7px"><input id="essentialOnly" type="checkbox"> Vetëm esenciale</label></div><div class="drug-check-list" id="registryProductList">${productRows}</div>` : `<div class="clinical-warning"><strong>Nuk ka ende produkte aktive të importuara.</strong><br>Ngarko regjistrin më të fundit të AKPPM-së; LBE 2025 nuk trajtohet si regjistër i plotë.${loadError ? `<br><small>${escapeHTML(loadError)}</small>` : ''}</div>`}
        </section>
        <section class="editor-section"><h3>3. Hapat dhe burimet</h3><div class="editor-grid"><label class="full">Hapat klinikë<textarea id="registryProtocolSteps" placeholder="Një hap për rresht">${escapeHTML((previous?.steps || []).join('\n'))}</textarea></label><label class="full">Shënime sigurie<textarea id="registryProtocolSafety">${escapeHTML(previous?.safetyNotes || '')}</textarea></label><label class="full">Burimet klinike<textarea id="registryProtocolSources">${escapeHTML(previous?.sourceNotes || '')}</textarea></label></div></section>
        <div class="editor-savebar"><span><span class="privacy-pill">● Private</span> Pa të dhëna identifikuese të pacientit.</span><div><button class="secondary" type="button" data-registry-protocol="cancel">Anulo</button><button class="primary" type="submit" ${products.length ? '' : 'disabled'}>Ruaj draftin</button></div></div>
      </form>`,
    });

    const diagnosisSelect = document.querySelector('#registryProtocolDiagnosis');
    diagnosisSelect?.addEventListener('change', () => updateIcdPreview(diagnosisSelect.value));
    const search = document.querySelector('#registryProductSearch');
    const essentialOnly = document.querySelector('#essentialOnly');
    const filterProducts = () => {
      const q = normalize(search?.value || '');
      document.querySelectorAll('[data-registry-product-label]').forEach((label) => {
        const product = products.find((row) => row.product_id === label.querySelector('input')?.value);
        label.hidden = Boolean((q && !label.dataset.registryProductLabel.includes(q)) || (essentialOnly?.checked && !product?.is_essential));
      });
    };
    search?.addEventListener('input', filterProducts);
    essentialOnly?.addEventListener('change', filterProducts);
    document.querySelector('#registryProtocolForm')?.addEventListener('submit', (event) => saveProtocol(event, products, previous));
  }

  function renderIcd(diagnosis) {
    if (!diagnosis?.icdCode) return '<span>ICD:</span><strong>Nuk është zgjedhur kod.</strong>';
    return `<span>ICD:</span><strong>${escapeHTML(diagnosis.icdCode)}</strong><small>${escapeHTML(diagnosis.icdTitle || '')}</small>`;
  }

  async function updateIcdPreview(id) {
    const item = diagnoses().find((row) => row.id === id);
    const preview = document.querySelector('#registryIcdPreview');
    if (!preview) return;
    if (!item) { preview.innerHTML = renderIcd(null); return; }
    const fallback = icdFallback[item.slug || item.id];
    try {
      const response = await fetch(`${API_URL}?mode=diagnosis-map&slug=${encodeURIComponent(item.slug || item.id)}`);
      const data = response.ok ? await response.json() : { results: [] };
      const mapping = data.results?.[0] || fallback;
      preview.innerHTML = renderIcd(mapping ? { icdCode: mapping.code, icdTitle: mapping.icd_title || mapping.title } : null);
    } catch {
      preview.innerHTML = renderIcd(fallback ? { icdCode: fallback.code, icdTitle: fallback.title } : null);
    }
  }

  function saveProtocol(event, products, previous) {
    event.preventDefault();
    const selectedIds = [...document.querySelectorAll('#registryProductList input:checked')].map((input) => input.value);
    if (!selectedIds.length) { toast('Zgjidh të paktën një produkt me autorizim aktiv.'); return; }
    const diagnosisId = document.querySelector('#registryProtocolDiagnosis').value;
    const diagnosis = diagnoses().find((row) => row.id === diagnosisId);
    const icdCode = document.querySelector('#registryIcdPreview strong')?.textContent || '';
    const icdTitle = document.querySelector('#registryIcdPreview small')?.textContent || '';
    const now = new Date().toISOString();
    const record = {
      id: document.querySelector('#registryProtocolId').value,
      title: document.querySelector('#registryProtocolTitle').value.trim(),
      careSetting: document.querySelector('#registryProtocolSetting').value,
      summary: document.querySelector('#registryProtocolSummary').value.trim(),
      diagnosis: diagnosis ? { id: diagnosis.id, slug: diagnosis.slug || diagnosis.id, name: diagnosis.name, icdCode, icdTitle } : null,
      products: products.filter((product) => selectedIds.includes(product.product_id)),
      steps: document.querySelector('#registryProtocolSteps').value.split('\n').map((line) => line.trim()).filter(Boolean),
      safetyNotes: document.querySelector('#registryProtocolSafety').value.trim(),
      sourceNotes: document.querySelector('#registryProtocolSources').value.trim(),
      registryPolicy: 'active-kosovo-authorizations-only',
      editorialStatus: 'draft',
      version: previous ? Number(previous.version || 1) + 1 : 1,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };
    if (!record.title) { toast('Shkruaj titullin e protokollit.'); return; }
    writeProtocols([record, ...readProtocols().filter((row) => row.id !== record.id)]);
    toast('Protokolli u ruajt me barna të verifikuara nga regjistri.');
    openProtocols();
  }

  function viewProtocol(id) {
    const protocol = readProtocols().find((row) => row.id === id);
    if (!protocol) return;
    modal({
      title: protocol.title,
      subtitle: `${protocol.diagnosis?.name || 'Pa diagnozë'} · ${protocol.diagnosis?.icdCode || 'pa ICD'}`,
      kicker: 'PROTOKOLL PRIVAT',
      body: `<div class="protocol-view"><div><span class="privacy-pill">● Private</span> <span class="source-pill">Regjistri aktiv i Kosovës</span></div><section class="protocol-view-section"><h3>Produktet</h3><div class="protocol-view-list">${protocol.products.map((product) => `<div class="protocol-view-item"><strong>${escapeHTML(product.brand_name)} · ${escapeHTML(product.generic_name)}</strong><small>${escapeHTML([product.dosage_form, product.strength_text, product.manufacturer].filter(Boolean).join(' · '))}</small><small>Autorizimi: ${escapeHTML(product.authorization_number || 'pa numër')} ${product.is_essential ? '· Esencial' : ''}</small></div>`).join('')}</div></section><section class="protocol-view-section"><h3>Hapat</h3><div class="checklist">${protocol.steps.map((step) => `<label><input type="checkbox"><span>${escapeHTML(step)}</span></label>`).join('') || '<div class="workspace-empty">Pa hapa.</div>'}</div></section><div class="clinical-warning">Regjistrimi i produktit nuk e konfirmon vetvetiu indikacionin ose dozën. Verifiko protokollin klinik, SPC-në dhe karakteristikat e pacientit.</div></div>`,
    });
  }

  function removeProtocol(id) {
    const protocol = readProtocols().find((row) => row.id === id);
    if (!protocol || !confirm(`Ta fshij protokollin “${protocol.title}”?`)) return;
    writeProtocols(readProtocols().filter((row) => row.id !== id));
    openProtocols();
  }

  function handleClick(event) {
    const protocolEntry = event.target.closest('[data-clinical-workspace="protocols"]');
    if (protocolEntry) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openProtocols();
      return;
    }
    const action = event.target.closest('[data-registry-protocol]');
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = action.dataset.id || '';
    if (action.dataset.registryProtocol === 'new') openEditor();
    if (action.dataset.registryProtocol === 'edit') openEditor(id);
    if (action.dataset.registryProtocol === 'view') viewProtocol(id);
    if (action.dataset.registryProtocol === 'delete') removeProtocol(id);
    if (action.dataset.registryProtocol === 'cancel') openProtocols();
  }

  document.addEventListener('click', handleClick, true);
  window.DozaKSRegistryProtocols = { open: openProtocols, refreshRegistry: () => getRegisteredProducts(true) };
})();
