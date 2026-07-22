import { neon } from '@neondatabase/serverless';
import { createSearchTrace } from './_search-observability.js';

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';
}

function text(value) {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function normalize(value = '') {
  return String(value)
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function send(res, status, payload, cache = false) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', cache && status === 200
    ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=180'
    : 'no-store');
  res.end(JSON.stringify(payload));
}

async function asPublicApi(sql, queries) {
  const rows = await sql.transaction([sql`SET LOCAL ROLE dozaks_api`, ...queries]);
  return rows.slice(1);
}

export default async function handler(req, res) {
  const trace = createSearchTrace(req, res, 'smart-search');

  if (req.method !== 'GET') {
    trace.finish(405, { outcome: 'method_not_allowed' });
    return send(res, 405, { error: 'Method not allowed', requestId: trace.requestId });
  }

  const databaseUrl = connectionString();
  if (!databaseUrl) {
    trace.finish(503, { outcome: 'database_not_configured' });
    return send(res, 503, {
      error: 'DATABASE_URL is not configured',
      code: 'DATABASE_NOT_CONFIGURED',
      requestId: trace.requestId,
    });
  }

  const sql = neon(databaseUrl);
  const q = text(req.query?.q);
  const normalized = normalize(q);
  const pattern = `%${q}%`;
  const atc = text(req.query?.atc).toUpperCase();
  const atcPattern = `${atc}%`;
  const form = text(req.query?.form);
  const formPattern = `%${form}%`;
  const strength = text(req.query?.strength);
  const strengthPattern = `%${strength}%`;
  const status = text(req.query?.status);
  const manufacturer = text(req.query?.manufacturer);
  const manufacturerPattern = `%${manufacturer}%`;
  const holder = text(req.query?.authorizationHolder);
  const holderPattern = `%${holder}%`;
  const productLimit = Math.min(Math.max(Number(req.query?.limit || 12), 1), 60);
  const drugLimit = Math.min(Math.max(Number(req.query?.drugLimit || 6), 1), 20);

  const activeFilters = [atc, form, strength, status, manufacturer, holder].filter(Boolean);
  const hasFilter = activeFilters.length > 0;
  const requestMeta = {
    queryLength: q.length,
    filterCount: activeFilters.length,
    productLimit,
    drugLimit,
  };

  if (q.length < 2 && !hasFilter) {
    trace.finish(200, {
      ...requestMeta,
      outcome: 'query_too_short',
      genericResultCount: 0,
      productResultCount: 0,
      total: 0,
    });
    return send(res, 200, {
      requestId: trace.requestId,
      query: q,
      parsedQuery: normalized,
      drugResults: [],
      productResults: [],
      total: 0,
    }, true);
  }

  try {
    const [drugResults, productResults, totalRows] = await trace.measureDatabase(() => asPublicApi(sql, [
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
        WHERE (
          ${q} = ''
          OR p.trade_name ILIKE ${pattern}
          OR p.active_substance ILIKE ${pattern}
          OR p.generic_name ILIKE ${pattern}
          OR p.atc_code ILIKE ${pattern}
          OR p.strength_text ILIKE ${pattern}
          OR p.pharmaceutical_form ILIKE ${pattern}
          OR p.package_size ILIKE ${pattern}
          OR p.manufacturer ILIKE ${pattern}
          OR p.marketing_authorization_holder ILIKE ${pattern}
          OR p.ma_certificate ILIKE ${pattern}
          OR p.pdid ILIKE ${pattern}
          OR p.protocol_no ILIKE ${pattern}
          OR similarity(lower(p.trade_name), ${normalized}) > 0.20
          OR similarity(lower(p.active_substance), ${normalized}) > 0.20
          OR similarity(lower(p.generic_name), ${normalized}) > 0.20
        )
          AND (${atc} = '' OR p.atc_code ILIKE ${atcPattern})
          AND (${form} = '' OR p.pharmaceutical_form ILIKE ${formPattern})
          AND (${strength} = '' OR p.strength_text ILIKE ${strengthPattern})
          AND (${status} = '' OR coalesce(p.product_status, 'Pa status') = ${status})
          AND (${manufacturer} = '' OR p.manufacturer ILIKE ${manufacturerPattern})
          AND (${holder} = '' OR p.marketing_authorization_holder ILIKE ${holderPattern})
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
                 similarity(lower(p.generic_name), ${normalized}),
                 similarity(lower(coalesce(p.atc_code, '')), ${normalized})
               ) AS relevance
        FROM public.api_current_product_catalog p
        WHERE (
          ${q} = ''
          OR p.trade_name ILIKE ${pattern}
          OR p.active_substance ILIKE ${pattern}
          OR p.generic_name ILIKE ${pattern}
          OR p.atc_code ILIKE ${pattern}
          OR p.strength_text ILIKE ${pattern}
          OR p.pharmaceutical_form ILIKE ${pattern}
          OR p.package_size ILIKE ${pattern}
          OR p.manufacturer ILIKE ${pattern}
          OR p.marketing_authorization_holder ILIKE ${pattern}
          OR p.ma_certificate ILIKE ${pattern}
          OR p.pdid ILIKE ${pattern}
          OR p.protocol_no ILIKE ${pattern}
          OR similarity(lower(p.trade_name), ${normalized}) > 0.20
          OR similarity(lower(p.active_substance), ${normalized}) > 0.20
          OR similarity(lower(p.generic_name), ${normalized}) > 0.20
        )
          AND (${atc} = '' OR p.atc_code ILIKE ${atcPattern})
          AND (${form} = '' OR p.pharmaceutical_form ILIKE ${formPattern})
          AND (${strength} = '' OR p.strength_text ILIKE ${strengthPattern})
          AND (${status} = '' OR coalesce(p.product_status, 'Pa status') = ${status})
          AND (${manufacturer} = '' OR p.manufacturer ILIKE ${manufacturerPattern})
          AND (${holder} = '' OR p.marketing_authorization_holder ILIKE ${holderPattern})
        ORDER BY
          CASE WHEN lower(p.trade_name) = ${normalized} THEN 0 ELSE 1 END,
          CASE WHEN lower(p.active_substance) = ${normalized} THEN 0 ELSE 1 END,
          CASE WHEN lower(p.generic_name) = ${normalized} THEN 0 ELSE 1 END,
          CASE WHEN lower(coalesce(p.atc_code, '')) = ${normalized} THEN 0 ELSE 1 END,
          relevance DESC,
          p.trade_name,
          p.strength_text
        LIMIT ${productLimit}
      `,
      sql`
        SELECT count(*)::int AS total
        FROM public.api_current_product_catalog p
        WHERE (
          ${q} = ''
          OR p.trade_name ILIKE ${pattern}
          OR p.active_substance ILIKE ${pattern}
          OR p.generic_name ILIKE ${pattern}
          OR p.atc_code ILIKE ${pattern}
          OR p.strength_text ILIKE ${pattern}
          OR p.pharmaceutical_form ILIKE ${pattern}
          OR p.package_size ILIKE ${pattern}
          OR p.manufacturer ILIKE ${pattern}
          OR p.marketing_authorization_holder ILIKE ${pattern}
          OR p.ma_certificate ILIKE ${pattern}
          OR p.pdid ILIKE ${pattern}
          OR p.protocol_no ILIKE ${pattern}
          OR similarity(lower(p.trade_name), ${normalized}) > 0.20
          OR similarity(lower(p.active_substance), ${normalized}) > 0.20
          OR similarity(lower(p.generic_name), ${normalized}) > 0.20
        )
          AND (${atc} = '' OR p.atc_code ILIKE ${atcPattern})
          AND (${form} = '' OR p.pharmaceutical_form ILIKE ${formPattern})
          AND (${strength} = '' OR p.strength_text ILIKE ${strengthPattern})
          AND (${status} = '' OR coalesce(p.product_status, 'Pa status') = ${status})
          AND (${manufacturer} = '' OR p.manufacturer ILIKE ${manufacturerPattern})
          AND (${holder} = '' OR p.marketing_authorization_holder ILIKE ${holderPattern})
      `,
    ]));

    const total = totalRows[0]?.total || 0;
    trace.finish(200, {
      ...requestMeta,
      outcome: 'ok',
      genericResultCount: drugResults.length,
      productResultCount: productResults.length,
      total,
    });

    return send(res, 200, {
      requestId: trace.requestId,
      query: q,
      parsedQuery: normalized,
      source: 'Kosovo official medicinal products catalogue',
      filters: { atc, form, strength, status, manufacturer, authorizationHolder: holder },
      drugResults,
      productResults,
      total,
    }, true);
  } catch (error) {
    await trace.fail(error, 500, {
      ...requestMeta,
      outcome: 'database_or_runtime_error',
    });
    return send(res, 500, {
      requestId: trace.requestId,
      error: 'Smart search request failed',
      code: 'SMART_SEARCH_FAILED',
    });
  }
}
