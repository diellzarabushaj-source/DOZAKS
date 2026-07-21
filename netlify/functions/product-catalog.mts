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
        ? 'private, max-age=0, s-maxage=120, stale-while-revalidate=300'
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

function normalizeQuery(value: string) {
  return value
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'search';
  const sql = database();

  try {
    if (mode === 'health') {
      const [drugRows, productRows] = await asPublicApi(sql, [
        sql`
          SELECT
            count(*)::int AS visible_drugs,
            count(DISTINCT atc_code)::int AS atc_codes,
            min(valid_from) AS valid_from,
            max(valid_to) AS valid_to,
            max(version_label) AS version_label,
            max(source_title) AS source_title
          FROM public.api_current_drug_catalog
        `,
        sql`SELECT count(*)::int AS visible_products FROM public.api_current_product_catalog`,
      ]);
      return json({ ok: true, ...(drugRows[0] || {}), ...(productRows[0] || {}) });
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

    if (mode === 'drug-detail' || mode === 'products-by-drug') {
      const id = (url.searchParams.get('id') || '').trim();
      if (!id) return json({ error: 'Missing drug id' }, 400);
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
      if (!drugRows[0]) return json({ error: 'Drug not found' }, 404);
      return json({ drug: drugRows[0], products: productRows });
    }

    const query = (url.searchParams.get('q') || '').trim();
    const productLimit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 50);
    const drugLimit = Math.min(Math.max(Number(url.searchParams.get('drugLimit') || 8), 1), 20);
    if (query.length < 2) return json({ query, drugResults: [], productResults: [], results: [] });

    const normalized = normalizeQuery(query);
    const pattern = `%${query}%`;
    const normalizedPattern = `%${normalized}%`;

    const [drugResults, productResults] = await asPublicApi(sql, [
      sql`
        SELECT
          id, generic_name, normalized_name, atc_code, product_count,
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
        SELECT
          id, drug_id, generic_name, trade_name, active_substance, atc_code,
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

    return json({
      query,
      source: 'Kosovo official medicinal products catalogue',
      drugResults,
      productResults,
      results: productResults,
    });
  } catch (error) {
    console.error('DozaKS product-catalog error', error);
    return json({ error: 'Product catalog request failed' }, 500);
  }
};

export const config: Config = {
  path: '/api/product-catalog',
};
