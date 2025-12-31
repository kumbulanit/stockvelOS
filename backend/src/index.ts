import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { logger } from './infrastructure/logger.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { stokvelRoutes } from './modules/stokvels/stokvel.routes.js';
import { contributionRoutes } from './modules/contributions/contribution.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';

async function main() {
  const app = Fastify({
    logger: logger,
  });

  // Security plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Routes
  await app.register(healthRoutes, { prefix: '/api/v1/health' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(stokvelRoutes, { prefix: '/api/v1/stokvels' });
  await app.register(contributionRoutes, { prefix: '/api/v1/contributions' });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    
    // Don't expose internal errors
    const statusCode = error.statusCode ?? 500;
    const message = statusCode >= 500 ? 'Internal Server Error' : error.message;
    
    reply.status(statusCode).send({
      error: true,
      code: (error as any).code ?? 'INTERNAL_ERROR',
      message,
      ...(config.isDev && { stack: error.stack }),
    });
  });

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  });

  // Start server
  try {
    await app.listen({ 
      port: config.port, 
      host: '0.0.0.0' 
    });
    app.log.info(`Server running on http://localhost:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  return app;
}

main().catch(console.error);

export { main };
