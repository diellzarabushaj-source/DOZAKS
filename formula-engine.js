'use strict';

(() => {
  const API_PATH = '/api/product-catalog';
  const FORMULA_KEY = 'dozaks-catalog-formula-v1';
  const PRESET_KEY = 'dozaks-catalog-formula-presets-v1';
  const MAX_RULES = 12;

  const fields = [
    { value: 'trade_name', label: 'Emri tregtar', column: 'D' },
    { value: 'active_substance', label: 'Substanca aktive', column: 'E' },
    { value: 'generic_name', label: 'Bari gjenerik', column: 'E*' },
    { value: 'atc_code', label: 'Kodi ATC', column: 'F*' },
    { value: 'strength_text', label: 'Fortësia', column: 'G*' },
    { value: 'pharmaceutical_form', label: 'Forma farmaceutike', column: 'F' },
    { value: 'package_size', label: 'Paketimi', column: 'H*' },
    { value: 'manufacturer', label: 'Prodhuesi', column: 'I*' },
    { value: 'marketing_authorization_holder', label: 'Bartësi i autorizimit', column: 'J*' },
    { value: 'ma_certificate', label: 'Certifikata MA', column: 'K*' },
    { value: 'product_status', label: 'Statusi i produktit', column: 'L*' },
    { value: 'protocol_no', label: 'ProtocolNo', column: 'B*' },
    { value: 'pdid', label: 'PDID', column: 'C*' },
    { value: 'retail_price', label: 'Çmimi me pakicë', column: 'Q*', numeric: true },
  ];

  const textOperators = [
    ['equals', 'është saktësisht'],
    ['notEquals', 'nuk është'],
    ['startsWith', 'fillon me'],
    ['endsWith', 'mbaron me'],
    ['contains', 'përmban'],
    ['notContains', 'nuk përmban'],
    ['regex', 'përputhet me regex'],
    ['isEmpty', 'është bosh'],
    ['isNotEmpty', 'nuk është bosh'],
  ];

  const numericOperators = [
    ['equals', 'është saktësisht'],
    ['notEquals', 'nuk është'],
    ['gt', 'është më i madh se'],
    ['gte', 'është ≥'],
    ['lt', 'është më i vogël se'],
    ['lte', 'është ≤'],
    ['isEmpty', 'është bosh'],
    ['isNotEmpty', 'nuk është bosh'],
  ];

  let formula = normalizeFormula(readJSON(FORMULA_KEY, { logic: 'AND', rules: [] }));
  let delegatedFetch = window.fetch.bind(window);

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? structuredClone(fallback);
    } catch {
      return structuredClone(fallback);
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function createId() {
    return globalThis.crypto?.randomUUID?.() || `formula-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function toast(message) {
    window.showToast?.(message);
  }

  function normalizeFormula(input) {
    const logic = String(input?.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';
    const rules = Array.isArray(input?.rules)
      ? input.rules.slice(0, MAX_RULES).map((rule) => ({
        id: String(rule.id || createId()),
        field: String(rule.field || ''),
        operator: String(rule.operator || ''),
        value: String(rule.value ?? '').trim(),
      })).filter((rule) => fields.some((field) => field.value === rule.field))
      : [];
    return { logic, rules };
  }

  function validateRegex(pattern) {
    if (!pattern || pattern.length > 180) return false;
    if (/\\[1-9]/.test(pattern)) return false;
    if (/\(\?<([=!])/.test(pattern)) return false;
    if (/\(\?<[A-Za-z]/.test(pattern)) return false;
    if (/\(\?>/.test(pattern)) return false;
    if (/\(\?\(/.test(pattern)) return false;
    try {
      new RegExp(pattern, 'i');
      return true;
    } catch {
      return false;
    }
  }

  function patchFetch() {
    if (window.__dozaksFormulaFetchPatched) return;
    window.__dozaksFormulaFetchPatched = true;
    delegatedFetch = window.fetch.bind(window);

    window.fetch = (input, init) => {
      const sourceUrl = typeof input === 'string' ? input : input?.url;
      if (!sourceUrl) return delegatedFetch(input, init);

      let url;
      try {
        url = new URL(sourceUrl, location.href);
      } catch {
        return delegatedFetch(input, init);
      }

      const isCatalogSearch = url.origin === location.origin
        && url.pathname === API_PATH
        && (!url.searchParams.get('mode') || url.searchParams.get('mode') === 'search');

      if (isCatalogSearch) {
        if (formula.rules.length) url.searchParams.set('formula', JSON.stringify(formula));
        else url.searchParams.delete('formula');
      }

      const requestInput = typeof input === 'string'
        ? url.toString()
        : new Request(url.toString(), input);
      return delegatedFetch(requestInput, init);
    };
  }

  function injectStyles() {
    if (document.querySelector('#catalogFormulaStyles')) return;
    const style = document.createElement('style');
    style.id = 'catalogFormulaStyles';
    style.textContent = `
      .formula-engine{margin-top:13px;padding-top:13px;border-top:1px solid #d9e3ef}
      .formula-engine-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .formula-engine-head span{display:block;color:#1559ae;font-size:9px;font-weight:950;letter-spacing:.085em}.formula-engine-head h4{margin:3px 0 0;font-size:14px}.formula-engine-head small{display:block;margin-top:4px;color:#65758a;font-size:9px;line-height:1.45}
      .formula-logic{display:inline-flex;padding:3px;border:1px solid #cbd8e8;border-radius:9px;background:#fff}.formula-logic button{min-height:31px;padding:6px 9px;border:0;border-radius:6px;background:transparent;color:#607087;font-size:9px;font-weight:900}.formula-logic button.active{background:#1559ae;color:#fff}
      .formula-builder{display:grid;grid-template-columns:1.1fr 1fr 1.35fr auto;gap:8px;align-items:end}.formula-builder label{display:grid;gap:5px;color:#536079;font-size:9px;font-weight:850}.formula-builder select,.formula-builder input{min-height:40px;width:100%;padding:8px 9px;border:1px solid #c8d5e5;border-radius:8px;background:#fff;color:#17263b}.formula-builder button{min-height:40px;padding:8px 11px;border:1px solid #1664c0;border-radius:8px;background:#1664c0;color:#fff;font-size:9px;font-weight:900}
      .formula-rules{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.formula-rule{display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid #c9dbf4;border-radius:9px;background:#fff;color:#244b76;font-size:9px;font-weight:800}.formula-rule b{color:#123b70}.formula-rule button{border:0;background:none;color:#8a3340;font-size:12px}
      .formula-preview{margin-top:10px;padding:10px 11px;border:1px solid #d7e2ef;border-radius:9px;background:#0c2340;color:#dceaff;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:9px;line-height:1.6;overflow:auto;white-space:nowrap}.formula-preview strong{color:#85b8ff}
      .formula-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px}.formula-actions button,.formula-actions select{min-height:34px;padding:6px 9px;border:1px solid #cad7e6;border-radius:8px;background:#fff;color:#2b4b6c;font-size:9px;font-weight:850}.formula-actions .danger{color:#a52a3b}.formula-count{padding:4px 7px;border-radius:999px;background:#edf4ff;color:#1559ae;font-size:8px;font-weight:900}
      @media(max-width:820px){.formula-builder{grid-template-columns:1fr 1fr}.formula-builder label:nth-child(3){grid-column:1/-1}.formula-builder>button{grid-column:1/-1}}
      @media(max-width:520px){.formula-engine-head{flex-direction:column}.formula-builder{grid-template-columns:1fr}.formula-builder label:nth-child(3),.formula-builder>button{grid-column:auto}.formula-preview{white-space:normal;word-break:break-word}}
    `;
    document.head.appendChild(style);
  }

  function ensureUI() {
    const panel = document.querySelector('#catalogFilterPanel');
    const foot = panel?.querySelector('.catalog-filter-foot');
    if (!panel || !foot || panel.querySelector('#catalogFormulaEngine')) return Boolean(panel?.querySelector('#catalogFormulaEngine'));

    const section = document.createElement('section');
    section.id = 'catalogFormulaEngine';
    section.className = 'formula-engine';
    section.innerHTML = `
      <div class="formula-engine-head">
        <div><span>FORMULA ENGINE</span><h4>Filtro si në Excel/Google Sheets</h4><small>Rregullat ekzekutohen në Neon mbi katalogun zyrtar. I njëjti rregull jep të njëjtin rezultat.</small></div>
        <div class="formula-logic" aria-label="Logjika e formulës"><button type="button" data-formula-logic="AND">DHE</button><button type="button" data-formula-logic="OR">OSE</button></div>
      </div>
      <div class="formula-builder">
        <label>Kolona<select id="formulaField">${fields.map((field) => `<option value="${field.value}">${escapeHTML(field.label)}</option>`).join('')}</select></label>
        <label>Operatori<select id="formulaOperator"></select></label>
        <label>Vlera<input id="formulaValue" autocomplete="off" placeholder="P.sh. tabletë"></label>
        <button type="button" data-formula-action="add">＋ Shto rregullin</button>
      </div>
      <div class="formula-rules" id="formulaRules"></div>
      <div class="formula-preview" id="formulaPreview"></div>
      <div class="formula-actions">
        <span class="formula-count" id="formulaRuleCount">0 rregulla</span>
        <button type="button" data-formula-action="save">Ruaj formulën</button>
        <select id="formulaPresets"><option value="">Formulat e ruajtura…</option></select>
        <button class="danger" type="button" data-formula-action="clear">Pastro formulën</button>
      </div>`;
    panel.insertBefore(section, foot);

    section.querySelector('#formulaField')?.addEventListener('change', updateOperatorOptions);
    section.querySelector('#formulaOperator')?.addEventListener('change', syncValueState);
    section.querySelector('#formulaValue')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addRule();
      }
    });
    updateOperatorOptions();
    renderFormula();
    renderPresets();
    return true;
  }

  function operatorRows() {
    const field = fields.find((item) => item.value === document.querySelector('#formulaField')?.value);
    return field?.numeric ? numericOperators : textOperators;
  }

  function updateOperatorOptions() {
    const select = document.querySelector('#formulaOperator');
    if (!select) return;
    const previous = select.value;
    select.innerHTML = operatorRows().map(([value, label]) => `<option value="${value}">${escapeHTML(label)}</option>`).join('');
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
    syncValueState();
  }

  function syncValueState() {
    const input = document.querySelector('#formulaValue');
    const operator = document.querySelector('#formulaOperator')?.value;
    if (!input) return;
    const optional = operator === 'isEmpty' || operator === 'isNotEmpty';
    input.disabled = optional;
    input.placeholder = optional ? 'Nuk kërkohet vlerë' : 'P.sh. tabletë';
    if (optional) input.value = '';
  }

  function addRule() {
    if (formula.rules.length >= MAX_RULES) {
      toast(`Lejohen maksimumi ${MAX_RULES} rregulla në një formulë.`);
      return;
    }
    const field = document.querySelector('#formulaField')?.value || '';
    const operator = document.querySelector('#formulaOperator')?.value || '';
    const value = document.querySelector('#formulaValue')?.value.trim() || '';
    const optional = operator === 'isEmpty' || operator === 'isNotEmpty';
    if (!field || !operator || (!optional && !value)) {
      toast('Zgjidh kolonën, operatorin dhe vlerën.');
      return;
    }
    if (operator === 'regex' && !validateRegex(value)) {
      toast('Regex-i nuk është i vlefshëm ose përdor sintaksë të pambështetur.');
      return;
    }
    formula.rules.push({ id: createId(), field, operator, value });
    const input = document.querySelector('#formulaValue');
    if (input) input.value = '';
    persistAndRefresh();
  }

  function removeRule(id) {
    formula.rules = formula.rules.filter((rule) => rule.id !== id);
    persistAndRefresh();
  }

  function setLogic(logic) {
    formula.logic = logic === 'OR' ? 'OR' : 'AND';
    persistAndRefresh();
  }

  function clearFormula() {
    formula = { logic: 'AND', rules: [] };
    persistAndRefresh();
  }

  function persistAndRefresh() {
    formula = normalizeFormula(formula);
    writeJSON(FORMULA_KEY, formula);
    renderFormula();
    refreshSearch();
    window.dispatchEvent(new CustomEvent('dozaks:formula-change', { detail: structuredClone(formula) }));
  }

  function refreshSearch() {
    const input = document.querySelector('#searchInput');
    const query = input?.value.trim() || '';
    if (query.length >= 2 || formula.rules.length) {
      window.DozaKSProductCatalog?.search?.(query, { force: true, showLoading: true });
      input?.focus();
    }
  }

  function ruleLabel(rule) {
    const field = fields.find((item) => item.value === rule.field)?.label || rule.field;
    const operator = [...textOperators, ...numericOperators].find(([value]) => value === rule.operator)?.[1] || rule.operator;
    const value = ['isEmpty', 'isNotEmpty'].includes(rule.operator) ? '' : ` “${rule.value}”`;
    return `${field} ${operator}${value}`;
  }

  function buildSheetCondition(rule) {
    const field = fields.find((item) => item.value === rule.field) || fields[0];
    const range = `Products!${field.column}:${field.column}`;
    const value = String(rule.value || '').replace(/"/g, '""');
    const quoted = `"${value}"`;
    const conditions = {
      equals: `LOWER(${range})=LOWER(${quoted})`,
      notEquals: `LOWER(${range})<>LOWER(${quoted})`,
      startsWith: `REGEXMATCH(${range}; "(?i)^" & ${quoted})`,
      endsWith: `REGEXMATCH(${range}; "(?i)" & ${quoted} & "$")`,
      contains: `REGEXMATCH(${range}; "(?i)" & ${quoted})`,
      notContains: `NOT(REGEXMATCH(${range}; "(?i)" & ${quoted}))`,
      regex: `REGEXMATCH(${range}; "(?i)${value}")`,
      isEmpty: `${range}=""`,
      isNotEmpty: `${range}<>""`,
      gt: `${range}>${Number(value)}`,
      gte: `${range}>=${Number(value)}`,
      lt: `${range}<${Number(value)}`,
      lte: `${range}<=${Number(value)}`,
    };
    return conditions[rule.operator] || `${range}=${quoted}`;
  }

  function buildSheetFormula() {
    if (!formula.rules.length) return '=IFERROR(FILTER(Products!A3:R; TRUE); "Nuk u gjet asnjë bar")';
    const separator = formula.logic === 'AND' ? ' * ' : ' + ';
    const conditions = formula.rules.map((rule) => `(${buildSheetCondition(rule)})`).join(separator);
    return `=IFERROR(FILTER(Products!A3:R; ${conditions}); "Nuk u gjet asnjë bar")`;
  }

  function renderFormula() {
    document.querySelectorAll('[data-formula-logic]').forEach((button) => {
      button.classList.toggle('active', button.dataset.formulaLogic === formula.logic);
    });
    const rules = document.querySelector('#formulaRules');
    if (rules) {
      rules.innerHTML = formula.rules.length
        ? formula.rules.map((rule, index) => `<span class="formula-rule"><b>${index ? escapeHTML(formula.logic === 'AND' ? 'DHE' : 'OSE') : 'KU'}</b>${escapeHTML(ruleLabel(rule))}<button type="button" data-formula-remove="${escapeHTML(rule.id)}" aria-label="Hiq rregullin">×</button></span>`).join('')
        : '<span class="formula-rule">Nuk ka formulë aktive.</span>';
    }
    const count = document.querySelector('#formulaRuleCount');
    if (count) count.textContent = `${formula.rules.length} ${formula.rules.length === 1 ? 'rregull' : 'rregulla'}`;
    const preview = document.querySelector('#formulaPreview');
    if (preview) preview.innerHTML = `<strong>Formula:</strong> ${escapeHTML(buildSheetFormula())}`;
  }

  function savePreset() {
    if (!formula.rules.length) {
      toast('Shto të paktën një rregull para ruajtjes.');
      return;
    }
    const name = prompt('Emri i formulës:', `Formula ${new Date().toLocaleDateString('sq-AL')}`)?.trim();
    if (!name) return;
    const presets = readJSON(PRESET_KEY, []);
    const record = { id: createId(), name: name.slice(0, 80), formula: structuredClone(formula), createdAt: new Date().toISOString() };
    writeJSON(PRESET_KEY, [record, ...presets].slice(0, 40));
    renderPresets();
    toast('Formula u ruajt.');
  }

  function renderPresets() {
    const select = document.querySelector('#formulaPresets');
    if (!select) return;
    const presets = readJSON(PRESET_KEY, []);
    select.innerHTML = '<option value="">Formulat e ruajtura…</option>' + presets.map((preset) => `<option value="${escapeHTML(preset.id)}">${escapeHTML(preset.name)}</option>`).join('');
  }

  function loadPreset(id) {
    const preset = readJSON(PRESET_KEY, []).find((item) => item.id === id);
    if (!preset) return;
    formula = normalizeFormula(preset.formula);
    persistAndRefresh();
    toast(`Formula “${preset.name}” u aktivizua.`);
  }

  function handleClick(event) {
    const logic = event.target.closest('[data-formula-logic]');
    if (logic) {
      setLogic(logic.dataset.formulaLogic);
      return;
    }
    const remove = event.target.closest('[data-formula-remove]');
    if (remove) {
      removeRule(remove.dataset.formulaRemove);
      return;
    }
    const action = event.target.closest('[data-formula-action]')?.dataset.formulaAction;
    if (action === 'add') addRule();
    if (action === 'clear') clearFormula();
    if (action === 'save') savePreset();
  }

  function start() {
    injectStyles();
    patchFetch();
    const ready = ensureUI();
    if (!ready) {
      const observer = new MutationObserver(() => {
        if (ensureUI()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    document.addEventListener('click', handleClick);
    document.addEventListener('change', (event) => {
      if (event.target?.id === 'formulaPresets' && event.target.value) loadPreset(event.target.value);
    });

    window.DozaKSFormulaEngine = {
      getFormula: () => structuredClone(formula),
      setFormula: (next) => { formula = normalizeFormula(next); persistAndRefresh(); },
      clear: clearFormula,
      preview: buildSheetFormula,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
