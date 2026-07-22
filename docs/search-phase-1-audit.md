# DozaKS Search Performance — Phase 1 Baseline

Date: 2026-07-22
Branch: `perf/search-phase-1-audit`
Production baseline commit: `546dbd969bd7ea0a7ae7c2ca53e692aa14897515`

## Scope

Measure the current search pipeline without changing the production database schema or user-facing behavior.

## Current request pipeline

One input field is currently observed by four separate search paths:

1. `app.js`
   - Immediate local search on every `input` event.
   - Re-renders the shared `#suggestions` dropdown.
   - Own submit, keyboard and result-click handlers.

2. `ux.js`
   - Schedules remote clinical enrichment after 260 ms.
   - Calls `/api/clinical-data?mode=search` when local results are fewer than five.
   - Hydrates local data and re-renders the shared dropdown.

3. `product-catalog.js`
   - Schedules catalogue search after 130 ms.
   - Calls `/api/product-catalog`.
   - Own submit, keyboard and click capture handlers.

4. `smart-search-ui.js`
   - Schedules smart search after 180 ms.
   - Calls `/api/smart-search`.
   - Own submit and click handlers.

This means one user query can trigger local rendering plus up to three remote API flows that compete for the same dropdown and form.

## Database baseline

Database: Neon `neondb`
Visible catalogue products: 4,006

Representative query: `amoxicillin`

Measured with `EXPLAIN ANALYZE` on the production branch:

- Product result query: approximately 135.8 ms execution on the first measured run; it scanned the 4,006-row catalogue view and evaluated fuzzy matching across many columns.
- Generic-drug aggregation query: approximately 49.6 ms execution on a warm run.
- Total-count query: approximately 51.6 ms execution on a warm run.

The current `/api/smart-search` transaction runs all three queries for a normal dropdown search. The database component alone can therefore exceed 100–200 ms before serverless/network/browser latency, and more on a cold compute/cache path.

## Confirmed bottlenecks

1. Duplicate frontend listeners and timers.
2. Multiple active API endpoints for the same search input.
3. Multiple modules write to the same results container.
4. Multiple capture/bubble submit and keyboard handlers compete.
5. Smart-search calculates a full total count during typeahead.
6. Broad fuzzy predicates scan all 4,006 visible products and repeatedly evaluate similarity functions.
7. `pg_stat_statements` is not installed, so Neon slow-query history is currently unavailable. No extension was installed during this audit.

## Phase 1 instrumentation requirements

- Add a generated request ID to smart-search responses.
- Return non-sensitive timing headers for total API and database duration.
- Log one structured JSON event per completed or failed smart-search request.
- Never log the database connection string or secrets.
- Keep instrumentation on the audit branch until verified.

## Phase 1 exit criteria

- One documented source map of all search listeners.
- Baseline database timings recorded.
- Vercel/Sentry-compatible structured timing logs added on the audit branch.
- No production database mutation.
- No Sanity, A–Z or secondary UI work started.
