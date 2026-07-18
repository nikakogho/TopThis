import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server as SocketIoServer } from 'socket.io';
import { HealthResponseSchema } from '@topthis/shared';
import { attachSocketBoundary } from './socket.js';
import { PracticeService } from './practice.js';
import { SqliteGuestRepository, type GuestRepository } from './guests.js';
import { PrivateService } from './private.js';
import {
  GuestProfileCreationIntentSchema,
  GuestCreateResponseSchema,
  GuestMeResponseSchema,
} from '@topthis/shared';

export interface CreateServerOptions {
  logger?: boolean | FastifyBaseLogger;
  serveClient?: boolean;
  clientDistPath?: string;
  practice?: ConstructorParameters<typeof PracticeService>[0];
  corsOrigin?: string | string[] | false;
  databasePath?: string;
  guests?: GuestRepository;
  private?: ConstructorParameters<typeof PrivateService>[0];
}

export interface TopThisServer {
  app: FastifyInstance;
  io: SocketIoServer;
  practice: PracticeService;
  guests: GuestRepository;
  private: PrivateService;
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
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof Error && error.name === 'ZodError')
      return reply.code(400).send({ error: 'Invalid request' });
    return reply.send(error);
  });

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
  const guests = options.guests ?? new SqliteGuestRepository(options.databasePath);
  const privateService = new PrivateService(options.private);
  app.post('/api/guests', async (request) => {
    const intent = GuestProfileCreationIntentSchema.parse(request.body);
    return GuestCreateResponseSchema.parse(guests.create(intent.displayName));
  });
  app.get('/api/guests/me', async (request, reply) => {
    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const guest = token && guests.findByToken(token);
    if (!guest) return reply.code(401).send({ error: 'Unauthorized' });
    return GuestMeResponseSchema.parse({ guest });
  });
  io.use((socket, next) => {
    const token =
      typeof socket.handshake.auth.guestToken === 'string'
        ? socket.handshake.auth.guestToken
        : undefined;
    const guest = token && guests.findByToken(token);
    if (guest) socket.data.guest = guest;
    next(); // unauthenticated practice sockets remain valid
  });
  io.on('connection', (socket) => attachSocketBoundary(socket, practice, privateService));

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
    privateService.close();
    guests.close();
  });
  return { app, io, practice, guests, private: privateService };
}
