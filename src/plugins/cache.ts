import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env';

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

class InMemoryCache {
  private readonly entries = new Map<string, CacheEntry>();

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds = env.CACHE_TTL_SECONDS): void {
    if (ttlSeconds <= 0) return;
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

const cachePlugin: FastifyPluginAsync = async (app) => {
  app.decorate('cache', new InMemoryCache());
};

export default fp(cachePlugin, { name: 'cache' });
