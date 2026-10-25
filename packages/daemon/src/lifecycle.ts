import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { validateSafePath } from '@orient/schema';

export interface DaemonConfig {
  port?: number;
  host?: string;
  configDir?: string;
  repoRoot?: string;
  token?: string;
}

export interface LockfileData {
  pid: number;
  port: number;
  token: string;
  startedAt: string;
}

export interface DaemonInstance {
  port: number;
  token: string;
  server: FastifyInstance;
  isRunning: boolean;
  stop: () => Promise<void>;
}

export function readDaemonLockfile(configDir: string): LockfileData | null {
  const lockfilePath = path.join(configDir, 'daemon.json');
  if (!fs.existsSync(lockfilePath)) return null;

  try {
    const raw = fs.readFileSync(lockfilePath, 'utf8');
    return JSON.parse(raw) as LockfileData;
  } catch {
    return null;
  }
}

export function cleanupZombieLockfile(configDir: string): boolean {
  const data = readDaemonLockfile(configDir);
  if (!data) return false;

  const lockfilePath = path.join(configDir, 'daemon.json');

  try {
    // Probe PID with signal 0 (tests if process exists without killing it)
    process.kill(data.pid, 0);
    return false; // Process is running
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ESRCH') {
      // No such process - clean up zombie lockfile
      try {
        fs.unlinkSync(lockfilePath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

function writeDaemonLockfile(configDir: string, data: LockfileData): void {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  const lockfilePath = path.join(configDir, 'daemon.json');
  fs.writeFileSync(lockfilePath, JSON.stringify(data, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600
  });

  // Explicitly ensure 0600 permissions
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(lockfilePath, 0o600);
    } catch {
      // Ignore
    }
  }
}

export async function startDaemon(config: DaemonConfig = {}): Promise<DaemonInstance> {
  const configDir = config.configDir || path.join(os.homedir(), '.config', 'orient');
  const repoRoot = config.repoRoot || process.cwd();
  const token = config.token || crypto.randomBytes(32).toString('hex');
  const host = config.host || '127.0.0.1';
  const startPort = config.port || 4477;

  // Clean zombie lockfiles before attempting port bind
  cleanupZombieLockfile(configDir);

  const maxPort = startPort + 30;
  let activePort = startPort;
  let serverInstance: FastifyInstance | null = null;

  while (activePort <= maxPort) {
    const app = fastify({ logger: false });

    // 1. Strict loopback CORS
    await app.register(cors, {
      origin: (origin, cb) => {
        if (!origin || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      }
    });

    // 2. Layer 1 Security Guards: Host header, Origin header, Bearer token
    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      // Host header validation (blocks DNS rebinding)
      const reqHost = request.headers.host || '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(reqHost)) {
        reply.status(403).send({ error: 'Invalid Host header: requests restricted to loopback' });
        return reply;
      }

      // Origin header validation
      const reqOrigin = request.headers.origin;
      if (reqOrigin && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(reqOrigin)) {
        reply.status(403).send({ error: 'Invalid Origin: cross-site requests are rejected' });
        return reply;
      }

      // Bearer token authentication (Header or URL query token for EventSource)
      let reqToken: string | undefined;
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        reqToken = authHeader.slice(7).trim();
      } else {
        const query = request.query as Record<string, string> | undefined;
        if (query && typeof query.token === 'string') {
          reqToken = query.token;
        }
      }

      if (!reqToken || reqToken !== token) {
        reply.status(401).send({ error: 'Unauthorized: valid cryptographic bearer token required' });
        return reply;
      }
    });

    // 3. Core Health Route
    app.get('/api/health', async () => {
      return {
        status: 'ok',
        port: activePort,
        pid: process.pid,
        repoRoot
      };
    });

    // 4. Code Preview Route (with path traversal guard)
    app.get('/api/code', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { path?: string; range?: string };
      if (!query.path) {
        reply.status(400).send({ error: 'Missing path query parameter' });
        return reply;
      }

      const safeResult = validateSafePath(repoRoot, query.path);
      if (!safeResult.safe) {
        reply.status(403).send({ error: safeResult.error || 'Path escapes repository boundary' });
        return reply;
      }

      const fullPath = path.resolve(repoRoot, safeResult.normalizedPath);
      if (!fs.existsSync(fullPath)) {
        reply.status(404).send({ error: 'File not found' });
        return reply;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      return { path: safeResult.normalizedPath, content };
    });

    try {
      await app.listen({ port: activePort, host });
      serverInstance = app;
      break;
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      await app.close();
      if (nodeErr.code === 'EADDRINUSE') {
        activePort++;
      } else {
        throw err;
      }
    }
  }

  if (!serverInstance) {
    throw new Error(`Unable to bind daemon to any loopback port between ${startPort} and ${maxPort}`);
  }

  const lockfileData: LockfileData = {
    pid: process.pid,
    port: activePort,
    token,
    startedAt: new Date().toISOString()
  };
  writeDaemonLockfile(configDir, lockfileData);

  let isRunning = true;

  const stop = async () => {
    if (!isRunning) return;
    isRunning = false;

    try {
      await serverInstance?.close();
    } catch {
      // Ignore
    }

    const lockfilePath = path.join(configDir, 'daemon.json');
    if (fs.existsSync(lockfilePath)) {
      try {
        fs.unlinkSync(lockfilePath);
      } catch {
        // Ignore
      }
    }
  };

  return {
    port: activePort,
    token,
    server: serverInstance,
    get isRunning() {
      return isRunning;
    },
    stop
  };
}
