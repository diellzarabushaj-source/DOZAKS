# DozaKS Clinical Data Layer

DozaKS uses Neon Postgres with separate production and development branches. Clinical schema changes and document imports are built and tested in `development` before an explicitly approved production migration.

## Source hierarchy

1. **Kosovo Essential Medicines List — Version 10 (2025)**: current structural source for essential-list status, dosage form, strength, institutional category and ATC.
2. **Kosovo Essential Medicines List (2023)**: superseded baseline retained for version comparison.
3. **Kosovo Drug Registry 2016 / fifth edition 2017**: internal historical reference for monographs and registered products. Its dosing text is never published automatically.
4. **Current verified clinical references**: required before numeric dosing, renal rules, pregnancy/lactation statements or treatment protocols can become public.

## Data states

- `raw_imported`: extracted but not normalized.
- `needs_review`: requires comparison with the rendered source page.
- `reviewed`: transcription and structure checked against the source.
- `legacy_imported`: historical monograph retained internally.
- `draft`: authored clinical content not approved for patient-facing use.
- `in_review`: awaiting clinical/editorial approval.
- `published`: visible through the public read-only API.
- `archived`: retained for audit but not active.

## Extraction SOP

Every import batch records:

- source document and version;
- page range;
- raw and normalized payload;
- extraction method and confidence;
- validation errors;
- reviewer and review timestamp;
- final table and target record ID.

Table-heavy pages must be verified against the rendered page image, not OCR text alone. Low-confidence rows remain `needs_review`. A source page and document version are mandatory for every essential-list entry, product and legacy monograph.

## Public API boundary

The role `dozaks_api` receives `SELECT` only on filtered API views:

- `api_icd_concepts`
- `api_current_essential_entries`
- `api_diagnosis_icd_mappings`

It has no direct access to raw excerpts, legacy monographs, import audit tables or private protocol tables. Legacy dosing text is never exposed by the public API.

## Personal protocols

The first protocol workspace stores private drafts in the browser and excludes patient identifiers. Server synchronization must not be enabled until clinician authentication, ownership checks, audit logging and row-level security are implemented.

A protocol links:

- one or more diagnoses;
- ICD mappings;
- selected drugs;
- ordered clinical steps;
- draft dose/route/timing text;
- safety and escalation notes;
- sources, version and editorial status.

## Migration rule

Production is changed only after:

1. schema and seed validation on Neon `development`;
2. API permission test using `SET LOCAL ROLE dozaks_api`;
3. UI/API preview against the development database;
4. explicit approval for the production migration;
5. post-migration row-count and visibility checks.
