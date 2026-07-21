import { neon } from '@neondatabase/serverless';
import type { Config, Context } from '@netlify/functions';

declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200
        ? 'private, max-age=0, s-maxage=60, stale-while-revalidate=180'
        : 'no-store',
    },
  });
}

function database() {
  const connectionString = Netlify.env.get('DATABASE_URL');
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  return neon(connectionString);
}

async function asPublicApi(
  sql: ReturnType<typeof neon>,
  queries: Array<ReturnType<ReturnType<typeof neon>>>,
) {
  const rows = await sql.transaction([sql`SET LOCAL ROLE dozaks_api`, ...queries]);
  return rows.slice(1);
}

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'search';
  const sql = database();

  try {
    if (mode === 'health') {
      const [rows] = await asPublicApi(sql, [sql`
        SELECT
          count(*)::int AS visible_products,
          count(DISTINCT atc_code)::int AS atc_codes,
          count(DISTINCT active_substance)::int AS active_substances,
          min(valid_from) AS valid_from,
          max(valid_to) AS valid_to,
          max(version_label) AS version_label,
          max(source_title) AS source_title
        FROM public.api_current_product_catalog
      `]);
      return json({ ok: true, ...(rows[0] || {}) });
    }

    if (mode === 'detail') {
      const id = (url.searchParams.get('id') || '').trim();
      if (!id) return json({ error: 'Missing product id' }, 400);
      const [rows] = await asPublicApi(sql, [sql`
        SELECT *
        FROM public.api_current_product_catalog
        WHERE id = ${id}
        LIMIT 1
      `]);
      if (!rows[0]) return json({ error: 'Product not found' }, 404);
      return json(rows[0]);
    }

    const query = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 30), 1), 50);
    if (query.length < 2) return json({ results: [] });

    const normalized = query.toLocaleLowerCase('sq');
    const pattern = `%${query}%`;
    const [results] = await asPublicApi(sql, [sql`
      SELECT
        id, trade_name, active_substance, atc_code, strength_text,
        pharmaceutical_form, package_size, marketing_authorization_holder,
        manufacturer, ma_certificate, product_status, retail_price,
        valid_from, valid_to, version_label, source_title,
        GREATEST(
          similarity(lower(trade_name), ${normalized}),
          similarity(lower(active_substance), ${normalized}),
          similarity(lower(coalesce(atc_code, '')), ${normalized})
        ) AS relevance
      FROM public.api_current_product_catalog
      WHERE trade_name ILIKE ${pattern}
         OR active_substance ILIKE ${pattern}
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
      LIMIT ${limit}
    `]);

    return json({ query, results });
  } catch (error) {
    console.error('DozaKS product-catalog error', error);
    return json({ error: 'Product catalog request failed' }, 500);
  }
};

export const config: Config = {
  path: '/api/product-catalog',
};
