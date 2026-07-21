'use strict';

(() => {
  const API_URL = '/api/product-catalog';
  const REQUEST_TIMEOUT = 4200;
  let requestSequence = 0;
  let activeController = null;

  const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);

  const factorLabels = {
    allergy: 'Alergji / hipersensitivitet',
    diagnosis: 'Gjendje klinike',
    pregnancy: 'Shtatzëni',
    lactation: 'Gjidhënie',
    renal: 'Funksioni renal',
    hepatic: 'Funksioni hepatik',
    age: 'Mosha',
    interaction: 'Ndërveprim',
    laboratory: 'Parametër laboratorik',
    route: 'Rruga e administrimit',
    other: 'Tjetër',
  };

  const severityLabels = {
    absolute: 'Kundërindikacion absolut',
    relative: 'Kundërindikacion relativ',
    warning: 'Paralajmërim',
  };

  function injectStyles() {
    if (document.querySelector('#contraindicationsStyles')) return;
    const style = document.createElement('style');
    style.id = 'contraindicationsStyles';
    style.textContent = `
      .catalog-safety{margin:16px 0;border:1px solid #d8e1ec;border-radius:13px;background:#fff;overflow:hidden}
      .catalog-safety-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:13px 14px;border-bottom:1px solid #e6ebf2;background:#f8fafc}
      .catalog-safety-head span{display:block;color:#9b1c31;font-size:9px;font-weight:900;letter-spacing:.085em}
      .catalog-safety-head h4{margin:3px 0 0;font-size:15px;color:#16243a}
      .catalog-safety-count{display:inline-flex;min-width:32px;min-height:28px;align-items:center;justify-content:center;padding:4px 9px;border-radius:999px;background:#eef2f7;color:#42526a;font-size:10px;font-weight:900}
      .catalog-safety-body{display:grid;gap:9px;padding:12px 14px}
      .catalog-safety-state{padding:12px;border-radius:10px;background:#f7f9fc;color:#536079;font-size:11px;line-height:1.55}
      .catalog-safety-state strong{color:#24364f}.catalog-safety-state.caution{border-left:3px solid #d68a00;background:#fff9eb;color:#72510a}
      .catalog-safety-item{border:1px solid #e0e6ef;border-radius:10px;background:#fff;overflow:hidden}
      .catalog-safety-item[open]{box-shadow:0 8px 24px rgba(31,55,87,.06)}
      .catalog-safety-item summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:10px;padding:11px 12px;cursor:pointer;list-style:none}
      .catalog-safety-item summary::-webkit-details-marker{display:none}
      .catalog-safety-icon{display:grid;width:30px;height:30px;place-items:center;border-radius:8px;font-size:12px;font-weight:950}
      .catalog-safety-item.absolute .catalog-safety-icon{background:#feecee;color:#b4233a}
      .catalog-safety-item.relative .catalog-safety-icon{background:#fff4dd;color:#9a6700}
      .catalog-safety-item.warning .catalog-safety-icon{background:#eaf3ff;color:#1559ae}
      .catalog-safety-copy{min-width:0}.catalog-safety-copy strong{display:block;color:#1e2d43;font-size:12px}.catalog-safety-copy small{display:block;margin-top:3px;color:#69778c;font-size:9px}
      .catalog-safety-severity{padding:4px 7px;border-radius:999px;font-size:8px;font-weight:900;white-space:nowrap}
      .absolute .catalog-safety-severity{background:#feecee;color:#b4233a}.relative .catalog-safety-severity{background:#fff4dd;color:#8a5b00}.warning .catalog-safety-severity{background:#eaf3ff;color:#1559ae}
      .catalog-safety-details{padding:0 12px 12px 52px;color:#3e4e63;font-size:11px;line-height:1.55}
      .catalog-safety-source{margin-top:8px;padding-top:8px;border-top:1px solid #edf0f5;color:#718096;font-size:9px}
      .catalog-safety-footer{padding:10px 14px;border-top:1px solid #e6ebf2;background:#fbfcfe;color:#65758a;font-size:9px;line-height:1.5}
      @media(max-width:650px){.catalog-safety-item summary{grid-template-columns:auto minmax(0,1fr)}.catalog-safety-severity{grid-column:2;justify-self:start}.catalog-safety-details{padding-left:12px}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    const drugPanel = document.querySelector('#drugPanel');
    if (!drugPanel) return null;
    let panel = drugPanel.querySelector('#catalogSafetyPanel');
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = 'catalogSafetyPanel';
    panel.className = 'catalog-safety';
    panel.setAttribute('aria-labelledby', 'catalogSafetyTitle');
    panel.innerHTML = `
      <div class="catalog-safety-head">
        <div><span>SIGURIA KLINIKE</span><h4 id="catalogSafetyTitle">Kundërindikacionet</h4></div>
        <b class="catalog-safety-count" id="catalogSafetyCount">—</b>
      </div>
      <div class="catalog-safety-body" id="catalogSafetyBody" aria-live="polite">
        <div class="catalog-safety-state">Hap një bar nga katalogu për të kontrolluar të dhënat e verifikuara.</div>
      </div>
      <div class="catalog-safety-footer">Shfaqen vetëm të dhënat e publikuara dhe të rishikuara. Mungesa e të dhënave nuk do të thotë mungesë e kundërindikacioneve.</div>`;

    const tableHeading = drugPanel.querySelector('.table-heading');
    if (tableHeading) drugPanel.insertBefore(panel, tableHeading);
    else drugPanel.appendChild(panel);
    return panel;
  }

  function setState(message, className = '') {
    ensurePanel();
    const body = document.querySelector('#catalogSafetyBody');
    const count = document.querySelector('#catalogSafetyCount');
    if (body) body.innerHTML = `<div class="catalog-safety-state ${className}">${message}</div>`;
    if (count) count.textContent = '—';
  }

  function renderRows(rows = []) {
    ensurePanel();
    const body = document.querySelector('#catalogSafetyBody');
    const count = document.querySelector('#catalogSafetyCount');
    if (!body || !count) return;

    count.textContent = String(rows.length);
    if (!rows.length) {
      body.innerHTML = '<div class="catalog-safety-state caution"><strong>Nuk ka ende kundërindikacione të publikuara për këtë bar.</strong><br>Kjo nuk duhet interpretuar si “pa kundërindikacione”. Verifiko SPC-në, burimin institucional dhe karakteristikat e pacientit.</div>';
      return;
    }

    body.innerHTML = rows.map((row) => {
      const severity = ['absolute', 'relative', 'warning'].includes(row.severity) ? row.severity : 'warning';
      const source = [row.source_title, row.source_organization, row.publication_year].filter(Boolean).join(' · ');
      const reviewed = row.reviewed_at ? new Intl.DateTimeFormat('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(row.reviewed_at)) : '';
      return `
        <details class="catalog-safety-item ${severity}" ${severity === 'absolute' ? 'open' : ''}>
          <summary>
            <span class="catalog-safety-icon">${severity === 'absolute' ? '!' : severity === 'relative' ? '△' : 'i'}</span>
            <span class="catalog-safety-copy"><strong>${escapeHTML(row.condition_label || 'Kusht klinik')}</strong><small>${escapeHTML(factorLabels[row.factor_type] || factorLabels.other)}${row.condition_code ? ` · ${escapeHTML(row.condition_code)}` : ''}</small></span>
            <span class="catalog-safety-severity">${escapeHTML(severityLabels[severity])}</span>
          </summary>
          <div class="catalog-safety-details">
            ${escapeHTML(row.display_text || 'Detajet klinike janë në verifikim.')}
            <div class="catalog-safety-source">Burimi: ${escapeHTML(source || 'Burim i verifikuar editorial')}${reviewed ? ` · Rishikuar ${escapeHTML(reviewed)}` : ''} · Versioni ${escapeHTML(row.version_number || 1)}</div>
          </div>
        </details>`;
    }).join('');
  }

  function latestCatalogSelection() {
    try {
      const history = JSON.parse(localStorage.getItem('dozaks-history') || '[]');
      const latest = history[0];
      if (!latest?.id) return null;
      if (String(latest.id).startsWith('drug:')) return { drugId: String(latest.id).slice(5), productId: '' };
      if (String(latest.id).startsWith('product:')) return { drugId: '', productId: String(latest.id).slice(8) };
      return null;
    } catch {
      return null;
    }
  }

  async function resolveProductDrug(productId) {
    const response = await fetch(`${API_URL}?mode=detail&id=${encodeURIComponent(productId)}`, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const product = await response.json();
    return { drugId: product.drug_id || '', productId };
  }

  async function loadSafety(selection = latestCatalogSelection()) {
    if (!selection) {
      ensurePanel();
      return;
    }

    const sequence = ++requestSequence;
    activeController?.abort();
    activeController = new AbortController();
    const timeout = setTimeout(() => activeController.abort(), REQUEST_TIMEOUT);
    setState('Duke kontrolluar kundërindikacionet e publikuara…');

    try {
      let resolved = selection;
      if (!resolved.drugId && resolved.productId) resolved = await resolveProductDrug(resolved.productId);
      if (!resolved.drugId) throw new Error('Missing catalog drug id');

      const params = new URLSearchParams({ mode: 'contraindications', drugId: resolved.drugId });
      if (resolved.productId) params.set('productId', resolved.productId);
      const response = await fetch(`${API_URL}?${params}`, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        signal: activeController.signal,
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      if (sequence !== requestSequence) return;
      renderRows(Array.isArray(data.contraindications) ? data.contraindications : []);
    } catch (error) {
      if (String(error?.name) === 'AbortError') return;
      if (sequence === requestSequence) {
        setState('<strong>Kontrolli i kundërindikacioneve nuk u përfundua.</strong><br>Verifiko burimin klinik para përdorimit.', 'caution');
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  function cardIsCatalogItem() {
    const type = document.querySelector('#itemType')?.textContent || '';
    return type.includes('KATALOGU I KOSOVËS') || type.includes('PRODUKT MEDICINAL NË KOSOVË');
  }

  function start() {
    injectStyles();
    ensurePanel();
    const itemType = document.querySelector('#itemType');
    const drugName = document.querySelector('#drugName');
    const refresh = () => {
      if (cardIsCatalogItem()) setTimeout(() => loadSafety(), 0);
      else setState('Kundërindikacionet e kartelës klinike do të shfaqen pasi bari të lidhet me katalogun kryesor.');
    };
    if (itemType) new MutationObserver(refresh).observe(itemType, { childList: true, characterData: true, subtree: true });
    if (drugName) new MutationObserver(refresh).observe(drugName, { childList: true, characterData: true, subtree: true });
    refresh();
    window.DozaKSSafety = { refresh: loadSafety, render: renderRows };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
