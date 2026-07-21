'use strict';

(() => {
  const API_URL = '/api/clinical-reference';
  const STORAGE_KEY = 'dozaks-personal-protocols-v1';
  const LAST_ICD_KEY = 'dozaks-last-icd-selection';

  const fallbackIcd = [
    { code: 'I10', title: 'Essential (primary) hypertension', system_name: 'ICD-10', release_id: '2019' },
    { code: 'N39.0', title: 'Urinary tract infection, site not specified', system_name: 'ICD-10', release_id: '2019' },
    { code: 'J18.9', title: 'Pneumonia, unspecified organism', system_name: 'ICD-10', release_id: '2019' },
  ];

  const diagnosisIcdFallback = {
    hypertension: { code: 'I10', title: 'Essential (primary) hypertension' },
    uti: { code: 'N39.0', title: 'Urinary tract infection, site not specified' },
    'urinary-tract-infection': { code: 'N39.0', title: 'Urinary tract infection, site not specified' },
    'community-pneumonia': { code: 'J18.9', title: 'Pneumonia, unspecified organism' },
    'community-acquired-pneumonia': { code: 'J18.9', title: 'Pneumonia, unspecified organism' },
  };

  const normalize = (value = '') => String(value)
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);

  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };

  const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const createId = () => globalThis.crypto?.randomUUID?.() || `protocol-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const protocols = () => readJSON(STORAGE_KEY, []);
  const diagnosisItems = () => (globalThis.clinicalItems || []).filter((item) => item.type === 'diagnosis');
  const drugItems = () => globalThis.catalog || [];

  function notify(message) {
    if (typeof globalThis.showToast === 'function') globalThis.showToast(message);
  }

  async function fetchJSON(mode, params = {}) {
    const query = new URLSearchParams({ mode, ...params });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(`${API_URL}?${query}`, {
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

  function openWorkspaceModal(config) {
    if (typeof globalThis.openModal !== 'function') {
      notify('Moduli nuk është ende gati. Rifresko faqen.');
      return;
    }
    globalThis.openModal(config);
  }

  function injectStyles() {
    if (document.querySelector('#clinicalWorkspaceStyles')) return;
    const style = document.createElement('style');
    style.id = 'clinicalWorkspaceStyles';
    style.textContent = `
      .clinical-hub{margin:14px 0 18px}.clinical-hub-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .clinical-hub-card{display:flex;align-items:center;gap:13px;min-height:92px;padding:15px;border:1px solid var(--line);border-radius:14px;background:#fff;text-align:left;box-shadow:0 4px 17px rgba(8,30,66,.04);transition:.16s}
      .clinical-hub-card:hover{border-color:#b9d1f3;transform:translateY(-2px);box-shadow:var(--shadow)}.clinical-hub-card>span:nth-child(2){min-width:0;flex:1}
      .clinical-hub-card strong{display:block;font-size:14px}.clinical-hub-card small{display:block;margin-top:5px;color:var(--muted);line-height:1.45}.clinical-hub-card .arrow{color:var(--blue);font-weight:900}
      .workspace-kicker{display:block;margin-bottom:4px;color:var(--blue);font-size:9px;font-weight:800;letter-spacing:.1em}.privacy-pill,.source-pill,.review-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:800}
      .privacy-pill{background:#edf7f3;color:#087254}.source-pill{background:#edf4ff;color:#235eaa}.review-pill{background:#fff4dd;color:#8a5b00}
      .workspace-toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:14px}.workspace-toolbar input,.workspace-toolbar select{min-height:42px;flex:1;min-width:180px;padding:9px 11px;border:1px solid #ced8e6;border-radius:9px;background:#fff}
      .workspace-toolbar .primary{min-height:42px}.workspace-empty{padding:30px 15px;border:1px dashed #cbd7e7;border-radius:12px;background:#fafcff;text-align:center;color:var(--muted)}
      .protocol-list{display:grid;gap:10px}.protocol-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff}
      .protocol-row h3{margin:3px 0 5px;font-size:15px}.protocol-row p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}.protocol-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.protocol-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.protocol-actions button{padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:#fff}.protocol-actions .danger-text{color:#a73440}
      .protocol-editor{display:grid;gap:16px}.editor-section{padding:15px;border:1px solid var(--line);border-radius:12px;background:#fff}.editor-section h3{margin:0 0 12px;font-size:15px}.editor-section>p{margin:-5px 0 13px;color:var(--muted);font-size:11px;line-height:1.5}
      .editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.editor-grid .full{grid-column:1/-1}.editor-grid label,.drug-config label{display:grid;gap:6px;color:#536079;font-size:11px;font-weight:700}.editor-grid input,.editor-grid select,.editor-grid textarea,.drug-config input,.drug-config select,.drug-config textarea{width:100%;padding:10px 11px;border:1px solid #ced8e6;border-radius:9px;background:#fff;color:var(--text)}
      .editor-grid textarea,.drug-config textarea{min-height:82px;resize:vertical}.diagnosis-code-preview{grid-column:1/-1;display:flex;align-items:center;gap:9px;min-height:45px;padding:10px 12px;border-radius:10px;background:#f3f7fd;color:#36516f;font-size:12px}.diagnosis-code-preview strong{color:var(--navy)}
      .drug-picker{display:grid;grid-template-columns:minmax(180px,.75fr) minmax(0,1.35fr);gap:12px}.drug-check-list{max-height:330px;overflow:auto;border:1px solid var(--line);border-radius:10px}.drug-check-list label{display:flex;align-items:center;gap:9px;padding:10px;border-bottom:1px solid #edf0f5;font-size:12px}.drug-check-list label:last-child{border-bottom:0}.drug-check-list input{width:17px;height:17px}.drug-config-list{display:grid;gap:10px}.drug-config{padding:12px;border:1px solid #d9e2ef;border-radius:10px;background:#fafcff}.drug-config-header{display:flex;justify-content:space-between;gap:8px;margin-bottom:10px}.drug-config-header strong{font-size:13px}.drug-config-header span{color:var(--muted);font-size:10px}.drug-config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.drug-config-grid .full{grid-column:1/-1}
      .editor-savebar{position:sticky;bottom:-20px;z-index:3;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 0 3px;background:linear-gradient(transparent,#fff 25%)}.editor-savebar>span{color:var(--muted);font-size:11px}.editor-savebar div{display:flex;gap:8px}
      .icd-results,.essential-results{display:grid;gap:8px}.reference-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:11px;padding:12px;border:1px solid var(--line);border-radius:11px;background:#fff;text-align:left}.reference-row:hover{border-color:#bad1f0;background:#fbfdff}.reference-code{display:inline-grid;min-width:68px;place-items:center;padding:7px 8px;border-radius:8px;background:#eaf2ff;color:#1559ae;font-weight:900}.reference-row strong{display:block;font-size:13px}.reference-row small{display:block;margin-top:4px;color:var(--muted);line-height:1.45}.reference-row em{font-style:normal;color:#4d6583;font-size:10px;white-space:nowrap}
      .reference-note{margin-top:13px;padding:11px 12px;border-left:3px solid var(--blue);border-radius:8px;background:#f2f7ff;color:#36516f;font-size:11px;line-height:1.55}.protocol-view{display:grid;gap:13px}.protocol-view-section{padding:14px;border:1px solid var(--line);border-radius:11px}.protocol-view-section h3{margin:0 0 10px;font-size:14px}.protocol-view-list{display:grid;gap:8px}.protocol-view-item{padding:10px;border-radius:9px;background:#f7f9fc}.protocol-view-item strong{display:block}.protocol-view-item small{display:block;margin-top:4px;color:var(--muted);line-height:1.45}
      @media(max-width:850px){.clinical-hub-grid{grid-template-columns:1fr}.drug-picker{grid-template-columns:1fr}.editor-grid,.drug-config-grid{grid-template-columns:1fr}.editor-grid .full,.drug-config-grid .full{grid-column:auto}.protocol-row{grid-template-columns:1fr}.protocol-actions{justify-content:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function injectNavigation() {
    if (document.querySelector('[data-clinical-workspace="protocols"]')) return;
    const nav = document.querySelector('#sidebar nav');
    if (!nav) return;
    const toolsLabel = [...nav.querySelectorAll('.nav-label')].find((item) => normalize(item.textContent).includes('mjetet klinike'));
    const fragment = document.createDocumentFragment();
    const label = document.createElement('div');
    label.className = 'nav-label';
    label.textContent = 'VENDIMMARRJA KLINIKE';
    fragment.appendChild(label);
    fragment.appendChild(makeNavButton('protocols', '▣', 'Protokollet e mia'));
    fragment.appendChild(makeNavButton('icd', 'ICD', 'ICD-10 / ICD-11'));
    fragment.appendChild(makeNavButton('essential', 'E', 'Lista esenciale'));
    nav.insertBefore(fragment, toolsLabel || null);
  }

  function makeNavButton(action, icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item';
    button.dataset.clinicalWorkspace = action;
    button.innerHTML = `<span class="nav-icon">${escapeHTML(icon)}</span><span>${escapeHTML(label)}</span>`;
    return button;
  }

  function injectHub() {
    if (document.querySelector('.clinical-hub')) return;
    const workspace = document.querySelector('.workspace-section');
    if (!workspace) return;
    const section = document.createElement('section');
    section.className = 'clinical-hub';
    section.setAttribute('aria-labelledby', 'clinicalHubTitle');
    section.innerHTML = `
      <div class="section-heading"><div><span>VENDIMMARRJA KLINIKE</span><h2 id="clinicalHubTitle">Diagnoza, kodi dhe plani në një vend</h2></div><small>Pa ruajtur të dhëna identifikuese të pacientit.</small></div>
      <div class="clinical-hub-grid">
        <button class="clinical-hub-card" type="button" data-clinical-workspace="protocols"><span class="bubble blue">▣</span><span><strong>Protokollet e mia</strong><small>Lidh diagnozën, barnat, hapat dhe burimet në një draft privat.</small></span><span class="arrow">→</span></button>
        <button class="clinical-hub-card" type="button" data-clinical-workspace="icd"><span class="bubble purple">ICD</span><span><strong>Kërko kodin ICD</strong><small>ICD-10 praktik, me strukturë të gatshme për ICD-11.</small></span><span class="arrow">→</span></button>
        <button class="clinical-hub-card" type="button" data-clinical-workspace="essential"><span class="bubble green">E</span><span><strong>Lista esenciale</strong><small>Forma, forca, niveli institucional, ATC dhe faqja burimore.</small></span><span class="arrow">→</span></button>
      </div>`;
    workspace.parentNode.insertBefore(section, workspace);
  }

  function openProtocols() {
    const list = protocols().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    openWorkspaceModal({
      title: 'Protokollet e mia',
      subtitle: 'Plane private pune. Nuk përmbajnë të dhëna identifikuese të pacientit dhe nuk publikohen automatikisht.',
      kicker: 'HAPËSIRA PERSONALE',
      body: `
        <div class="workspace-toolbar"><span class="privacy-pill">● Private · kjo pajisje</span><button class="primary" type="button" data-protocol-action="new">+ Protokoll i ri</button></div>
        <div class="protocol-list">${list.length ? list.map(protocolRow).join('') : '<div class="workspace-empty"><strong>Nuk ke ende protokoll.</strong><br><small>Krijo një plan duke zgjedhur diagnozën, barnat dhe hapat klinikë.</small></div>'}</div>
        <div class="reference-note">Protokolli personal është mjet organizimi. Ai nuk e shndërron automatikisht një dozë të paverifikuar në rekomandim klinik dhe nuk zëvendëson protokollin institucional.</div>`,
    });
  }

  function protocolRow(protocol) {
    const diagnosis = protocol.diagnosis?.name || 'Pa diagnozë';
    const code = protocol.diagnosis?.icdCode || 'pa ICD';
    return `<article class="protocol-row">
      <div><span class="workspace-kicker">VERSIONI ${Number(protocol.version || 1)}</span><h3>${escapeHTML(protocol.title)}</h3><p>${escapeHTML(diagnosis)} · ${escapeHTML(code)} · ${escapeHTML(protocol.careSetting || 'Pa kontekst')}</p><div class="protocol-meta"><span class="privacy-pill">Private</span><span class="source-pill">${(protocol.drugs || []).length} barna</span><span class="review-pill">Draft</span></div></div>
      <div class="protocol-actions"><button type="button" data-protocol-action="view" data-protocol-id="${escapeHTML(protocol.id)}">Hap</button><button type="button" data-protocol-action="edit" data-protocol-id="${escapeHTML(protocol.id)}">Ndrysho</button><button type="button" data-protocol-action="export" data-protocol-id="${escapeHTML(protocol.id)}">Eksporto</button><button class="danger-text" type="button" data-protocol-action="delete" data-protocol-id="${escapeHTML(protocol.id)}">Fshi</button></div>
    </article>`;
  }

  function openProtocolEditor(protocolId = '') {
    const existing = protocols().find((item) => item.id === protocolId);
    const protocol = existing || {
      id: createId(), title: '', specialty: '', careSetting: 'Ambulancë', population: 'I rritur',
      summary: '', diagnosis: null, drugs: [], steps: [], safetyNotes: '', sourceNotes: '', version: 1,
    };
    const selectedDrugIds = new Set((protocol.drugs || []).map((item) => item.id));
    const diagnoses = diagnosisItems();
    const drugs = drugItems();
    const selectedDiagnosisId = protocol.diagnosis?.id || '';

    openWorkspaceModal({
      title: existing ? 'Ndrysho protokollin' : 'Krijo protokoll',
      subtitle: 'Zgjidh diagnozën dhe barnat. Dozat e futura mbeten draft privat deri në verifikim.',
      kicker: 'PROTOKOLL PRIVAT',
      body: `
        <form class="protocol-editor" id="protocolEditorForm">
          <input type="hidden" id="protocolId" value="${escapeHTML(protocol.id)}">
          <section class="editor-section"><h3>1. Identiteti klinik</h3><p>Shkruaj planin klinik, jo emrin apo të dhënat e pacientit.</p>
            <div class="editor-grid">
              <label class="full">Titulli<input id="protocolTitle" required maxlength="120" value="${escapeHTML(protocol.title)}" placeholder="P.sh. Menaxhimi fillestar i pneumonisë në ambulancë"></label>
              <label>Diagnoza<select id="protocolDiagnosis"><option value="">Zgjidh diagnozën</option>${diagnoses.map((item) => `<option value="${escapeHTML(item.id)}" ${item.id === selectedDiagnosisId ? 'selected' : ''}>${escapeHTML(item.name)}</option>`).join('')}</select></label>
              <label>Konteksti<select id="protocolCareSetting">${['Ambulancë','Urgjencë','Spital','Kujdes shtëpiak'].map((value) => `<option ${value === protocol.careSetting ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
              <label>Popullata<select id="protocolPopulation">${['I rritur','Fëmijë','I moshuar','Shtatzëni / gjidhënie'].map((value) => `<option ${value === protocol.population ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
              <label>Specialiteti<input id="protocolSpecialty" value="${escapeHTML(protocol.specialty || '')}" placeholder="P.sh. Mjekësi familjare"></label>
              <div class="diagnosis-code-preview" id="diagnosisCodePreview">${renderDiagnosisCodePreview(protocol.diagnosis)}</div>
              <label class="full">Qëllimi / përmbledhja<textarea id="protocolSummary" placeholder="Kur përdoret ky protokoll dhe çfarë synon të standardizojë?">${escapeHTML(protocol.summary || '')}</textarea></label>
            </div>
          </section>
          <section class="editor-section"><h3>2. Barnat e protokollit</h3><p>Zgjidh barnat dhe dokumento rolin. Fusha “doza” nuk verifikohet automatikisht.</p>
            <div class="drug-picker">
              <div><div class="workspace-toolbar"><input id="protocolDrugSearch" type="search" placeholder="Filtro barnat…"></div><div class="drug-check-list" id="protocolDrugChecklist">${drugs.map((drug) => `<label data-drug-label="${escapeHTML(normalize(`${drug.name} ${drug.group}`))}"><input type="checkbox" value="${escapeHTML(drug.id)}" ${selectedDrugIds.has(drug.id) ? 'checked' : ''}><span><strong>${escapeHTML(drug.name)}</strong><br><small>${escapeHTML(drug.group || '')}</small></span></label>`).join('')}</div></div>
              <div class="drug-config-list" id="protocolDrugConfig">${renderDrugConfigurations(protocol.drugs || [], drugs)}</div>
            </div>
          </section>
          <section class="editor-section"><h3>3. Hapat, siguria dhe burimet</h3><p>Një hap për rresht. Vendos qartë monitorimin dhe kriteret e eskalimit.</p>
            <div class="editor-grid">
              <label class="full">Hapat klinikë<textarea id="protocolSteps" placeholder="Vlerëso stabilitetin hemodinamik\nKonfirmo diagnozën dhe faktorët komplikues\nZgjidh terapinë sipas burimit të verifikuar">${escapeHTML((protocol.steps || []).map((step) => step.instruction || step.title).join('\n'))}</textarea></label>
              <label class="full">Shënime sigurie<textarea id="protocolSafety" placeholder="Alergjitë, funksioni renal/hepatik, shtatzënia, interaksionet, monitorimi…">${escapeHTML(protocol.safetyNotes || '')}</textarea></label>
              <label class="full">Burimet / versioni institucional<textarea id="protocolSources" placeholder="Titulli, organizata, viti, versioni ose linku i burimit të verifikuar">${escapeHTML(protocol.sourceNotes || '')}</textarea></label>
            </div>
          </section>
          <div class="editor-savebar"><span><span class="privacy-pill">● Private</span> Ruhet vetëm në këtë shfletues.</span><div><button class="secondary" type="button" data-protocol-action="cancel">Anulo</button><button class="primary" type="submit">Ruaj draftin</button></div></div>
        </form>`,
    });

    const form = document.querySelector('#protocolEditorForm');
    const checklist = document.querySelector('#protocolDrugChecklist');
    const search = document.querySelector('#protocolDrugSearch');
    const diagnosisSelect = document.querySelector('#protocolDiagnosis');

    diagnosisSelect?.addEventListener('change', () => updateDiagnosisPreview(diagnosisSelect.value));
    search?.addEventListener('input', () => {
      const query = normalize(search.value);
      checklist?.querySelectorAll('label').forEach((label) => { label.hidden = query && !label.dataset.drugLabel.includes(query); });
    });
    checklist?.addEventListener('change', () => {
      const ids = [...checklist.querySelectorAll('input:checked')].map((input) => input.value);
      const current = collectVisibleDrugConfigurations();
      const rows = ids.map((id) => current.find((item) => item.id === id) || (protocol.drugs || []).find((item) => item.id === id) || { id });
      document.querySelector('#protocolDrugConfig').innerHTML = renderDrugConfigurations(rows, drugs);
    });
    form?.addEventListener('submit', saveProtocolFromForm);
  }

  function renderDiagnosisCodePreview(diagnosis) {
    if (!diagnosis?.icdCode) return '<span>ICD:</span><strong>Nuk është zgjedhur kod.</strong><small>Zgjidh diagnozën për mapping-un fillestar.</small>';
    return `<span>ICD:</span><strong>${escapeHTML(diagnosis.icdCode)}</strong><small>${escapeHTML(diagnosis.icdTitle || '')}</small>`;
  }

  async function updateDiagnosisPreview(id) {
    const item = diagnosisItems().find((entry) => entry.id === id);
    const preview = document.querySelector('#diagnosisCodePreview');
    if (!preview) return;
    if (!item) { preview.innerHTML = renderDiagnosisCodePreview(null); return; }
    const fallback = diagnosisIcdFallback[item.slug || item.id];
    preview.innerHTML = '<span>ICD:</span><strong>Duke kërkuar…</strong>';
    try {
      const data = await fetchJSON('diagnosis-map', { slug: item.slug || item.id });
      const mapping = data.results?.[0] || fallback;
      preview.innerHTML = renderDiagnosisCodePreview(mapping ? { icdCode: mapping.code, icdTitle: mapping.icd_title || mapping.title } : null);
    } catch {
      preview.innerHTML = renderDiagnosisCodePreview(fallback ? { icdCode: fallback.code, icdTitle: fallback.title } : null);
    }
  }

  function renderDrugConfigurations(selected, drugs) {
    if (!selected.length) return '<div class="workspace-empty"><small>Zgjidh të paktën një bar nga lista.</small></div>';
    return selected.map((entry) => {
      const drug = drugs.find((item) => item.id === entry.id) || { id: entry.id, name: entry.name || entry.id, group: '' };
      return `<div class="drug-config" data-drug-config="${escapeHTML(drug.id)}"><div class="drug-config-header"><strong>${escapeHTML(drug.name)}</strong><span>${escapeHTML(drug.group || '')}</span></div><div class="drug-config-grid">
        <label>Roli<input data-field="role" value="${escapeHTML(entry.role || '')}" placeholder="P.sh. zgjedhja e parë / alternativë"></label>
        <label>Rruga<input data-field="route" value="${escapeHTML(entry.route || '')}" placeholder="P.sh. oral / IV / IM"></label>
        <label>Doza – draft<input data-field="doseText" value="${escapeHTML(entry.doseText || '')}" placeholder="Vetëm nga burim i verifikuar"></label>
        <label>Koha / intervali<input data-field="timing" value="${escapeHTML(entry.timing || '')}" placeholder="P.sh. çdo … orë"></label>
        <label>Kohëzgjatja<input data-field="duration" value="${escapeHTML(entry.duration || '')}" placeholder="P.sh. … ditë"></label>
        <label>Maksimumi<input data-field="maxDoseText" value="${escapeHTML(entry.maxDoseText || '')}" placeholder="Nëse aplikohet"></label>
        <label class="full">Siguria<textarea data-field="safetyNotes" placeholder="Kundërindikime, monitorim, rregullim renal…">${escapeHTML(entry.safetyNotes || '')}</textarea></label>
      </div></div>`;
    }).join('');
  }

  function collectVisibleDrugConfigurations() {
    return [...document.querySelectorAll('[data-drug-config]')].map((row) => {
      const id = row.dataset.drugConfig;
      const drug = drugItems().find((item) => item.id === id);
      const value = (field) => row.querySelector(`[data-field="${field}"]`)?.value.trim() || '';
      return { id, name: drug?.name || id, role: value('role'), route: value('route'), doseText: value('doseText'), timing: value('timing'), duration: value('duration'), maxDoseText: value('maxDoseText'), safetyNotes: value('safetyNotes') };
    });
  }

  function saveProtocolFromForm(event) {
    event.preventDefault();
    const id = document.querySelector('#protocolId').value;
    const existingList = protocols();
    const previous = existingList.find((item) => item.id === id);
    const diagnosisId = document.querySelector('#protocolDiagnosis').value;
    const diagnosisItem = diagnosisItems().find((item) => item.id === diagnosisId);
    const fallback = diagnosisItem ? diagnosisIcdFallback[diagnosisItem.slug || diagnosisItem.id] : null;
    const previewStrong = document.querySelector('#diagnosisCodePreview strong')?.textContent || '';
    const previewSmall = document.querySelector('#diagnosisCodePreview small')?.textContent || '';
    const icdCode = previewStrong && !previewStrong.includes('Duke') && !previewStrong.includes('Nuk') ? previewStrong : fallback?.code || '';
    const steps = document.querySelector('#protocolSteps').value.split('\n').map((line) => line.trim()).filter(Boolean).map((instruction, index) => ({ order: index + 1, instruction }));
    const now = new Date().toISOString();
    const record = {
      id,
      title: document.querySelector('#protocolTitle').value.trim(),
      specialty: document.querySelector('#protocolSpecialty').value.trim(),
      careSetting: document.querySelector('#protocolCareSetting').value,
      population: document.querySelector('#protocolPopulation').value,
      summary: document.querySelector('#protocolSummary').value.trim(),
      diagnosis: diagnosisItem ? { id: diagnosisItem.id, slug: diagnosisItem.slug || diagnosisItem.id, name: diagnosisItem.name, icdCode, icdTitle: previewSmall || fallback?.title || '' } : null,
      drugs: collectVisibleDrugConfigurations(),
      steps,
      safetyNotes: document.querySelector('#protocolSafety').value.trim(),
      sourceNotes: document.querySelector('#protocolSources').value.trim(),
      visibility: 'private',
      editorialStatus: 'draft',
      version: previous ? Number(previous.version || 1) + 1 : 1,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };
    if (!record.title) { notify('Shkruaj titullin e protokollit.'); return; }
    writeJSON(STORAGE_KEY, [record, ...existingList.filter((item) => item.id !== id)]);
    notify('Protokolli privat u ruajt.');
    openProtocols();
  }

  function openProtocolView(id) {
    const protocol = protocols().find((item) => item.id === id);
    if (!protocol) return;
    openWorkspaceModal({
      title: protocol.title,
      subtitle: `${protocol.diagnosis?.name || 'Pa diagnozë'} · ${protocol.diagnosis?.icdCode || 'pa ICD'} · Versioni ${protocol.version || 1}`,
      kicker: 'PROTOKOLL PRIVAT',
      body: `<div class="protocol-view"><div><span class="privacy-pill">● Private</span> <span class="review-pill">Draft</span></div>
        <section class="protocol-view-section"><h3>Përmbledhja</h3><p>${escapeHTML(protocol.summary || 'Pa përmbledhje.')}</p></section>
        <section class="protocol-view-section"><h3>Barnat</h3><div class="protocol-view-list">${(protocol.drugs || []).length ? protocol.drugs.map((drug) => `<div class="protocol-view-item"><strong>${escapeHTML(drug.name || drug.id)}</strong><small>${escapeHTML([drug.role, drug.route, drug.doseText, drug.timing, drug.duration].filter(Boolean).join(' · ') || 'Pa detaje dozimi.')}</small>${drug.safetyNotes ? `<small>Siguria: ${escapeHTML(drug.safetyNotes)}</small>` : ''}</div>`).join('') : '<div class="workspace-empty">Nuk ka barna.</div>'}</div></section>
        <section class="protocol-view-section"><h3>Hapat</h3><div class="checklist">${(protocol.steps || []).length ? protocol.steps.map((step) => `<label><input type="checkbox"><span>${escapeHTML(step.instruction)}</span></label>`).join('') : '<div class="workspace-empty">Nuk ka hapa.</div>'}</div></section>
        ${protocol.safetyNotes ? `<section class="protocol-view-section"><h3>Siguria</h3><p>${escapeHTML(protocol.safetyNotes)}</p></section>` : ''}
        ${protocol.sourceNotes ? `<section class="protocol-view-section"><h3>Burimet</h3><p>${escapeHTML(protocol.sourceNotes)}</p></section>` : ''}
        <div class="clinical-warning">Ky është draft personal. Verifiko diagnozën, dozën, rrugën, maksimumin, funksionin renal/hepatik dhe protokollin institucional para përdorimit.</div></div>`,
    });
  }

  function deleteProtocol(id) {
    const protocol = protocols().find((item) => item.id === id);
    if (!protocol || !confirm(`Ta fshij protokollin “${protocol.title}”?`)) return;
    writeJSON(STORAGE_KEY, protocols().filter((item) => item.id !== id));
    notify('Protokolli u fshi.');
    openProtocols();
  }

  function exportProtocol(id) {
    const protocol = protocols().find((item) => item.id === id);
    if (!protocol) return;
    const blob = new Blob([JSON.stringify(protocol, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${normalize(protocol.title).replace(/[^a-z0-9]+/g, '-') || 'dozaks-protokoll'}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Protokolli u eksportua si JSON.');
  }

  function openIcdBrowser() {
    openWorkspaceModal({
      title: 'Kërkimi ICD',
      subtitle: 'ICD-10 për dokumentim praktik dhe strukturë e gatshme për ICD-11.',
      kicker: 'KODIFIKIMI',
      body: `<div class="workspace-toolbar"><input id="icdSearch" type="search" placeholder="Kërko kodin ose diagnozën…" autofocus><select id="icdSystem"><option value="ICD-10">ICD-10</option><option value="ICD-11 MMS">ICD-11</option><option value="all">Të dyja</option></select></div><div class="icd-results" id="icdResults">${renderIcdRows(fallbackIcd)}</div><div class="reference-note">Kodi ndihmon dokumentimin; zgjedhja përfundimtare duhet të përputhet me diagnozën e dokumentuar dhe rregullat e institucionit.</div>`,
    });
    const input = document.querySelector('#icdSearch');
    const system = document.querySelector('#icdSystem');
    let timer;
    const search = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const query = input.value.trim();
        const selectedSystem = system.value;
        const fallback = fallbackIcd.filter((row) => (selectedSystem === 'all' || row.system_name === selectedSystem) && (!query || normalize(`${row.code} ${row.title}`).includes(normalize(query))));
        document.querySelector('#icdResults').innerHTML = '<div class="workspace-empty">Duke kërkuar…</div>';
        try {
          const data = await fetchJSON('icd', { q: query, system: selectedSystem, limit: '40' });
          document.querySelector('#icdResults').innerHTML = renderIcdRows(data.results?.length ? data.results : fallback);
        } catch {
          document.querySelector('#icdResults').innerHTML = renderIcdRows(fallback);
        }
      }, 220);
    };
    input?.addEventListener('input', search);
    system?.addEventListener('change', search);
  }

  function renderIcdRows(rows) {
    if (!rows.length) return '<div class="workspace-empty">Nuk u gjet kod. Provo një term tjetër.</div>';
    return rows.map((row) => `<button class="reference-row" type="button" data-select-icd="${escapeHTML(row.code || '')}" data-icd-title="${escapeHTML(row.title || '')}"><span class="reference-code">${escapeHTML(row.code || '—')}</span><span><strong>${escapeHTML(row.title || '')}</strong><small>${escapeHTML(row.definition || 'Kategori diagnostike')}</small></span><em>${escapeHTML(row.system_name || '')} · ${escapeHTML(row.release_id || '')}</em></button>`).join('');
  }

  function selectIcd(button) {
    const selection = { code: button.dataset.selectIcd, title: button.dataset.icdTitle, selectedAt: new Date().toISOString() };
    writeJSON(LAST_ICD_KEY, selection);
    navigator.clipboard?.writeText?.(`${selection.code} — ${selection.title}`).catch(() => {});
    notify(`${selection.code} u ruajt dhe u kopjua.`);
  }

  function openEssentialBrowser() {
    openWorkspaceModal({
      title: 'Lista esenciale e Kosovës',
      subtitle: 'Versioni aktiv: forma, forca, kategoria institucionale, ATC dhe faqja burimore.',
      kicker: 'BURIM ZYRTAR I BRENDSHËM',
      body: `<div class="workspace-toolbar"><input id="essentialSearch" type="search" placeholder="Kërko barin, ATC-në ose formën…" autofocus></div><div class="essential-results" id="essentialResults"><div class="workspace-empty">Shkruaj të paktën dy shkronja.</div></div><div class="reference-note">Prania në listën esenciale tregon listimin dhe nivelin e furnizimit; nuk është udhëzim automatik për indikacionin ose dozën.</div>`,
    });
    const input = document.querySelector('#essentialSearch');
    let timer;
    input?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const query = input.value.trim();
        if (query.length < 2) { document.querySelector('#essentialResults').innerHTML = '<div class="workspace-empty">Shkruaj të paktën dy shkronja.</div>'; return; }
        document.querySelector('#essentialResults').innerHTML = '<div class="workspace-empty">Duke kërkuar…</div>';
        try {
          const data = await fetchJSON('essential', { q: query, limit: '50' });
          document.querySelector('#essentialResults').innerHTML = renderEssentialRows(data.results || []);
        } catch {
          document.querySelector('#essentialResults').innerHTML = '<div class="workspace-empty">Lista është ende në branch-in e verifikimit. Kërkimi aktivizohet pas migrimit të aprovuar.</div>';
        }
      }, 220);
    });
  }

  function renderEssentialRows(rows) {
    if (!rows.length) return '<div class="workspace-empty">Nuk u gjet asnjë rresht.</div>';
    return rows.map((row) => `<button class="reference-row" type="button" ${row.drug_slug ? `data-open-essential-drug="${escapeHTML(row.drug_slug)}"` : ''}><span class="reference-code">${escapeHTML(row.atc_code_raw || 'ATC')}</span><span><strong>${escapeHTML(row.generic_name || row.generic_name_raw || '')}</strong><small>${escapeHTML([row.dosage_form_raw, row.strength_raw, row.route_raw, row.availability_category_raw].filter(Boolean).join(' · '))}</small><small>${escapeHTML((row.category_path || []).join(' › '))}</small></span><em>fq. ${escapeHTML(row.source_page || '')}<br>${escapeHTML(row.version_label || '')}</em></button>`).join('');
  }

  function openEssentialDrug(slug) {
    const item = drugItems().find((drug) => drug.slug === slug || drug.id === slug);
    if (item && typeof globalThis.closeModal === 'function' && typeof globalThis.openItem === 'function') {
      globalThis.closeModal();
      globalThis.openItem(item.id);
    }
  }

  function handleClicks(event) {
    const workspace = event.target.closest('[data-clinical-workspace]');
    if (workspace) {
      const action = workspace.dataset.clinicalWorkspace;
      if (action === 'protocols') openProtocols();
      if (action === 'icd') openIcdBrowser();
      if (action === 'essential') openEssentialBrowser();
      return;
    }
    const protocolAction = event.target.closest('[data-protocol-action]');
    if (protocolAction) {
      const action = protocolAction.dataset.protocolAction;
      const id = protocolAction.dataset.protocolId || '';
      if (action === 'new') openProtocolEditor();
      if (action === 'edit') openProtocolEditor(id);
      if (action === 'view') openProtocolView(id);
      if (action === 'delete') deleteProtocol(id);
      if (action === 'export') exportProtocol(id);
      if (action === 'cancel') openProtocols();
      return;
    }
    const icd = event.target.closest('[data-select-icd]');
    if (icd) { selectIcd(icd); return; }
    const essentialDrug = event.target.closest('[data-open-essential-drug]');
    if (essentialDrug) openEssentialDrug(essentialDrug.dataset.openEssentialDrug);
  }

  function start() {
    injectStyles();
    injectNavigation();
    injectHub();
    document.addEventListener('click', handleClicks);
    globalThis.DozaKSClinicalWorkspace = { openProtocols, openIcd: openIcdBrowser, openEssential: openEssentialBrowser, getProtocols: protocols };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
