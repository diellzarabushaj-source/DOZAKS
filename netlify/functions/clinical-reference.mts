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
      'cache-control': status === 200 ? 'private, max-age=0, s-maxage=120, stale-while-revalidate=300' : 'no-store',
    },
  });
}

function getDatabase() {
  const connectionString = Netlify.env.get('DATABASE_URL');
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  return neon(connectionString);
}

async function queryAsPublicApi(
  sql: ReturnType<typeof neon>,
  queries: Array<ReturnType<ReturnType<typeof neon>>>,
) {
  const results = await sql.transaction([
    sql`SET LOCAL ROLE dozaks_api`,
    ...queries,
  ]);
  return results.slice(1);
}

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'health';
  const sql = getDatabase();

  try {
    const [availabilityRows] = await queryAsPublicApi(sql, [sql`
      SELECT
        to_regclass('public.api_icd_concepts') IS NOT NULL AS has_icd,
        to_regclass('public.api_current_essential_entries') IS NOT NULL AS has_essential,
        to_regclass('public.api_diagnosis_icd_mappings') IS NOT NULL AS has_mappings,
        to_regclass('public.api_current_registered_products') IS NOT NULL AS has_registry
    `]);
    const availability = availabilityRows[0] || {};

    if (mode === 'health') {
      return json({
        ok: true,
        database: 'connected',
        clinicalReferenceSchema: availability,
      });
    }

    if (mode === 'icd') {
      if (!availability.has_icd) return json({ results: [], pendingMigration: true });
      const query = (url.searchParams.get('q') || '').trim();
      const system = (url.searchParams.get('system') || 'ICD-10').trim();
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 40), 1), 100);
      const pattern = `%${query}%`;
      const [results] = await queryAsPublicApi(sql, [sql`
        SELECT id, system_name, release_id, code, title, language, parent_code,
               chapter_code, class_kind, definition, inclusions, exclusions, source_uri
        FROM public.api_icd_concepts
        WHERE (${system} = 'all' OR system_name = ${system})
          AND (
            ${query} = ''
            OR code ILIKE ${pattern}
            OR title ILIKE ${pattern}
            OR similarity(lower(coalesce(code, '')), lower(${query})) > 0.25
            OR similarity(lower(title), lower(${query})) > 0.25
          )
        ORDER BY
          CASE WHEN lower(coalesce(code, '')) = lower(${query}) THEN 0 ELSE 1 END,
          GREATEST(
            similarity(lower(coalesce(code, '')), lower(${query})),
            similarity(lower(title), lower(${query}))
          ) DESC,
          code NULLS LAST,
          title
        LIMIT ${limit}
      `]);
      return json({ system, results });
    }

    if (mode === 'registered') {
      if (!availability.has_registry) return json({ results: [], pendingMigration: true });
      const query = (url.searchParams.get('q') || '').trim();
      const essentialOnly = url.searchParams.get('essential') === 'true';
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 250);
      const pattern = `%${query}%`;
      const [results] = await queryAsPublicApi(sql, [sql`
        SELECT product_id, drug_id, drug_slug, generic_name, therapeutic_group, atc_code,
               brand_name, dosage_form, strength_text, pack_text, manufacturer,
               manufacturer_country, authorization_number, authorization_holder,
               authorized_from, authorized_until, authorization_status, registry_source,
               registry_version, source_page, is_essential
        FROM public.api_current_registered_products
        WHERE (${essentialOnly} = false OR is_essential = true)
          AND (
            ${query} = ''
            OR generic_name ILIKE ${pattern}
            OR brand_name ILIKE ${pattern}
            OR atc_code ILIKE ${pattern}
            OR strength_text ILIKE ${pattern}
            OR similarity(lower(generic_name), lower(${query})) > 0.25
            OR similarity(lower(brand_name), lower(${query})) > 0.25
          )
        ORDER BY generic_name, brand_name, dosage_form, strength_text
        LIMIT ${limit}
      `]);
      return json({ results, sourcePolicy: 'Only current active Kosovo marketing authorizations are selectable.' });
    }

    if (mode === 'essential') {
      if (!availability.has_essential) return json({ results: [], pendingMigration: true });
      const query = (url.searchParams.get('q') || '').trim();
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);
      if (query.length < 2) return json({ results: [] });
      const pattern = `%${query}%`;
      const [results] = await queryAsPublicApi(sql, [sql`
        SELECT id, drug_slug, generic_name, generic_name_raw, dosage_form_raw,
               strength_raw, route_raw, availability_category_raw, atc_code_raw,
               restriction_note, indications_note, category_path, source_page,
               extraction_confidence, version_label, decision_number, effective_date,
               source_title
        FROM public.api_current_essential_entries
        WHERE generic_name ILIKE ${pattern}
           OR generic_name_raw ILIKE ${pattern}
           OR dosage_form_raw ILIKE ${pattern}
           OR strength_raw ILIKE ${pattern}
           OR atc_code_raw ILIKE ${pattern}
           OR similarity(lower(coalesce(generic_name, generic_name_raw)), lower(${query})) > 0.25
        ORDER BY
          GREATEST(
            similarity(lower(coalesce(generic_name, generic_name_raw)), lower(${query})),
            similarity(lower(coalesce(atc_code_raw, '')), lower(${query}))
          ) DESC,
          generic_name NULLS LAST,
          source_page,
          id
        LIMIT ${limit}
      `]);
      return json({ results });
    }

    if (mode === 'diagnosis-map') {
      if (!availability.has_mappings) return json({ results: [], pendingMigration: true });
      const slug = (url.searchParams.get('slug') || '').trim();
      if (!slug) return json({ error: 'Missing diagnosis slug' }, 400);
      const [results] = await queryAsPublicApi(sql, [sql`
        SELECT diagnosis_id, diagnosis_slug, diagnosis_name, code, icd_title,
               system_name, release_id, relation_type, mapping_status
        FROM public.api_diagnosis_icd_mappings
        WHERE diagnosis_slug = ${slug}
        ORDER BY CASE WHEN relation_type = 'primary' THEN 0 ELSE 1 END,
                 CASE WHEN system_name = 'ICD-10' THEN 0 ELSE 1 END
      `]);
      return json({ results });
    }

    return json({ error: 'Unknown mode' }, 400);
  } catch (error) {
    console.error('DozaKS clinical-reference error', error);
    return json({ error: 'Clinical reference request failed' }, 500);
  }
};

export const config: Config = {
  path: '/api/clinical-reference',
};
