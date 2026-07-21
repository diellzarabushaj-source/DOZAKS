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
      'cache-control': status === 200 ? 'public, max-age=30, s-maxage=120' : 'no-store',
    },
  });
}

function getDatabase() {
  const connectionString = Netlify.env.get('DATABASE_URL');
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  return neon(connectionString);
}

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const requestUrl = new URL(request.url);
  const mode = requestUrl.searchParams.get('mode') || 'bootstrap';
  const sql = getDatabase();

  try {
    if (mode === 'health') {
      const [row] = await sql`
        SELECT
          (SELECT count(*)::int FROM public.drugs WHERE editorial_status = 'published') AS drugs,
          (SELECT count(*)::int FROM public.diagnoses WHERE editorial_status = 'published') AS diagnoses,
          (SELECT count(*)::int FROM public.symptoms WHERE editorial_status = 'published') AS symptoms,
          now() AS checked_at
      `;
      return json({ ok: true, database: 'connected', ...row });
    }

    if (mode === 'search') {
      const query = (requestUrl.searchParams.get('q') || '').trim();
      const limit = Math.min(Math.max(Number(requestUrl.searchParams.get('limit') || 12), 1), 30);
      if (query.length < 2) return json({ results: [] });
      const pattern = `%${query}%`;

      const results = await sql`
        WITH drug_results AS (
          SELECT
            d.id::text AS id,
            d.slug,
            d.generic_name AS name,
            'generic'::text AS type,
            'Bar gjenerik'::text AS type_label,
            d.therapeutic_group AS group_name,
            d.description AS summary,
            COALESCE(array_remove(array_agg(DISTINCT a.alias), NULL), ARRAY[]::text[]) AS aliases,
            GREATEST(
              similarity(lower(d.generic_name), lower(${query})),
              COALESCE(max(similarity(lower(a.alias), lower(${query}))), 0)
            ) AS score
          FROM public.drugs d
          LEFT JOIN public.drug_aliases a ON a.drug_id = d.id AND a.is_active
          WHERE d.editorial_status = 'published'
            AND (
              d.generic_name ILIKE ${pattern}
              OR a.alias ILIKE ${pattern}
              OR similarity(lower(d.generic_name), lower(${query})) > 0.24
              OR similarity(lower(COALESCE(a.alias, '')), lower(${query})) > 0.24
            )
          GROUP BY d.id
        ),
        diagnosis_results AS (
          SELECT
            id::text,
            slug,
            name,
            'diagnosis'::text AS type,
            'Diagnozë'::text AS type_label,
            COALESCE(specialty, 'Algoritëm klinik') AS group_name,
            summary,
            ARRAY[]::text[] AS aliases,
            similarity(lower(name), lower(${query})) AS score
          FROM public.diagnoses
          WHERE editorial_status = 'published'
            AND (name ILIKE ${pattern} OR similarity(lower(name), lower(${query})) > 0.24)
        ),
        symptom_results AS (
          SELECT
            id::text,
            slug,
            name,
            'symptom'::text AS type,
            'Simptomë'::text AS type_label,
            'Vlerësim klinik'::text AS group_name,
            summary,
            ARRAY[]::text[] AS aliases,
            similarity(lower(name), lower(${query})) AS score
          FROM public.symptoms
          WHERE editorial_status = 'published'
            AND (name ILIKE ${pattern} OR similarity(lower(name), lower(${query})) > 0.24)
        )
        SELECT * FROM (
          SELECT * FROM drug_results
          UNION ALL
          SELECT * FROM diagnosis_results
          UNION ALL
          SELECT * FROM symptom_results
        ) combined
        ORDER BY score DESC, name ASC
        LIMIT ${limit}
      `;
      return json({ results });
    }

    if (mode === 'drug') {
      const slug = (requestUrl.searchParams.get('slug') || '').trim();
      if (!slug) return json({ error: 'Missing drug slug' }, 400);

      const [drug] = await sql`
        SELECT
          d.id::text,
          d.slug,
          d.generic_name,
          d.therapeutic_group,
          d.description,
          d.high_alert,
          d.verified_at,
          COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object('alias', a.alias, 'type', a.alias_type))
              FILTER (WHERE a.id IS NOT NULL),
            '[]'::jsonb
          ) AS aliases
        FROM public.drugs d
        LEFT JOIN public.drug_aliases a ON a.drug_id = d.id AND a.is_active
        WHERE d.slug = ${slug} AND d.editorial_status = 'published'
        GROUP BY d.id
      `;
      if (!drug) return json({ error: 'Drug not found' }, 404);

      const [forms, dosingRules, renal, pregnancy] = await Promise.all([
        sql`
          SELECT form_name, strength_text, route, market_status
          FROM public.drug_forms
          WHERE drug_id = ${drug.id}::uuid AND editorial_status = 'published'
          ORDER BY form_name, strength_text
        `,
        sql`
          SELECT population, route, dose_text, interval_text, duration_text,
                 max_single_dose_mg, max_daily_dose_mg, verified_at
          FROM public.dosing_rules
          WHERE drug_id = ${drug.id}::uuid AND editorial_status = 'published'
          ORDER BY population, route
        `,
        sql`
          SELECT egfr_min, egfr_max, recommendation, dialysis_notes
          FROM public.renal_adjustments
          WHERE drug_id = ${drug.id}::uuid AND editorial_status = 'published'
          ORDER BY egfr_max DESC NULLS FIRST
        `,
        sql`
          SELECT pregnancy_summary, lactation_summary, trimester_notes, risk_level
          FROM public.pregnancy_lactation
          WHERE drug_id = ${drug.id}::uuid AND editorial_status = 'published'
          LIMIT 1
        `,
      ]);

      return json({ drug, forms, dosingRules, renalAdjustments: renal, pregnancy: pregnancy[0] || null });
    }

    const [drugs, diagnoses, symptoms, emergencies] = await Promise.all([
      sql`
        SELECT
          d.id::text,
          d.slug,
          d.generic_name,
          d.therapeutic_group,
          d.description,
          d.high_alert,
          COALESCE(array_remove(array_agg(DISTINCT a.alias), NULL), ARRAY[]::text[]) AS aliases,
          COALESCE(
            jsonb_agg(DISTINCT jsonb_build_object(
              'name', f.form_name,
              'strength', f.strength_text,
              'route', f.route,
              'marketStatus', f.market_status
            )) FILTER (WHERE f.id IS NOT NULL AND f.editorial_status = 'published'),
            '[]'::jsonb
          ) AS forms,
          (SELECT count(*)::int FROM public.dosing_rules r WHERE r.drug_id = d.id AND r.editorial_status = 'published') AS published_dose_count
        FROM public.drugs d
        LEFT JOIN public.drug_aliases a ON a.drug_id = d.id AND a.is_active
        LEFT JOIN public.drug_forms f ON f.drug_id = d.id
        WHERE d.editorial_status = 'published'
        GROUP BY d.id
        ORDER BY d.generic_name
      `,
      sql`
        SELECT id::text, slug, name, specialty, summary, red_flags
        FROM public.diagnoses
        WHERE editorial_status = 'published'
        ORDER BY name
      `,
      sql`
        SELECT id::text, slug, name, summary, red_flags
        FROM public.symptoms
        WHERE editorial_status = 'published'
        ORDER BY name
      `,
      sql`
        SELECT id::text, slug, name, summary
        FROM public.emergency_protocols
        WHERE editorial_status = 'published'
        ORDER BY name
      `,
    ]);

    return json({
      database: 'neon',
      editorialPolicy: 'Only published records are returned by the public API.',
      drugs,
      diagnoses,
      symptoms,
      emergencies,
    });
  } catch (error) {
    console.error('DozaKS clinical-data error', error);
    return json({ error: 'Database request failed' }, 500);
  }
};

export const config: Config = {
  path: '/api/clinical-data',
};
