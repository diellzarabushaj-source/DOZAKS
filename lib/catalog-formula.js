const TEXT_FIELDS = new Set([
  'trade_name',
  'active_substance',
  'generic_name',
  'atc_code',
  'strength_text',
  'pharmaceutical_form',
  'package_size',
  'manufacturer',
  'marketing_authorization_holder',
  'ma_certificate',
  'product_status',
  'protocol_no',
  'pdid',
]);

const NUMERIC_FIELDS = new Set(['retail_price']);

const TEXT_OPERATORS = new Set([
  'equals',
  'notEquals',
  'startsWith',
  'endsWith',
  'contains',
  'notContains',
  'regex',
  'isEmpty',
  'isNotEmpty',
]);

const NUMERIC_OPERATORS = new Set([
  'equals',
  'notEquals',
  'gt',
  'gte',
  'lt',
  'lte',
  'isEmpty',
  'isNotEmpty',
]);

const MAX_RULES = 12;
const MAX_VALUE_LENGTH = 180;

function isSafeRegex(pattern) {
  if (!pattern || pattern.length > MAX_VALUE_LENGTH) return false;
  if (/\\[1-9]/.test(pattern)) return false;
  if (/\(\?<([=!])/.test(pattern)) return false;
  if (/\(\?<[A-Za-z]/.test(pattern)) return false;
  if (/\(\?>/.test(pattern)) return false;
  if (/\(\?\(/.test(pattern)) return false;
  return true;
}

function normalizeRule(input, index) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`Formula rule ${index + 1} is invalid`);
  }

  const field = String(input.field || '').trim();
  const operator = String(input.operator || '').trim();
  const value = String(input.value ?? '').trim();

  const isText = TEXT_FIELDS.has(field);
  const isNumeric = NUMERIC_FIELDS.has(field);
  if (!isText && !isNumeric) throw new Error(`Formula field is not allowed: ${field}`);

  const allowedOperators = isText ? TEXT_OPERATORS : NUMERIC_OPERATORS;
  if (!allowedOperators.has(operator)) throw new Error(`Formula operator is not allowed: ${operator}`);

  const valueOptional = operator === 'isEmpty' || operator === 'isNotEmpty';
  if (!valueOptional && !value) throw new Error(`Formula value is required for ${field}`);
  if (value.length > MAX_VALUE_LENGTH) throw new Error(`Formula value is too long for ${field}`);

  if (isNumeric && !valueOptional && !Number.isFinite(Number(value))) {
    throw new Error(`Formula value must be numeric for ${field}`);
  }

  if (operator === 'regex' && !isSafeRegex(value)) {
    throw new Error('Regex contains unsupported or unsafe syntax');
  }

  return {
    id: String(input.id || `rule-${index + 1}`).slice(0, 80),
    field,
    operator,
    value,
  };
}

export function parseCatalogFormula(raw) {
  if (!raw) return { logic: 'AND', rules: [] };

  let parsed = raw;
  if (typeof raw === 'string') {
    if (raw.length > 6000) throw new Error('Formula payload is too large');
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Formula payload is not valid JSON');
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Formula must be an object');
  }

  const logic = String(parsed.logic || 'AND').toUpperCase();
  if (!['AND', 'OR'].includes(logic)) throw new Error('Formula logic must be AND or OR');

  const sourceRules = Array.isArray(parsed.rules) ? parsed.rules : [];
  if (sourceRules.length > MAX_RULES) throw new Error(`Formula supports up to ${MAX_RULES} rules`);

  return {
    logic,
    rules: sourceRules.map(normalizeRule),
  };
}

export const catalogFormulaFields = Object.freeze([
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
  { value: 'retail_price', label: 'Çmimi me pakicë', column: 'Q*' },
]);

export const catalogFormulaOperators = Object.freeze([
  { value: 'equals', label: 'është saktësisht' },
  { value: 'notEquals', label: 'nuk është' },
  { value: 'startsWith', label: 'fillon me' },
  { value: 'endsWith', label: 'mbaron me' },
  { value: 'contains', label: 'përmban' },
  { value: 'notContains', label: 'nuk përmban' },
  { value: 'regex', label: 'përputhet me regex' },
  { value: 'gt', label: 'është më i madh se' },
  { value: 'gte', label: 'është ≥' },
  { value: 'lt', label: 'është më i vogël se' },
  { value: 'lte', label: 'është ≤' },
  { value: 'isEmpty', label: 'është bosh' },
  { value: 'isNotEmpty', label: 'nuk është bosh' },
]);
