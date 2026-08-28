import { pino } from 'pino';
import { env, isDev } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      '*.password',
      '*.password_hash',
      'password_hash',
    ],
    censor: '[redacted]',
  },
});

export type Logger = typeof logger;
