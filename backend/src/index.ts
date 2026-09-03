import { createApp } from './app.js';
import { env, integrations } from './config/env.js';
import { logger } from './lib/logger.js';
import { assertDbConnection, closePool, pool } from './db/pool.js';
import { purgeStaleDrafts } from './modules/scans/scans.service.js';

async function main() {
  await assertDbConnection();

  const missing = Object.entries(integrations)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  if (missing.length > 0) {
    logger.warn({ missing }, 'some integrations are not configured — related endpoints will fail');
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`AgriPod backend listening on http://localhost:${env.PORT}`);
  });

  // Keep the Neon serverless compute warm so requests never hit a ~3s cold start.
  const keepAlive = setInterval(() => {
    pool.query('SELECT 1').catch((err) => logger.debug({ err }, 'keep-alive ping failed'));
  }, 240_000);
  keepAlive.unref();

  // Sweep abandoned scan drafts (started, never submitted) every 6h + once at boot.
  const sweep = () =>
    purgeStaleDrafts(24).catch((err) => logger.warn({ err }, 'draft sweep failed'));
  setTimeout(sweep, 30_000).unref();
  setInterval(sweep, 6 * 60 * 60_000).unref();

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start server');
  process.exit(1);
});
