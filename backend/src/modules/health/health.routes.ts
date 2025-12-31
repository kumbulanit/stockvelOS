import { FastifyInstance } from 'fastify';
import { prisma } from '../../infrastructure/database.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.get('/ready', async (request, reply) => {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;
      
      return {
        status: 'ready',
        checks: {
          database: 'ok',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'not ready',
        checks: {
          database: 'failed',
        },
        timestamp: new Date().toISOString(),
      };
    }
  });
}
