import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.isDev ? 'debug' : 'info',
  transport: config.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.idNumber',
      'req.body.bankDetails',
    ],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;
