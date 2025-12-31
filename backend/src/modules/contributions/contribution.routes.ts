import { FastifyInstance } from 'fastify';

export async function contributionRoutes(app: FastifyInstance) {
  // POST /api/v1/contributions - Create contribution
  app.post('/', async (request, reply) => {
    // TODO: Implement create contribution
    return { message: 'Create contribution - not yet implemented' };
  });

  // GET /api/v1/contributions/:id - Get contribution
  app.get('/:id', async (request, reply) => {
    // TODO: Implement get contribution
    return { message: 'Get contribution - not yet implemented' };
  });

  // POST /api/v1/contributions/:id/approve - Approve contribution
  app.post('/:id/approve', async (request, reply) => {
    // TODO: Implement approve contribution
    return { message: 'Approve contribution - not yet implemented' };
  });

  // POST /api/v1/contributions/:id/reject - Reject contribution
  app.post('/:id/reject', async (request, reply) => {
    // TODO: Implement reject contribution
    return { message: 'Reject contribution - not yet implemented' };
  });
}
