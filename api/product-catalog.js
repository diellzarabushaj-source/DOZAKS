import { neon } from '@neondatabase/serverless';

const DATABASE_ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL'];

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

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const databaseUrl = connectionString();
  if (!databaseUrl) {
    return send(res, 503, {
      error: 'Database connection is not configured',
      requiredEnvironmentVariable: 'DATABASE_URL',
    });
  }

  const sql = neon(databaseUrl);
  const mode = String(req.query?.mode || 'search');

  try {
    if (mode === 'health') {
      const [drugRows, productRows] = await asPublicApi(sql, [
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
      ]);
      return send(res, 200, { ok: true, ...(drugRows[0] || {}), ...(productRows[0] || {}) }, true);
    }

    if (mode === 'detail') {
      const id = String(req.query?.id || '').trim();
      if (!id) return send(res, 400, { error: 'Missing product id' });
      const [rows] = await asPublicApi(sql, [sql`
        SELECT * FROM public.api_current_product_catalog WHERE id = ${id} LIMIT 1
      `]);
      if (!rows[0]) return send(res, 404, { error: 'Product not found' });
      return send(res, 200, rows[0], true);
    }

    if (mode === 'drug-detail' || mode === 'products-by-drug') {
      const id = String(req.query?.id || '').trim();
      if (!id) return send(res, 400, { error: 'Missing drug id' });
      const [drugRows, productRows] = await asPublicApi(sql, [
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
      ]);
      if (!drugRows[0]) return send(res, 404, { error: 'Drug not found' });
      return send(res, 200, { drug: drugRows[0], products: productRows }, true);
    }

    const query = String(req.query?.q || '').trim();
    const productLimit = Math.min(Math.max(Number(req.query?.limit || 20), 1), 50);
    const drugLimit = Math.min(Math.max(Number(req.query?.drugLimit || 8), 1), 20);
    if (query.length < 2) {
      return send(res, 200, { query, drugResults: [], productResults: [], results: [] }, true);
    }

    const normalized = normalizeQuery(query);
    const pattern = `%${query}%`;
    const normalizedPattern = `%${normalized}%`;

    const [drugResults, productResults] = await asPublicApi(sql, [
      sql`
        SELECT id, generic_name, normalized_name, atc_code, product_count,
               pharmaceutical_forms, strengths, valid_from, valid_to,
               version_label, source_title,
               GREATEST(
                 similarity(lower(generic_name), ${normalized}),
                 similarity(normalized_name, ${normalized}),
                 similarity(lower(atc_code), ${normalized})
               ) AS relevance
        FROM public.api_current_drug_catalog
        WHERE generic_name ILIKE ${pattern}
           OR normalized_name ILIKE ${normalizedPattern}
           OR atc_code ILIKE ${pattern}
           OR search_text ILIKE ${normalizedPattern}
           OR similarity(lower(generic_name), ${normalized}) > 0.22
           OR similarity(normalized_name, ${normalized}) > 0.22
        ORDER BY
          CASE WHEN normalized_name = ${normalized} THEN 0 ELSE 1 END,
          CASE WHEN lower(atc_code) = ${normalized} THEN 0 ELSE 1 END,
          relevance DESC,
          product_count DESC,
          generic_name
        LIMIT ${drugLimit}
      `,
      sql`
        SELECT id, drug_id, generic_name, trade_name, active_substance, atc_code,
               strength_text, pharmaceutical_form, package_size,
               marketing_authorization_holder, manufacturer, ma_certificate,
               product_status, retail_price, valid_from, valid_to,
               version_label, source_title,
               GREATEST(
                 similarity(lower(trade_name), ${normalized}),
                 similarity(lower(active_substance), ${normalized}),
                 similarity(lower(coalesce(atc_code, '')), ${normalized})
               ) AS relevance
        FROM public.api_current_product_catalog
        WHERE trade_name ILIKE ${pattern}
           OR active_substance ILIKE ${pattern}
           OR generic_name ILIKE ${pattern}
           OR atc_code ILIKE ${pattern}
           OR ma_certificate ILIKE ${pattern}
           OR pdid ILIKE ${pattern}
           OR protocol_no ILIKE ${pattern}
           OR similarity(lower(trade_name), ${normalized}) > 0.22
           OR similarity(lower(active_substance), ${normalized}) > 0.22
        ORDER BY
          CASE WHEN lower(trade_name) = ${normalized} THEN 0 ELSE 1 END,
          CASE WHEN lower(active_substance) = ${normalized} THEN 0 ELSE 1 END,
          relevance DESC,
          trade_name,
          strength_text
        LIMIT ${productLimit}
      `,
    ]);

    return send(res, 200, {
      query,
      source: 'Kosovo official medicinal products catalogue',
      drugResults,
      productResults,
      results: productResults,
    }, true);
  } catch (error) {
    console.error('Vercel product-catalog error', error);
    return send(res, 500, { error: 'Product catalog request failed' });
  }
}
