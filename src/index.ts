/**
 * NextCandle Worker — entry point.
 *
 * Phase 1 boot : minimal HTTP server with /health and /metrics, plus an idle
 * heartbeat. The orchestrator (tick loop, feeds, scoring) is wired in Phase 2.
 *
 * The process MUST stay alive — Render's worker plan restarts the service
 * if the process exits, which would cause a crash loop.
 */

import express from 'express';
import { SCORE_MODEL_VERSION } from './state/constants.js';

const PORT = Number(process.env.PORT ?? 3000);
const startedAt = Date.now();
let shutdownRequested = false;

function main(): void {
  const app = express();

  // ── Health endpoint — Render uses this for healthCheckPath ─────────
  app.get('/health', (_req, res) => {
    res.json({
      status: shutdownRequested ? 'shutting_down' : 'healthy',
      phase: 'phase1-scaffold',
      uptime_s: Math.round((Date.now() - startedAt) / 1000),
      model_version: SCORE_MODEL_VERSION,
      worker_version: '0.1.0',
      // Phase 2 will populate ws/db/scheduler statuses here
      ws: { connected: false, note: 'wired in phase 2' },
      db: { connected: false, note: 'wired in phase 2' },
      scheduler: { running: false, note: 'wired in phase 2' },
    });
  });

  // ── Metrics endpoint — placeholder, prom-client wired in phase 2 ───
  app.get('/metrics', (_req, res) => {
    res.type('text/plain').send(
      [
        '# HELP nc_uptime_seconds Worker uptime in seconds',
        '# TYPE nc_uptime_seconds gauge',
        `nc_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`,
        '# HELP nc_phase Current implementation phase (1=scaffold, 2=engine, 3=feeds)',
        '# TYPE nc_phase gauge',
        'nc_phase 1',
      ].join('\n'),
    );
  });

  // ── Root — friendly 200 ────────────────────────────────────────────
  app.get('/', (_req, res) => {
    res.json({
      name: 'nextcandle-worker',
      phase: 'phase1-scaffold',
      model_version: SCORE_MODEL_VERSION,
    });
  });

  const server = app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[nextcandle-worker] http listening on :${PORT} model=${SCORE_MODEL_VERSION}`);
  });

  // ── Heartbeat log every 60s so Render shows activity ───────────────
  const heartbeat = setInterval(() => {
    if (shutdownRequested) return;
    const uptime = Math.round((Date.now() - startedAt) / 1000);
    // eslint-disable-next-line no-console
    console.log(`[nextcandle-worker] heartbeat uptime=${uptime}s phase=1`);
  }, 60_000);

  // ── Graceful shutdown ──────────────────────────────────────────────
  const shutdown = (signal: string): void => {
    if (shutdownRequested) return;
    shutdownRequested = true;
    // eslint-disable-next-line no-console
    console.log(`[nextcandle-worker] ${signal} received, shutting down`);
    clearInterval(heartbeat);
    server.close(() => {
      // eslint-disable-next-line no-console
      console.log('[nextcandle-worker] server closed, exiting');
      process.exit(0);
    });
    // Hard kill after 10s if server.close hangs
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
