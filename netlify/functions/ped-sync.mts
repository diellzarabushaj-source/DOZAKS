import { neon } from '@neondatabase/serverless';
import type { Context } from '@netlify/functions';

declare const Netlify: {
  env: {
    get(key: string): string | undefined;
  };
};

const MIN_REGISTRY = 501;
const MAX_REGISTRY = 4012;
const MAX_ROWS = 250;

const fields = [
  'pediatric_dose_summary',
  'pediatric_indication',
  'pediatric_use_status',
  'pediatric_min_age_value',
  'pediatric_min_age_unit',
  'pediatric_max_age_value',
  'pediatric_max_age_unit',
  'pediatric_min_weight_kg',
  'pediatric_max_weight_kg',
  'pediatric_dose_min',
  'pediatric_dose_max',
  'pediatric_dose_unit',
  'pediatric_dose_basis',
  'pediatric_doses_per_day',
  'pediatric_interval_hours',
  'pediatric_max_single_value',
  'pediatric_max_single_unit',
  'pediatric_max_daily_value',
  'pediatric_max_daily_unit',
  'pediatric_route',
  'pediatric_restriction',
  'pediatric_concentration_value',
  'pediatric_concentration_unit',
  'pediatric_concentration_per_value',
  'pediatric_concentration_per_unit',
  'pediatric_source_url',
  'pediatric_source_section',
  'pediatric_verification_status',
  'pediatric_verified_at',
  'pediatric_primary_regimen_id',
] as const;

function clean(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).replace(/[\t\r\n]+/g, ' ').trim();
}

function response(body: string, status = 200, contentType = 'text/plain; charset=utf-8') {
  return new Response(body, {
    status,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store, max-age=0',
      'x-medindex-migration': 'pediatric-master-20260817',
    },
  });
}

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== 'GET') return response('Method not allowed', 405);

  const url = new URL(request.url);
  const expectedToken = Netlify.env.get('PED_SYNC_TOKEN');
  const suppliedToken = url.searchParams.get('token') || '';
  if (!expectedToken || suppliedToken !== expectedToken) return response('Unauthorized', 401);

  const start = Number.parseInt(url.searchParams.get('start') || '', 10);
  const end = Number.parseInt(url.searchParams.get('end') || '', 10);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < MIN_REGISTRY || end > MAX_REGISTRY || end < start || end - start + 1 > MAX_ROWS) {
    return response('Invalid range', 400);
  }

  const connectionString = Netlify.env.get('DATABASE_URL');
  if (!connectionString) return response('Database not configured', 503);
  const sql = neon(connectionString);

  try {
    const rows = await sql`
      SELECT registry_number,
             pediatric_dose_summary,
             pediatric_indication,
             pediatric_use_status,
             pediatric_min_age_value,
             pediatric_min_age_unit,
             pediatric_max_age_value,
             pediatric_max_age_unit,
             pediatric_min_weight_kg,
             pediatric_max_weight_kg,
             pediatric_dose_min,
             pediatric_dose_max,
             pediatric_dose_unit,
             pediatric_dose_basis,
             pediatric_doses_per_day,
             pediatric_interval_hours,
             pediatric_max_single_value,
             pediatric_max_single_unit,
             pediatric_max_daily_value,
             pediatric_max_daily_unit,
             pediatric_route,
             pediatric_restriction,
             pediatric_concentration_value,
             pediatric_concentration_unit,
             pediatric_concentration_per_value,
             pediatric_concentration_per_unit,
             pediatric_source_url,
             pediatric_source_section,
             pediatric_verification_status,
             pediatric_verified_at,
             pediatric_primary_regimen_id
      FROM public.drugs
      WHERE registry_number BETWEEN ${start} AND ${end}
      ORDER BY registry_number
    `;

    const expected = end - start + 1;
    if (rows.length !== expected || Number(rows[0]?.registry_number) !== start || Number(rows[rows.length - 1]?.registry_number) !== end) {
      return response('Non-contiguous registry range', 409);
    }

    const lines = rows.map((row: Record<string, unknown>) => fields.map((field) => clean(row[field])).join('\t'));
    return response(lines.join('\n'));
  } catch (error) {
    console.error('PED_SYNC_EXPORT_FAILED', error);
    return response('Export failed', 500);
  }
};
