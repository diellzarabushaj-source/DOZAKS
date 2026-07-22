import { neon } from '@neondatabase/serverless';
import { createSearchTrace } from './_search-observability.js';

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';
}

function send(res, status, payload, cache = false) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', cache && status === 200
    ? 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
    : 'no-store');
  res.end(JSON.stringify(payload));
}

async function asPublicApi(sql, queries) {
  const rows = await sql.transaction([sql`SET LOCAL ROLE dozaks_api`, ...queries]);
  return rows.slice(1);
}

export default async function handler(req, res) {
  const trace = createSearchTrace(req, res, 'search-index');

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

  try {
    const [metadataRows, productRows] = await trace.measureDatabase(() => asPublicApi(sql, [
      sql`
        SELECT count(*)::int AS product_count,
               count(DISTINCT drug_id)::int AS drug_count,
               max(version_label) AS version_label,
               min(valid_from) AS valid_from,
               max(valid_to) AS valid_to,
               max(source_title) AS source_title
        FROM public.api_current_product_catalog
      `,
      sql`
        SELECT id, drug_id, trade_name, generic_name, active_substance, atc_code,
               strength_text, pharmaceutical_form, product_status, retail_price,
               pdid, protocol_no, manufacturer, marketing_authorization_holder
        FROM public.api_current_product_catalog
        ORDER BY trade_name, strength_text, id
      `,
    ]));

    const metadata = metadataRows[0] || {};
    const products = productRows.map((row) => [
      String(row.id || ''),
      String(row.drug_id || ''),
      row.trade_name || '',
      row.generic_name || '',
      row.active_substance || '',
      row.atc_code || '',
      row.strength_text || '',
      row.pharmaceutical_form || '',
      row.product_status || '',
      row.retail_price == null ? null : Number(row.retail_price),
      row.pdid || '',
      row.protocol_no || '',
      row.manufacturer || '',
      row.marketing_authorization_holder || '',
    ]);

    const version = [
      metadata.version_label || '1.1',
      metadata.product_count || products.length,
      metadata.valid_to || 'current',
    ].join('-');

    res.setHeader('x-dozaks-index-count', String(products.length));
    res.setHeader('x-dozaks-index-version', version);

    trace.finish(200, {
      outcome: 'ok',
      productCount: products.length,
      drugCount: Number(metadata.drug_count || 0),
    });

    return send(res, 200, {
      requestId: trace.requestId,
      schema: 1,
      version,
      versionLabel: metadata.version_label || '1.1',
      validFrom: metadata.valid_from || null,
      validTo: metadata.valid_to || null,
      sourceTitle: metadata.source_title || 'Kosovo official medicinal products catalogue',
      count: products.length,
      columns: [
        'id', 'drugId', 'tradeName', 'genericName', 'activeSubstance', 'atcCode',
        'strength', 'form', 'status', 'retailPrice', 'pdid', 'protocolNo',
        'manufacturer', 'authorizationHolder',
      ],
      products,
    }, true);
  } catch (error) {
    await trace.fail(error, 500, { outcome: 'database_or_runtime_error' });
    return send(res, 500, {
      requestId: trace.requestId,
      error: 'Search index request failed',
      code: 'SEARCH_INDEX_FAILED',
    });
  }
}
