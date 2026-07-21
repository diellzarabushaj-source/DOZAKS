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

function textParam(value) {
  return String(value || '').trim();
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
  const mode = textParam(req.query?.mode) || 'search';

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
      return send(res, 200, {
        forms,
        statuses,
        atcGroups,
        manufacturers,
        authorizationHolders,
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

    if (query.length < 2 && !atc && !form && !productStatus && !manufacturer && !authorizationHolder && !drugId) {
      return send(res, 200, { query, drugResults: [], productResults: [], results: [], total: 0 }, true);
    }

    const normalized = normalizeQuery(query);
    const pattern = `%${query}%`;
    const normalizedPattern = `%${normalized}%`;
    const atcPattern = `${atc}%`;
    const formPattern = `%${form}%`;
    const manufacturerPattern = `%${manufacturer}%`;
    const holderPattern = `%${authorizationHolder}%`;

    const [drugResults, productResults, totalRows] = await asPublicApi(sql, [
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
        WHERE (${query} = '' OR generic_name ILIKE ${pattern}
           OR normalized_name ILIKE ${normalizedPattern}
           OR atc_code ILIKE ${pattern}
           OR search_text ILIKE ${normalizedPattern}
           OR similarity(lower(generic_name), ${normalized}) > 0.22
           OR similarity(normalized_name, ${normalized}) > 0.22)
          AND (${atc} = '' OR atc_code ILIKE ${atcPattern})
          AND (${drugId} = '' OR id = ${drugId})
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
        WHERE (${query} = '' OR trade_name ILIKE ${pattern}
           OR active_substance ILIKE ${pattern}
           OR generic_name ILIKE ${pattern}
           OR atc_code ILIKE ${pattern}
           OR ma_certificate ILIKE ${pattern}
           OR pdid ILIKE ${pattern}
           OR protocol_no ILIKE ${pattern}
           OR similarity(lower(trade_name), ${normalized}) > 0.22
           OR similarity(lower(active_substance), ${normalized}) > 0.22)
          AND (${atc} = '' OR atc_code ILIKE ${atcPattern})
          AND (${form} = '' OR pharmaceutical_form ILIKE ${formPattern})
          AND (${productStatus} = '' OR product_status = ${productStatus})
          AND (${manufacturer} = '' OR manufacturer ILIKE ${manufacturerPattern})
          AND (${authorizationHolder} = '' OR marketing_authorization_holder ILIKE ${holderPattern})
          AND (${drugId} = '' OR drug_id = ${drugId})
        ORDER BY
          CASE WHEN lower(trade_name) = ${normalized} THEN 0 ELSE 1 END,
          CASE WHEN lower(active_substance) = ${normalized} THEN 0 ELSE 1 END,
          relevance DESC,
          trade_name,
          strength_text
        LIMIT ${productLimit}
        OFFSET ${offset}
      `,
      sql`
        SELECT count(*)::int AS total
        FROM public.api_current_product_catalog
        WHERE (${query} = '' OR trade_name ILIKE ${pattern}
           OR active_substance ILIKE ${pattern}
           OR generic_name ILIKE ${pattern}
           OR atc_code ILIKE ${pattern}
           OR ma_certificate ILIKE ${pattern}
           OR pdid ILIKE ${pattern}
           OR protocol_no ILIKE ${pattern})
          AND (${atc} = '' OR atc_code ILIKE ${atcPattern})
          AND (${form} = '' OR pharmaceutical_form ILIKE ${formPattern})
          AND (${productStatus} = '' OR product_status = ${productStatus})
          AND (${manufacturer} = '' OR manufacturer ILIKE ${manufacturerPattern})
          AND (${authorizationHolder} = '' OR marketing_authorization_holder ILIKE ${holderPattern})
          AND (${drugId} = '' OR drug_id = ${drugId})
      `,
    ]);

    return send(res, 200, {
      query,
      source: 'Kosovo official medicinal products catalogue',
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
