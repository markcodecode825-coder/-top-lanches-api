import type { PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import '@fastify/jwt';

interface MemoryCache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlSeconds?: number): void;
  delete(key: string): void;
  invalidatePrefix(prefix: string): void;
  clear(): void;
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    cache: MemoryCache;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; name: string };
    user: { sub: string; email: string; name: string };
  }
}
