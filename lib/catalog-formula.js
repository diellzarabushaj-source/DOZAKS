const FIELD_COLUMNS = Object.freeze({
  trade_name: 'trade_name',
  active_substance: 'active_substance',
  generic_name: 'generic_name',
  atc_code: 'atc_code',
  strength_text: 'strength_text',
  pharmaceutical_form: 'pharmaceutical_form',
  package_size: 'package_size',
  manufacturer: 'manufacturer',
  marketing_authorization_holder: 'marketing_authorization_holder',
  ma_certificate: 'ma_certificate',
  product_status: 'product_status',
  protocol_no: 'protocol_no',
  pdid: 'pdid',
  retail_price: 'retail_price',
});

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

function textRule(sql, column, operator, value) {
  const normalizedColumn = sql`lower(coalesce(${column}::text, ''))`;
  const normalizedValue = value.toLocaleLowerCase('sq');

  if (operator === 'equals') return sql`${normalizedColumn} = ${normalizedValue}`;
  if (operator === 'notEquals') return sql`${normalizedColumn} <> ${normalizedValue}`;
  if (operator === 'startsWith') return sql`${normalizedColumn} LIKE ${`${normalizedValue}%`}`;
  if (operator === 'endsWith') return sql`${normalizedColumn} LIKE ${`%${normalizedValue}`}`;
  if (operator === 'contains') return sql`${normalizedColumn} LIKE ${`%${normalizedValue}%`}`;
  if (operator === 'notContains') return sql`${normalizedColumn} NOT LIKE ${`%${normalizedValue}%`}`;
  if (operator === 'regex') return sql`coalesce(${column}::text, '') ~* ${value}`;
  if (operator === 'isEmpty') return sql`coalesce(btrim(${column}::text), '') = ''`;
  if (operator === 'isNotEmpty') return sql`coalesce(btrim(${column}::text), '') <> ''`;
  throw new Error(`Unsupported text operator: ${operator}`);
}

function numericRule(sql, column, operator, value) {
  const number = Number(value);
  if (operator === 'equals') return sql`${column} = ${number}`;
  if (operator === 'notEquals') return sql`${column} IS DISTINCT FROM ${number}`;
  if (operator === 'gt') return sql`${column} > ${number}`;
  if (operator === 'gte') return sql`${column} >= ${number}`;
  if (operator === 'lt') return sql`${column} < ${number}`;
  if (operator === 'lte') return sql`${column} <= ${number}`;
  if (operator === 'isEmpty') return sql`${column} IS NULL`;
  if (operator === 'isNotEmpty') return sql`${column} IS NOT NULL`;
  throw new Error(`Unsupported numeric operator: ${operator}`);
}

export function buildCatalogFormulaClause(sql, rawFormula, alias = 'p') {
  const formula = parseCatalogFormula(rawFormula);
  if (!formula.rules.length) return { formula, clause: sql`TRUE` };

  const clauses = formula.rules.map((rule) => {
    const columnName = FIELD_COLUMNS[rule.field];
    const column = sql.unsafe(`${alias}.${columnName}`);
    return NUMERIC_FIELDS.has(rule.field)
      ? numericRule(sql, column, rule.operator, rule.value)
      : textRule(sql, column, rule.operator, rule.value);
  });

  const clause = clauses.slice(1).reduce(
    (combined, current) => formula.logic === 'AND'
      ? sql`(${combined}) AND (${current})`
      : sql`(${combined}) OR (${current})`,
    clauses[0],
  );

  return { formula, clause };
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
