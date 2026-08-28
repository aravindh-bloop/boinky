import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env, integrations } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(
    cors({
      origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((s) => s.trim()),
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      env: env.NODE_ENV,
      integrations,
      time: new Date().toISOString(),
    });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
