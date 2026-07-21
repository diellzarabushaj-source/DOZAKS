import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import process from 'node:process';
import { neon } from '@neondatabase/serverless';
import * as XLSX from 'xlsx';

const EXPECTED_TITLE = 'Lista zyrtare e çmimeve të produkteve medicinale Versioni 1.1';
const EXPECTED_HEADERS = [
  'Nr rendor',
  'ProtocolNo',
  'PDID',
  'Emri tregtar',
  'Substanca aktive',
  'ATC Code',
  'Fortësia',
  'Forma farmaceutike',
  'Madhësia e paketimit',
  'Bartësi i Autorizim Marketingut',
  'Prodhuesi',
  'MA certifikata',
  'Statusi',
  'Çmimi me shumicë',
  'Çmimi me marzhë',
  'TVSH',
  'Çmimi me pakicë',
  'Afati i vlefshmërisë',
];
const DOCUMENT_KEY = 'kosovo-official-medicinal-products-price-list-v1-1-2025';
const IMPORTER_VERSION = 'dozaks-xlsx-importer-1.0';
const BATCH_SIZE = 250;

function clean(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalize(value) {
  return String(value ?? '')
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseValidity(value) {
  const match = String(value ?? '').match(/(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/);
  if (!match) return { validFrom: null, validTo: null };
  const toIso = (text) => {
    const [day, month, year] = text.split('.');
    return `${year}-${month}-${day}`;
  };
  return { validFrom: toIso(match[1]), validTo: toIso(match[2]) };
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stableHash(record) {
  const ordered = Object.keys(record).sort().reduce((result, key) => {
    result[key] = record[key];
    return result;
  }, {});
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
}

function validateWorkbook(matrix) {
  const title = clean(matrix[0]?.[0]);
  if (title !== EXPECTED_TITLE) {
    throw new Error(`Titulli i papritur: ${title || '(zbrazët)'}`);
  }
  const headers = (matrix[1] || []).map((value) => clean(value)?.replace(/\s+$/, '') || '');
  const missing = EXPECTED_HEADERS.filter((header, index) => headers[index] !== header);
  if (missing.length) {
    throw new Error(`Struktura e kolonave ka ndryshuar: ${missing.join(', ')}`);
  }
}

function normalizeRow(row, sourceRowNumber) {
  const { validFrom, validTo } = parseValidity(row[17]);
  const record = {
    source_row_number: sourceRowNumber,
    ordinal_number: numberOrNull(row[0]),
    protocol_no: clean(row[1]),
    pdid: clean(row[2]),
    trade_name: clean(row[3]),
    active_substance_raw: clean(row[4]),
    active_substance_normalized: normalize(row[4]),
    atc_code: clean(row[5])?.toUpperCase() || null,
    strength_text: clean(row[6]),
    pharmaceutical_form: clean(row[7]),
    package_size: clean(row[8]),
    marketing_authorization_holder: clean(row[9]),
    manufacturer: clean(row[10]),
    ma_certificate: clean(row[11]),
    product_status: clean(row[12]),
    wholesale_price: numberOrNull(row[13]),
    margin_price: numberOrNull(row[14]),
    vat_text: clean(row[15]),
    retail_price: numberOrNull(row[16]),
    valid_from: validFrom,
    valid_to: validTo,
  };

  const required = ['trade_name', 'active_substance_raw', 'atc_code', 'strength_text', 'pharmaceutical_form', 'package_size'];
  const missing = required.filter((field) => !record[field]);
  if (missing.length) {
    return { accepted: false, sourceRowNumber, missing, raw: row };
  }

  const hashRecord = { ...record };
  record.source_hash = stableHash(hashRecord);
  record.search_text = normalize([
    record.trade_name,
    record.active_substance_raw,
    record.atc_code,
    record.strength_text,
    record.pharmaceutical_form,
    record.package_size,
    record.marketing_authorization_holder,
    record.manufacturer,
    record.ma_certificate,
    record.product_status,
    record.protocol_no,
    record.pdid,
  ].filter(Boolean).join(' '));

  return { accepted: true, record };
}

async function importBatch(sql, catalogVersionId, batch, batchNumber) {
  const payload = JSON.stringify(batch);
  const sourceRows = batch.map((row) => row.source_row_number);
  const [insertedRows] = await sql.transaction([
    sql`
      WITH payload AS (
        SELECT *
        FROM jsonb_to_recordset(${payload}::jsonb) AS x(
          source_row_number integer,
          ordinal_number integer,
          protocol_no text,
          pdid text,
          trade_name text,
          active_substance_raw text,
          active_substance_normalized text,
          atc_code text,
          strength_text text,
          pharmaceutical_form text,
          package_size text,
          marketing_authorization_holder text,
          manufacturer text,
          ma_certificate text,
          product_status text,
          wholesale_price numeric,
          margin_price numeric,
          vat_text text,
          retail_price numeric,
          valid_from date,
          valid_to date,
          source_hash text,
          search_text text
        )
      )
      INSERT INTO public.product_catalog_entries(
        catalog_version_id, source_row_number, ordinal_number, protocol_no, pdid,
        trade_name, active_substance_raw, active_substance_normalized, atc_code,
        strength_text, pharmaceutical_form, package_size,
        marketing_authorization_holder, manufacturer, ma_certificate,
        product_status, wholesale_price, margin_price, vat_text, retail_price,
        valid_from, valid_to, source_hash, search_text, import_status, review_status
      )
      SELECT
        ${catalogVersionId}::uuid, source_row_number, ordinal_number, protocol_no, pdid,
        trade_name, active_substance_raw, active_substance_normalized, atc_code,
        strength_text, pharmaceutical_form, package_size,
        marketing_authorization_holder, manufacturer, ma_certificate,
        product_status, wholesale_price, margin_price, vat_text, retail_price,
        valid_from, valid_to, source_hash, search_text, 'imported', 'needs_review'
      FROM payload
      ON CONFLICT(catalog_version_id, source_row_number) DO UPDATE SET
        ordinal_number=EXCLUDED.ordinal_number,
        protocol_no=EXCLUDED.protocol_no,
        pdid=EXCLUDED.pdid,
        trade_name=EXCLUDED.trade_name,
        active_substance_raw=EXCLUDED.active_substance_raw,
        active_substance_normalized=EXCLUDED.active_substance_normalized,
        atc_code=EXCLUDED.atc_code,
        strength_text=EXCLUDED.strength_text,
        pharmaceutical_form=EXCLUDED.pharmaceutical_form,
        package_size=EXCLUDED.package_size,
        marketing_authorization_holder=EXCLUDED.marketing_authorization_holder,
        manufacturer=EXCLUDED.manufacturer,
        ma_certificate=EXCLUDED.ma_certificate,
        product_status=EXCLUDED.product_status,
        wholesale_price=EXCLUDED.wholesale_price,
        margin_price=EXCLUDED.margin_price,
        vat_text=EXCLUDED.vat_text,
        retail_price=EXCLUDED.retail_price,
        valid_from=EXCLUDED.valid_from,
        valid_to=EXCLUDED.valid_to,
        source_hash=EXCLUDED.source_hash,
        search_text=EXCLUDED.search_text,
        import_status='imported',
        updated_at=now()
      RETURNING id
    `,
  ]);

  await sql`
    INSERT INTO public.product_catalog_import_batches(
      catalog_version_id, batch_number, source_row_start, source_row_end,
      total_rows, accepted_rows, rejected_rows, importer_version,
      status, notes, completed_at
    )
    VALUES(
      ${catalogVersionId}::uuid, ${batchNumber}, ${Math.min(...sourceRows)},
      ${Math.max(...sourceRows)}, ${batch.length}, ${insertedRows.length}, 0,
      ${IMPORTER_VERSION}, 'completed',
      'Import i validuar nga XLSX; pa të dhëna klinike të dozimit.', now()
    )
    ON CONFLICT(catalog_version_id, batch_number) DO UPDATE SET
      source_row_start=EXCLUDED.source_row_start,
      source_row_end=EXCLUDED.source_row_end,
      total_rows=EXCLUDED.total_rows,
      accepted_rows=EXCLUDED.accepted_rows,
      rejected_rows=EXCLUDED.rejected_rows,
      importer_version=EXCLUDED.importer_version,
      status='completed',
      notes=EXCLUDED.notes,
      completed_at=now()
  `;
}

async function main() {
  const filePath = resolve(process.argv[2] || 'Regjistri-i-barnave-Final-2025.xlsx');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL mungon.');

  const bytes = readFileSync(filePath);
  const fileHash = createHash('sha256').update(bytes).digest('hex');
  const workbook = XLSX.read(bytes, { type: 'buffer', cellDates: false, raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  validateWorkbook(matrix);

  const parsed = matrix.slice(2).map((row, index) => normalizeRow(row, index + 3));
  const accepted = parsed.filter((item) => item.accepted).map((item) => item.record);
  const rejected = parsed.filter((item) => !item.accepted);

  const validity = accepted.reduce((result, row) => {
    if (row.valid_from && (!result.min || row.valid_from < result.min)) result.min = row.valid_from;
    if (row.valid_to && (!result.max || row.valid_to > result.max)) result.max = row.valid_to;
    return result;
  }, { min: null, max: null });

  const sql = neon(connectionString);
  const [document] = await sql`
    INSERT INTO public.source_documents(
      document_key, title, jurisdiction, document_type, version_label,
      effective_date, source_year, total_rows, internal_only, is_current,
      source_file_name, file_sha256, rights_note, notes
    )
    VALUES(
      ${DOCUMENT_KEY}, ${EXPECTED_TITLE}, 'XK',
      'official_medicinal_products_price_list', '1.1', ${validity.min}, 2025,
      ${accepted.length + rejected.length}, true, true, ${basename(filePath)},
      ${fileHash}, 'Përdorim i brendshëm në DozaKS.',
      'Import i audituar nga skedari XLSX.'
    )
    ON CONFLICT(document_key) DO UPDATE SET
      title=EXCLUDED.title,
      effective_date=EXCLUDED.effective_date,
      total_rows=EXCLUDED.total_rows,
      is_current=true,
      source_file_name=EXCLUDED.source_file_name,
      file_sha256=EXCLUDED.file_sha256,
      notes=EXCLUDED.notes,
      updated_at=now()
    RETURNING id
  `;

  const [catalog] = await sql`
    INSERT INTO public.product_catalog_versions(
      source_document_id, catalog_name, version_label, valid_from, valid_to,
      source_row_count, status, imported_at
    )
    VALUES(
      ${document.id}::uuid, 'Lista zyrtare e çmimeve të produkteve medicinale',
      '1.1', ${validity.min}, ${validity.max}, ${accepted.length + rejected.length},
      'active', now()
    )
    ON CONFLICT(source_document_id) DO UPDATE SET
      valid_from=EXCLUDED.valid_from,
      valid_to=EXCLUDED.valid_to,
      source_row_count=EXCLUDED.source_row_count,
      status='active',
      imported_at=now(),
      updated_at=now()
    RETURNING id
  `;

  for (let index = 0; index < accepted.length; index += BATCH_SIZE) {
    const batch = accepted.slice(index, index + BATCH_SIZE);
    const batchNumber = Math.floor(index / BATCH_SIZE) + 1;
    await importBatch(sql, catalog.id, batch, batchNumber);
    console.log(`Batch ${batchNumber}: ${batch.length} rreshta`);
  }

  await sql`
    UPDATE public.product_catalog_versions
    SET imported_at=now(), source_row_count=${accepted.length + rejected.length}, updated_at=now()
    WHERE id=${catalog.id}::uuid
  `;

  console.log(JSON.stringify({
    file: basename(filePath),
    sha256: fileHash,
    accepted: accepted.length,
    rejected: rejected.length,
    validFrom: validity.min,
    validTo: validity.max,
  }, null, 2));

  if (rejected.length) {
    console.error('Rreshtat e refuzuar:', rejected.slice(0, 20));
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
