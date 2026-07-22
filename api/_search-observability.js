import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

let sentryPromise = null;

function rounded(value) {
  return Number(Math.max(0, Number(value) || 0).toFixed(1));
}

function safeError(error) {
  return {
    name: String(error?.name || 'Error').slice(0, 80),
    message: String(error?.message || error || 'Unknown error').slice(0, 240),
  };
}

async function getSentry() {
  if (!process.env.SENTRY_DSN) return null;

  if (!sentryPromise) {
    sentryPromise = import('@sentry/node')
      .then((Sentry) => {
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
          release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
          tracesSampleRate: 0,
          sendDefaultPii: false,
        });
        return Sentry;
      })
      .catch((error) => {
        console.warn(JSON.stringify({
          event: 'dozaks.sentry.init_failed',
          ...safeError(error),
        }));
        return null;
      });
  }

  return sentryPromise;
}

export function createSearchTrace(req, res, operation = 'smart-search') {
  const requestId = randomUUID();
  const startedAt = performance.now();
  let databaseMs = 0;
  let finished = false;

  res.setHeader('x-dozaks-request-id', requestId);

  function timing() {
    const totalMs = rounded(performance.now() - startedAt);
    const dbMs = rounded(databaseMs);
    res.setHeader('x-dozaks-db-ms', String(dbMs));
    res.setHeader('x-dozaks-total-ms', String(totalMs));
    res.setHeader('server-timing', `db;dur=${dbMs}, total;dur=${totalMs}`);
    return { totalMs, databaseMs: dbMs };
  }

  function eventPayload(statusCode, meta = {}) {
    return {
      operation,
      requestId,
      statusCode,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      deployment: process.env.VERCEL_GIT_COMMIT_SHA || null,
      ...meta,
    };
  }

  async function measureDatabase(callback) {
    const databaseStartedAt = performance.now();
    try {
      return await callback();
    } finally {
      databaseMs += performance.now() - databaseStartedAt;
    }
  }

  function finish(statusCode, meta = {}) {
    if (finished) return null;
    finished = true;
    const measured = timing();
    const payload = {
      event: 'dozaks.search.completed',
      ...eventPayload(statusCode, meta),
      ...measured,
    };
    const writer = statusCode >= 500 ? console.error : statusCode >= 400 ? console.warn : console.log;
    writer(JSON.stringify(payload));
    return payload;
  }

  async function fail(error, statusCode = 500, meta = {}) {
    if (finished) return null;
    finished = true;
    const measured = timing();
    const details = safeError(error);
    const payload = {
      event: 'dozaks.search.failed',
      ...eventPayload(statusCode, meta),
      ...measured,
      errorName: details.name,
      errorMessage: details.message,
    };
    console.error(JSON.stringify(payload));

    const Sentry = await getSentry();
    if (Sentry) {
      Sentry.withScope((scope) => {
        scope.setTag('dozaks.operation', operation);
        scope.setTag('dozaks.request_id', requestId);
        scope.setLevel('error');
        scope.setContext('search_performance', {
          statusCode,
          totalMs: measured.totalMs,
          databaseMs: measured.databaseMs,
          ...meta,
        });
        Sentry.captureException(error);
      });
      await Sentry.flush(500);
    }

    return payload;
  }

  return {
    requestId,
    measureDatabase,
    finish,
    fail,
  };
}
