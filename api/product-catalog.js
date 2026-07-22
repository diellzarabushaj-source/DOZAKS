import { neon } from '@neondatabase/serverless';
import { buildCatalogFormulaClause, parseCatalogFormula } from '../lib/catalog-formula.js';

const DATABASE_ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL'];
const NETLIFY_FALLBACK = 'https://mjeku-ks.netlify.app/api/product-catalog';

function connectionString() {
  for (const key of DATABASE_ENV_KEYS) {
    const value = process.env[key];
    if (value) return value;
  }
  return '';
}

function normalizeQuery(value = '') {
  return String(value)
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function textParam(value) {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function send(res, status, payload, cache = false) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader(
    'cache-control',
    cache && status === 200
      ? 'public, max-age=0, s-maxage=120, stale-while-revalidate=300'
      : 'no-store',
  );
  res.end(JSON.stringify(payload));
}

async function asPublicApi(sql, queries) {
  const rows = await sql.transaction([sql`SET LOCAL ROLE dozaks_api`, ...queries]);
  return rows.slice(1);
}

async function proxyToNetlify(req, res) {
  const source = new URL(req.url || '/', 'https://dozaks.local');
  const target = new URL(NETLIFY_FALLBACK);
  source.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    const body = await response.text();
    res.statusCode = response.status;
    res.setHeader('content-type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('cache-control', response.ok ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=180' : 'no-store');
    res.end(body);
  } catch (error) {
    console.error('Vercel catalog fallback error', error);
    send(res, 503, { error: 'Product catalog backend is temporarily unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const formulaRaw = textParam(req.query?.formula);
  let parsedFormula;
  try {
    parsedFormula = parseCatalogFormula(formulaRaw);
  } catch (error) {
    return send(res, 400, { error: String(error?.message || error), code: 'INVALID_FORMULA' });
  }

  const databaseUrl = connectionString();
  if (!databaseUrl) {
    if (parsedFormula.rules.length) {
      return send(res, 503, {
        error: 'Formula Engine requires the direct Neon connection on Vercel',
        code: 'FORMULA_DATABASE_NOT_CONFIGURED',
      });
    }
    return proxyToNetlify(req, res);
  }

  const sql = neon(databaseUrl);
  const mode = textParam(req.query?.mode) || 'search';

  try {
    if (mode === 'health') {
      const [drugRows, productRows, contraindicationRows] = await asPublicApi(sql, [
        sql`
          SELECT count(*)::int AS visible_drugs,
                 count(DISTINCT atc_code)::int AS atc_codes,
                 min(valid_from) AS valid_from,
                 max(valid_to) AS valid_to,
                 max(version_label) AS version_label,
                 max(source_title) AS source_title
          FROM public.api_current_drug_catalog
        `,
        sql`SELECT count(*)::int AS visible_products FROM public.api_current_product_catalog`,
        sql`SELECT count(*)::int AS published_contraindications FROM public.api_published_catalog_contraindications`,
      ]);
      return send(res, 200, {
        ok: true,
        ...(drugRows[0] || {}),
        ...(productRows[0] || {}),
        ...(contraindicationRows[0] || {}),
      }, true);
    }

    if (mode === 'facets') {
      const query = textParam(req.query?.q);
      const pattern = `%${query}%`;
      const [forms, statuses, atcGroups, manufacturers, authorizationHolders] = await asPublicApi(sql, [
        sql`
          SELECT pharmaceutical_form AS value, count(*)::int AS count
          FROM public.api_protocol_product_options
          WHERE (${query} = '' OR trade_name ILIKE ${pattern} OR active_substance ILIKE ${pattern} OR atc_code ILIKE ${pattern})
          GROUP BY pharmaceutical_form
          ORDER BY count DESC, value
          LIMIT 150
        `,
        sql`
          SELECT coalesce(product_status, 'Pa status') AS value, count(*)::int AS count
          FROM public.api_protocol_product_options
          WHERE (${query} = '' OR trade_name ILIKE ${pattern} OR active_substance ILIKE ${pattern} OR atc_code ILIKE ${pattern})
          GROUP BY product_status
          ORDER BY count DESC, value
        `,
        sql`
          SELECT left(atc_code, 1) AS value, count(*)::int AS count
          FROM public.api_protocol_product_options
          WHERE (${query} = '' OR trade_name ILIKE ${pattern} OR active_substance ILIKE ${pattern} OR atc_code ILIKE ${pattern})
          GROUP BY left(atc_code, 1)
          ORDER BY value
        `,
        sql`
          SELECT coalesce(manufacturer, 'Pa prodhues') AS value, count(*)::int AS count
          FROM public.api_protocol_product_options
          WHERE (${query} = '' OR trade_name ILIKE ${pattern} OR active_substance ILIKE ${pattern} OR atc_code ILIKE ${pattern})
          GROUP BY manufacturer
          ORDER BY count DESC, value
          LIMIT 60
        `,
        sql`
          SELECT coalesce(marketing_authorization_holder, 'Pa bartës') AS value, count(*)::int AS count
          FROM public.api_protocol_product_options
          WHERE (${query} = '' OR trade_name ILIKE ${pattern} OR active_substance ILIKE ${pattern} OR atc_code ILIKE ${pattern})
          GROUP BY marketing_authorization_holder
          ORDER BY count DESC, value
          LIMIT 60
        `,
      ]);
      return send(res, 200, { forms, statuses, atcGroups, manufacturers, authorizationHolders }, true);
    }

    if (mode === 'contraindications') {
      const drugId = textParam(req.query?.drugId);
      const productId = textParam(req.query?.productId);
      if (!drugId && !productId) return send(res, 400, { error: 'Missing drugId or productId' });

      const [rows] = await asPublicApi(sql, [sql`
        SELECT id, catalog_drug_id, product_id, factor_type, severity,
               condition_code, condition_label, rule_json, display_text,
               version_number, reviewed_at, source_title,
               source_organization, source_url, publication_year
        FROM public.api_published_catalog_contraindications
        WHERE (${drugId} = '' OR catalog_drug_id = ${drugId})
          AND (${productId} = '' OR product_id IS NULL OR product_id = ${productId})
        ORDER BY CASE severity WHEN 'absolute' THEN 0 WHEN 'relative' THEN 1 ELSE 2 END,
                 factor_type, condition_label
      `]);

      return send(res, 200, {
        drugId: drugId || null,
        productId: productId || null,
        contraindications: rows,
        completeness: rows.length ? 'published-data-available' : 'no-published-data',
      }, true);
    }

    if (mode === 'detail') {
      const id = textParam(req.query?.id);
      if (!id) return send(res, 400, { error: 'Missing product id' });
      const [rows] = await asPublicApi(sql, [sql`
        SELECT * FROM public.api_current_product_catalog WHERE id = ${id} LIMIT 1
      `]);
      if (!rows[0]) return send(res, 404, { error: 'Product not found' });
      return send(res, 200, rows[0], true);
    }

    if (mode === 'drug-detail' || mode === 'products-by-drug') {
      const id = textParam(req.query?.id);
      if (!id) return send(res, 400, { error: 'Missing drug id' });
      const [drugRows, productRows, contraindicationRows] = await asPublicApi(sql, [
        sql`
          SELECT id, generic_name, normalized_name, atc_code, product_count,
                 pharmaceutical_forms, strengths, valid_from, valid_to,
                 version_label, source_title
          FROM public.api_current_drug_catalog
          WHERE id = ${id}
          LIMIT 1
        `,
        sql`
          SELECT id, drug_id, generic_name, trade_name, active_substance, atc_code,
                 strength_text, pharmaceutical_form, package_size,
                 marketing_authorization_holder, manufacturer, ma_certificate,
                 product_status, retail_price, valid_from, valid_to,
                 version_label, source_title
          FROM public.api_current_product_catalog
          WHERE drug_id = ${id}
          ORDER BY trade_name, pharmaceutical_form, strength_text
          LIMIT 250
        `,
        sql`
          SELECT id, catalog_drug_id, product_id, factor_type, severity,
                 condition_code, condition_label, rule_json, display_text,
                 version_number, reviewed_at, source_title,
                 source_organization, source_url, publication_year
          FROM public.api_published_catalog_contraindications
          WHERE catalog_drug_id = ${id}
          ORDER BY CASE severity WHEN 'absolute' THEN 0 WHEN 'relative' THEN 1 ELSE 2 END,
                   factor_type, condition_label
        `,
      ]);
      if (!drugRows[0]) return send(res, 404, { error: 'Drug not found' });
      return send(res, 200, {
        drug: drugRows[0],
        products: productRows,
        contraindications: contraindicationRows,
        safetyCompleteness: contraindicationRows.length ? 'published-data-available' : 'no-published-data',
      }, true);
    }

    const query = textParam(req.query?.q);
    const productLimit = Math.min(Math.max(Number(req.query?.limit || 20), 1), 100);
    const drugLimit = Math.min(Math.max(Number(req.query?.drugLimit || 8), 1), 30);
    const offset = Math.min(Math.max(Number(req.query?.offset || 0), 0), 5000);
    const atc = textParam(req.query?.atc);
    const form = textParam(req.query?.form);
    const productStatus = textParam(req.query?.status);
    const manufacturer = textParam(req.query?.manufacturer);
    const authorizationHolder = textParam(req.query?.authorizationHolder);
    const drugId = textParam(req.query?.drugId);

    if (query.length < 2 && !atc && !form && !productStatus && !manufacturer && !authorizationHolder && !drugId && !parsedFormula.rules.length) {
      return send(res, 200, { query, formula: parsedFormula, drugResults: [], productResults: [], results: [], total: 0 }, true);
    }

    const normalized = normalizeQuery(query);
    const pattern = `%${query}%`;
    const atcPattern = `${atc}%`;
    const formPattern = `%${form}%`;
    const manufacturerPattern = `%${manufacturer}%`;
    const holderPattern = `%${authorizationHolder}%`;
    const { clause: formulaClause } = buildCatalogFormulaClause(sql, parsedFormula, 'p');

    const queryClause = query
      ? sql`(
          p.trade_name ILIKE ${pattern}
          OR p.active_substance ILIKE ${pattern}
          OR p.generic_name ILIKE ${pattern}
          OR p.atc_code ILIKE ${pattern}
          OR p.ma_certificate ILIKE ${pattern}
          OR p.pdid ILIKE ${pattern}
          OR p.protocol_no ILIKE ${pattern}
          OR similarity(lower(p.trade_name), ${normalized}) > 0.22
          OR similarity(lower(p.active_substance), ${normalized}) > 0.22
        )`
      : sql`TRUE`;

    const filterClause = sql`
      (${queryClause})
      AND (${atc} = '' OR p.atc_code ILIKE ${atcPattern})
      AND (${form} = '' OR p.pharmaceutical_form ILIKE ${formPattern})
      AND (${productStatus} = '' OR p.product_status = ${productStatus})
      AND (${manufacturer} = '' OR p.manufacturer ILIKE ${manufacturerPattern})
      AND (${authorizationHolder} = '' OR p.marketing_authorization_holder ILIKE ${holderPattern})
      AND (${drugId} = '' OR p.drug_id = ${drugId})
      AND (${formulaClause})
    `;

    const [drugResults, productResults, totalRows] = await asPublicApi(sql, [
      sql`
        SELECT p.drug_id AS id,
               max(p.generic_name) AS generic_name,
               lower(max(p.generic_name)) AS normalized_name,
               max(p.atc_code) AS atc_code,
               count(*)::int AS product_count,
               array_remove(array_agg(DISTINCT p.pharmaceutical_form), NULL) AS pharmaceutical_forms,
               array_remove(array_agg(DISTINCT p.strength_text), NULL) AS strengths,
               min(p.valid_from) AS valid_from,
               max(p.valid_to) AS valid_to,
               max(p.version_label) AS version_label,
               max(p.source_title) AS source_title,
               GREATEST(
                 similarity(lower(max(p.generic_name)), ${normalized}),
                 similarity(lower(max(coalesce(p.atc_code, ''))), ${normalized})
               ) AS relevance
        FROM public.api_current_product_catalog p
        WHERE ${filterClause}
          AND p.drug_id IS NOT NULL
        GROUP BY p.drug_id
        ORDER BY
          CASE WHEN lower(max(p.generic_name)) = ${normalized} THEN 0 ELSE 1 END,
          CASE WHEN lower(max(coalesce(p.atc_code, ''))) = ${normalized} THEN 0 ELSE 1 END,
          relevance DESC,
          product_count DESC,
          generic_name
        LIMIT ${drugLimit}
      `,
      sql`
        SELECT p.id, p.drug_id, p.generic_name, p.trade_name, p.active_substance, p.atc_code,
               p.strength_text, p.pharmaceutical_form, p.package_size,
               p.marketing_authorization_holder, p.manufacturer, p.ma_certificate,
               p.product_status, p.retail_price, p.valid_from, p.valid_to,
               p.version_label, p.source_title,
               GREATEST(
                 similarity(lower(p.trade_name), ${normalized}),
                 similarity(lower(p.active_substance), ${normalized}),
                 similarity(lower(coalesce(p.atc_code, '')), ${normalized})
               ) AS relevance
        FROM public.api_current_product_catalog p
        WHERE ${filterClause}
        ORDER BY
          CASE WHEN lower(p.trade_name) = ${normalized} THEN 0 ELSE 1 END,
          CASE WHEN lower(p.active_substance) = ${normalized} THEN 0 ELSE 1 END,
          relevance DESC,
          p.trade_name,
          p.strength_text
        LIMIT ${productLimit}
        OFFSET ${offset}
      `,
      sql`
        SELECT count(*)::int AS total
        FROM public.api_current_product_catalog p
        WHERE ${filterClause}
      `,
    ]);

    return send(res, 200, {
      query,
      source: 'Kosovo official medicinal products catalogue',
      formula: parsedFormula,
      filters: { atc, form, status: productStatus, manufacturer, authorizationHolder, drugId },
      drugResults,
      productResults,
      results: productResults,
      total: totalRows[0]?.total || 0,
      offset,
      limit: productLimit,
    }, true);
  } catch (error) {
    console.error('Vercel product-catalog error', error);
    return send(res, 500, { error: 'Product catalog request failed' });
  }
}
