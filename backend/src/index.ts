import { createApp } from './app';
import { config } from './config';
import { pool } from './db/pool';
import { migrate } from './db/migrate';
import { seedDemoData } from './db/seed';

async function main() {
  await migrate();
  if (config.seedDemoData) await seedDemoData();

  const server = createApp().listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
