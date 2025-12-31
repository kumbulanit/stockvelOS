import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';
import { logger } from './logger.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isDev
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
  });

if (config.isDev) {
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    logger.debug({ query: e.query, duration: e.duration }, 'Prisma Query');
  });
}

if (!config.isProd) {
  globalForPrisma.prisma = prisma;
}

export type Database = typeof prisma;
