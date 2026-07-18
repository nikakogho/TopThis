import { createServer } from './server.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';
const { app, io } = await createServer({
  logger: true,
  serveClient: process.env.NODE_ENV === 'production',
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
