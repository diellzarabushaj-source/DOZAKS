'use strict';

(() => {
  const STORAGE_KEY = 'dozaks-personal-protocols-v3';

  function readProtocols() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }

  function writeProtocols(rows) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }

  function parseItem(node) {
    const summary = node.querySelector('.protocol-item-head small')?.textContent || '';
    const [activeSubstance = '', strength = '', form = '', atcCode = ''] = summary.split(' · ').map((value) => value.trim());
    const value = (field) => node.querySelector(`[data-item-field="${field}"]`)?.value.trim() || '';
    return {
      productId: node.dataset.protocolItem,
      tradeName: node.querySelector('.protocol-item-head strong')?.textContent?.trim() || 'Produkt',
      activeSubstance,
      strength,
      form,
      atcCode,
      indication: value('indication'),
      dose: value('dose'),
      route: value('route'),
      frequency: value('frequency'),
      duration: value('duration'),
      optional: value('optional') === 'true',
      instructions: value('instructions'),
    };
  }

  function currentEditorSnapshot() {
    const form = document.querySelector('#protocolEditorForm');
    if (!form) return null;
    return {
      id: form.dataset.protocolId,
      title: document.querySelector('#protocolTitle')?.value.trim() || '',
      icdCode: document.querySelector('#protocolIcd')?.value.trim() || '',
      clinicalContext: document.querySelector('#protocolContext')?.value || 'Ambulancë',
      description: document.querySelector('#protocolDescription')?.value.trim() || '',
      items: [...document.querySelectorAll('[data-protocol-item]')].map(parseItem),
    };
  }

  function mergeSnapshot(snapshot, { persistFields = true } = {}) {
    if (!snapshot?.id) return;
    const rows = readProtocols();
    const protocol = rows.find((row) => row.id === snapshot.id);
    if (!protocol) return;

    const existingById = new Map((protocol.items || []).map((item) => [String(item.productId), item]));
    protocol.items = snapshot.items.map((item) => ({
      ...(existingById.get(String(item.productId)) || {}),
      ...item,
    }));
    if (persistFields) {
      protocol.title = snapshot.title || protocol.title;
      protocol.icdCode = snapshot.icdCode;
      protocol.clinicalContext = snapshot.clinicalContext;
      protocol.description = snapshot.description;
      protocol.updatedAt = new Date().toISOString();
    }
    writeProtocols(rows);
  }

  document.addEventListener('submit', (event) => {
    if (event.target?.id !== 'protocolEditorForm') return;
    const snapshot = currentEditorSnapshot();
    setTimeout(() => mergeSnapshot(snapshot, { persistFields: false }), 80);
  }, true);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-protocol-action="check-current"]')) return;
    mergeSnapshot(currentEditorSnapshot(), { persistFields: true });
  }, true);

  const style = document.createElement('style');
  style.textContent = '.protocol-item select{width:100%;min-height:42px;padding:9px 10px;border:1px solid #cbd6e4;border-radius:9px;background:#fff;color:#17263b}';
  document.head.appendChild(style);
})();
