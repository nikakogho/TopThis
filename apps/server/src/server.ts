import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server as SocketIoServer } from 'socket.io';
import { HealthResponseSchema } from '@topthis/shared';
import { attachSocketBoundary } from './socket.js';
import { PracticeService } from './practice.js';

export interface CreateServerOptions {
  logger?: boolean | FastifyBaseLogger;
  serveClient?: boolean;
  clientDistPath?: string;
  practice?: ConstructorParameters<typeof PracticeService>[0];
  corsOrigin?: string | string[] | false;
}

export interface TopThisServer {
  app: FastifyInstance;
  io: SocketIoServer;
  practice: PracticeService;
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
    cors: {
      origin:
        options.corsOrigin ??
        (process.env.NODE_ENV === 'production'
          ? false
          : ['http://localhost:5173', 'http://127.0.0.1:5173']),
    },
  });
  const practice = new PracticeService(options.practice);
  io.on('connection', (socket) => attachSocketBoundary(socket, practice));

  if (options.serveClient) {
    const root = options.clientDistPath ?? defaultClientDistPath;
    if (await pathExists(root)) {
      await app.register(fastifyStatic, { root, wildcard: false });
    } else {
      app.log.info({ clientDistPath: root }, 'Client build not found; static serving disabled');
    }
  }

  app.addHook('onClose', async () => {
    practice.close();
  });
  return { app, io, practice };
}
