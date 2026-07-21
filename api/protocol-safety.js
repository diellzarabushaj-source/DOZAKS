import { neon } from '@neondatabase/serverless';

const DATABASE_ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL'];
const MAX_PRODUCTS = 50;
const MAX_BODY_BYTES = 64 * 1024;
const DISALLOWED_CONTEXT_KEYS = new Set([
  'name', 'fullname', 'firstname', 'lastname', 'email', 'phone', 'address',
  'patientid', 'personalnumber', 'nationalid', 'dateofbirth', 'birthdate',
]);
const ALLOWED_CONTEXT_KEYS = new Set([
  'ageYears', 'pregnancy', 'breastfeeding', 'eGfr', 'creatinineClearance',
  'hepaticStatus', 'allergies', 'diagnoses', 'laboratory', 'routes',
]);

function connectionString() {
  for (const key of DATABASE_ENV_KEYS) {
    const value = process.env[key];
    if (value) return value;
  }
  return '';
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

function normalizeContext(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  for (const key of Object.keys(input)) {
    if (DISALLOWED_CONTEXT_KEYS.has(key.toLowerCase())) {
      throw new Error(`Disallowed patient identifier: ${key}`);
    }
  }

  const context = {};
  for (const key of ALLOWED_CONTEXT_KEYS) {
    if (!(key in input)) continue;
    const value = input[key];
    if (['allergies', 'diagnoses', 'routes'].includes(key)) {
      context[key] = Array.isArray(value)
        ? value.slice(0, 100).map((item) => String(item).trim().toLowerCase()).filter(Boolean)
        : [];
    } else if (key === 'laboratory') {
      context[key] = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } else if (['ageYears', 'eGfr', 'creatinineClearance'].includes(key)) {
      const numeric = Number(value);
      context[key] = Number.isFinite(numeric) ? numeric : null;
    } else if (['pregnancy', 'breastfeeding'].includes(key)) {
      context[key] = Boolean(value);
    } else {
      context[key] = String(value || '').trim().toLowerCase();
    }
  }
  return context;
}

function getPath(object, path) {
  return String(path || '').split('.').filter(Boolean).reduce((value, key) => value?.[key], object);
}

function compare(actual, operator, expected) {
  if (operator === 'exists') return expected ? actual !== undefined && actual !== null : actual === undefined || actual === null;
  if (operator === 'eq') return actual === expected;
  if (operator === 'neq') return actual !== expected;
  if (operator === 'lt') return Number(actual) < Number(expected);
  if (operator === 'lte') return Number(actual) <= Number(expected);
  if (operator === 'gt') return Number(actual) > Number(expected);
  if (operator === 'gte') return Number(actual) >= Number(expected);
  if (operator === 'in') return Array.isArray(expected) && expected.includes(actual);
  if (operator === 'contains') return Array.isArray(actual)
    ? actual.includes(String(expected).toLowerCase())
    : String(actual || '').toLowerCase().includes(String(expected || '').toLowerCase());
  if (operator === 'intersects') {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
    const expectedSet = new Set(expected.map((value) => String(value).toLowerCase()));
    return actual.some((value) => expectedSet.has(String(value).toLowerCase()));
  }
  return false;
}

function evaluateRule(rule, context) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule) || !Object.keys(rule).length) {
    return { matched: false, machineReadable: false };
  }

  if (Array.isArray(rule.all)) {
    const results = rule.all.map((item) => evaluateRule(item, context));
    return {
      matched: results.every((result) => result.matched),
      machineReadable: results.every((result) => result.machineReadable),
    };
  }

  if (Array.isArray(rule.any)) {
    const results = rule.any.map((item) => evaluateRule(item, context));
    return {
      matched: results.some((result) => result.matched),
      machineReadable: results.every((result) => result.machineReadable),
    };
  }

  if (rule.not) {
    const result = evaluateRule(rule.not, context);
    return { matched: !result.matched, machineReadable: result.machineReadable };
  }

  if (!rule.field || !rule.operator) return { matched: false, machineReadable: false };
  return {
    matched: compare(getPath(context, rule.field), rule.operator, rule.value),
    machineReadable: true,
  };
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new Error('Payload too large');
  }
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const databaseUrl = connectionString();
  if (!databaseUrl) return send(res, 503, { error: 'Database connection is not configured' });

  try {
    const body = await readBody(req);
    const selectedProductIds = [...new Set(
      (Array.isArray(body.selectedProductIds) ? body.selectedProductIds : [])
        .map(String)
        .filter(isUuid),
    )];

    if (!selectedProductIds.length) return send(res, 400, { error: 'Select at least one valid product' });
    if (selectedProductIds.length > MAX_PRODUCTS) return send(res, 400, { error: `Maximum ${MAX_PRODUCTS} products` });

    const patientContext = normalizeContext(body.patientContext);
    const sql = neon(databaseUrl);
    const results = await sql.transaction([
      sql`SET LOCAL ROLE dozaks_api`,
      sql`
        SELECT product_id, drug_id, generic_name, trade_name, active_substance,
               atc_code, strength_text, pharmaceutical_form, product_status,
               valid_from, valid_to
        FROM public.api_protocol_product_options
        WHERE product_id = ANY(${selectedProductIds}::text[])
        ORDER BY generic_name, trade_name
      `,
    ]);
    const products = results[1] || [];
    const foundProductIds = new Set(products.map((row) => row.product_id));
    const invalidProductIds = selectedProductIds.filter((id) => !foundProductIds.has(id));
    const drugIds = [...new Set(products.map((row) => row.drug_id).filter(Boolean))];

    let contraindications = [];
    if (drugIds.length) {
      const contraindicationResults = await sql.transaction([
        sql`SET LOCAL ROLE dozaks_api`,
        sql`
          SELECT id, catalog_drug_id, product_id, factor_type, severity,
                 condition_code, condition_label, rule_json, display_text,
                 version_number, reviewed_at, source_title,
                 source_organization, publication_year
          FROM public.api_published_catalog_contraindications
          WHERE catalog_drug_id = ANY(${drugIds}::text[])
            AND (product_id IS NULL OR product_id = ANY(${selectedProductIds}::text[]))
          ORDER BY CASE severity WHEN 'absolute' THEN 0 WHEN 'relative' THEN 1 ELSE 2 END,
                   factor_type, condition_label
        `,
      ]);
      contraindications = contraindicationResults[1] || [];
    }

    const productsByDrug = new Map();
    for (const product of products) {
      if (!productsByDrug.has(product.drug_id)) productsByDrug.set(product.drug_id, []);
      productsByDrug.get(product.drug_id).push(product.product_id);
    }

    const coveredDrugIds = new Set(contraindications.map((row) => row.catalog_drug_id));
    const missingCoverageDrugIds = drugIds.filter((id) => !coveredDrugIds.has(id));
    const matchedFindings = [];
    const manualReview = [];

    for (const row of contraindications) {
      const evaluation = evaluateRule(row.rule_json, patientContext);
      const affectedProducts = row.product_id
        ? [row.product_id]
        : (productsByDrug.get(row.catalog_drug_id) || []);
      const finding = {
        id: row.id,
        catalogDrugId: row.catalog_drug_id,
        productIds: affectedProducts,
        factorType: row.factor_type,
        severity: row.severity,
        conditionCode: row.condition_code,
        conditionLabel: row.condition_label,
        displayText: row.display_text,
        sourceTitle: row.source_title,
        sourceOrganization: row.source_organization,
        publicationYear: row.publication_year,
        reviewedAt: row.reviewed_at,
        versionNumber: row.version_number,
      };
      if (!evaluation.machineReadable) manualReview.push({ ...finding, reason: 'Rule requires clinician review' });
      else if (evaluation.matched) matchedFindings.push(finding);
    }

    const hasAbsolute = matchedFindings.some((finding) => finding.severity === 'absolute');
    const hasWarning = matchedFindings.some((finding) => finding.severity !== 'absolute');
    const coverage = missingCoverageDrugIds.length
      ? (coveredDrugIds.size ? 'partial' : 'none')
      : 'complete';
    const status = hasAbsolute
      ? 'blocked'
      : (hasWarning || manualReview.length || invalidProductIds.length)
        ? 'warning'
        : coverage === 'complete'
          ? 'clear'
          : 'incomplete';

    return send(res, 200, {
      status,
      coverage,
      selectedProductCount: selectedProductIds.length,
      validatedProductCount: products.length,
      invalidProductIds,
      missingCoverageDrugIds,
      products,
      matchedFindings,
      manualReview,
      message: status === 'blocked'
        ? 'U gjet të paktën një kundërindikacion absolut që përputhet me kontekstin e dhënë.'
        : status === 'warning'
          ? 'Protokolli kërkon rishikim klinik para përdorimit.'
          : status === 'clear'
            ? 'Nuk u gjet përputhje në rregullat e publikuara dhe mbulimi është i plotë.'
            : 'Nuk ka mbulim të mjaftueshëm për të deklaruar protokollin si të pastër.',
      disclaimer: 'Ky kontroll mbështet rishikimin dhe nuk zëvendëson gjykimin klinik, SPC-në ose protokollin institucional.',
    });
  } catch (error) {
    const message = String(error?.message || error);
    if (message.startsWith('Disallowed patient identifier')) return send(res, 400, { error: message });
    if (message === 'Payload too large') return send(res, 413, { error: message });
    console.error('DozaKS protocol-safety error', error);
    return send(res, 500, { error: 'Protocol safety check failed' });
  }
}
