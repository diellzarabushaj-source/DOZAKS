import { neon } from '@neondatabase/serverless';

function send(res, status, payload, cache = false) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader(
    'cache-control',
    cache && status === 200
      ? 'public, max-age=0, s-maxage=180, stale-while-revalidate=600'
      : 'no-store',
  );
  res.end(JSON.stringify(payload));
}

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';
}

function param(value) {
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

async function asPublicApi(sql, queries) {
  const rows = await sql.transaction([sql`SET LOCAL ROLE dozaks_api`, ...queries]);
  return rows.slice(1);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const databaseUrl = connectionString();
  if (!databaseUrl) {
    return send(res, 503, {
      error: 'DATABASE_URL is not configured in Vercel',
      code: 'DATABASE_NOT_CONFIGURED',
    });
  }

  const sql = neon(databaseUrl);
  const mode = param(req.query?.mode) || 'browse';

  try {
    if (mode === 'health') {
      const [rows] = await asPublicApi(sql, [sql`
        SELECT count(*)::int AS products,
               count(DISTINCT drug_id)::int AS drugs,
               count(DISTINCT left(atc_code, 1)) FILTER (WHERE atc_code <> '')::int AS atc_systems,
               count(DISTINCT left(atc_code, 3)) FILTER (WHERE length(atc_code) >= 3)::int AS atc_subgroups
        FROM public.api_current_product_catalog
      `]);
      return send(res, 200, { ok: true, database: 'neon', hosting: 'vercel', ...(rows[0] || {}) }, true);
    }

    if (mode === 'meta') {
      const [systems, subgroups] = await asPublicApi(sql, [
        sql`
          SELECT upper(left(atc_code, 1)) AS code, count(*)::int AS count
          FROM public.api_current_product_catalog
          WHERE coalesce(atc_code, '') <> ''
          GROUP BY upper(left(atc_code, 1))
          ORDER BY code
        `,
        sql`
          SELECT upper(left(atc_code, 3)) AS code, count(*)::int AS count
          FROM public.api_current_product_catalog
          WHERE length(coalesce(atc_code, '')) >= 3
          GROUP BY upper(left(atc_code, 3))
          ORDER BY code
        `,
      ]);
      return send(res, 200, { systems, subgroups }, true);
    }

    if (mode !== 'browse') return send(res, 400, { error: 'Unknown mode' });

    const query = param(req.query?.q);
    const atc = param(req.query?.atc).toUpperCase();
    const letter = param(req.query?.letter).toUpperCase();
    const limit = Math.min(Math.max(Number(req.query?.limit || 80), 1), 200);
    const offset = Math.min(Math.max(Number(req.query?.offset || 0), 0), 5000);

    if (atc && !/^[A-Z](?:\d{2})?$/.test(atc)) {
      return send(res, 400, { error: 'Invalid ATC prefix' });
    }
    if (letter && !/^[A-Z]$/.test(letter)) {
      return send(res, 400, { error: 'Invalid alphabet letter' });
    }

    const normalized = normalize(query);
    const pattern = `%${query}%`;
    const atcPattern = `${atc}%`;
    const letterPattern = `${letter}%`;

    const [results, totalRows, genericRows] = await asPublicApi(sql, [
      sql`
        SELECT p.id, p.drug_id, p.generic_name, p.trade_name, p.active_substance, p.atc_code,
               p.strength_text, p.pharmaceutical_form, p.package_size,
               p.marketing_authorization_holder, p.manufacturer, p.ma_certificate,
               p.product_status, p.retail_price, p.valid_from, p.valid_to,
               p.version_label, p.source_title
        FROM public.api_current_product_catalog p
        WHERE (
          ${query} = ''
          OR p.trade_name ILIKE ${pattern}
          OR p.active_substance ILIKE ${pattern}
          OR p.generic_name ILIKE ${pattern}
          OR p.atc_code ILIKE ${pattern}
          OR p.manufacturer ILIKE ${pattern}
          OR p.ma_certificate ILIKE ${pattern}
          OR similarity(lower(p.trade_name), ${normalized}) > 0.24
          OR similarity(lower(p.active_substance), ${normalized}) > 0.24
        )
          AND (${atc} = '' OR p.atc_code ILIKE ${atcPattern})
          AND (
            ${letter} = ''
            OR p.trade_name ILIKE ${letterPattern}
            OR p.generic_name ILIKE ${letterPattern}
            OR p.active_substance ILIKE ${letterPattern}
          )
        ORDER BY
          CASE WHEN ${query} <> '' AND lower(p.generic_name) = ${normalized} THEN 0 ELSE 1 END,
          CASE WHEN ${query} <> '' AND lower(p.trade_name) = ${normalized} THEN 0 ELSE 1 END,
          p.generic_name,
          p.trade_name,
          p.pharmaceutical_form,
          p.strength_text
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      sql`
        SELECT count(*)::int AS total
        FROM public.api_current_product_catalog p
        WHERE (
          ${query} = ''
          OR p.trade_name ILIKE ${pattern}
          OR p.active_substance ILIKE ${pattern}
          OR p.generic_name ILIKE ${pattern}
          OR p.atc_code ILIKE ${pattern}
          OR p.manufacturer ILIKE ${pattern}
          OR p.ma_certificate ILIKE ${pattern}
          OR similarity(lower(p.trade_name), ${normalized}) > 0.24
          OR similarity(lower(p.active_substance), ${normalized}) > 0.24
        )
          AND (${atc} = '' OR p.atc_code ILIKE ${atcPattern})
          AND (
            ${letter} = ''
            OR p.trade_name ILIKE ${letterPattern}
            OR p.generic_name ILIKE ${letterPattern}
            OR p.active_substance ILIKE ${letterPattern}
          )
      `,
      sql`
        SELECT p.drug_id,
               max(p.generic_name) AS generic_name,
               max(p.atc_code) AS atc_code,
               count(*)::int AS product_count,
               array_remove(array_agg(DISTINCT p.pharmaceutical_form), NULL) AS forms,
               array_remove(array_agg(DISTINCT p.strength_text), NULL) AS strengths
        FROM public.api_current_product_catalog p
        WHERE (
          ${query} = ''
          OR p.trade_name ILIKE ${pattern}
          OR p.active_substance ILIKE ${pattern}
          OR p.generic_name ILIKE ${pattern}
          OR p.atc_code ILIKE ${pattern}
          OR p.manufacturer ILIKE ${pattern}
          OR p.ma_certificate ILIKE ${pattern}
          OR similarity(lower(p.trade_name), ${normalized}) > 0.24
          OR similarity(lower(p.active_substance), ${normalized}) > 0.24
        )
          AND (${atc} = '' OR p.atc_code ILIKE ${atcPattern})
          AND (
            ${letter} = ''
            OR p.trade_name ILIKE ${letterPattern}
            OR p.generic_name ILIKE ${letterPattern}
            OR p.active_substance ILIKE ${letterPattern}
          )
          AND p.drug_id IS NOT NULL
        GROUP BY p.drug_id
        ORDER BY generic_name
        LIMIT 500
      `,
    ]);

    return send(res, 200, {
      query,
      atc: atc || null,
      letter: letter || null,
      offset,
      limit,
      total: Number(totalRows[0]?.total || 0),
      genericGroups: genericRows,
      results,
    }, true);
  } catch (error) {
    console.error('Vercel ATC catalogue error', error);
    return send(res, 500, { error: 'ATC catalogue request failed' });
  }
}
