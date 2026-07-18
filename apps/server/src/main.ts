import { createServer } from './server.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';
const optionalNumber = (name: string): number | undefined => {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const { app, io } = await createServer({
  logger: true,
  serveClient: process.env.NODE_ENV === 'production',
  practice: {
    seed: optionalNumber('TOPTHIS_E2E_SEED'),
    botDelayMs: optionalNumber('TOPTHIS_E2E_BOT_DELAY_MS'),
    botSkipChance: optionalNumber('TOPTHIS_E2E_BOT_SKIP_CHANCE'),
    roundResultDelayMs: optionalNumber('TOPTHIS_E2E_ROUND_DELAY_MS'),
    targetScore: optionalNumber('TOPTHIS_E2E_TARGET_SCORE'),
    turnDurationMs: optionalNumber('TOPTHIS_E2E_TURN_DURATION_MS'),
  },
  databasePath: process.env.TOPTHIS_DATABASE_PATH,
  private: {
    seed: optionalNumber('TOPTHIS_E2E_SEED'),
    disconnectGraceMs: optionalNumber('TOPTHIS_E2E_DISCONNECT_GRACE_MS'),
    roundResultDelayMs: optionalNumber('TOPTHIS_E2E_ROUND_DELAY_MS'),
    targetScore: optionalNumber('TOPTHIS_E2E_TARGET_SCORE'),
    turnDurationMs: optionalNumber('TOPTHIS_E2E_TURN_DURATION_MS'),
  },
});

const close = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'Shutting down TopThis Server');
  await io.close();
  await app.close();
  process.exit(0);
};

process.once('SIGINT', () => void close('SIGINT'));
process.once('SIGTERM', () => void close('SIGTERM'));

await app.listen({ port: Number.isFinite(port) ? port : 3000, host });
app.log.info({ host, port: Number.isFinite(port) ? port : 3000 }, 'TopThis Server listening');
