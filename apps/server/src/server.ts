import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server as SocketIoServer } from 'socket.io';
import { HealthResponseSchema } from '@topthis/shared';
import { attachSocketBoundary } from './socket.js';

export interface CreateServerOptions {
  logger?: boolean | FastifyBaseLogger;
  serveClient?: boolean;
  clientDistPath?: string;
}

export interface TopThisServer {
  app: FastifyInstance;
  io: SocketIoServer;
}

const defaultClientDistPath = fileURLToPath(new URL('../../web/dist', import.meta.url));

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function createServer(options: CreateServerOptions = {}): Promise<TopThisServer> {
  const app = fastify({ logger: options.logger ?? false });

  app.get('/health', async () =>
    HealthResponseSchema.parse({ service: 'TopThis Server', status: 'ok' }),
  );

  const io = new SocketIoServer(app.server, {
    cors: { origin: false },
  });
  io.on('connection', attachSocketBoundary);

  if (options.serveClient) {
    const root = options.clientDistPath ?? defaultClientDistPath;
    if (await pathExists(root)) {
      await app.register(fastifyStatic, { root, wildcard: false });
    } else {
      app.log.info({ clientDistPath: root }, 'Client build not found; static serving disabled');
    }
  }

  return { app, io };
}
