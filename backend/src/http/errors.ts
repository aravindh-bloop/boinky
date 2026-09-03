import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import { isProd } from '../config/env.js';

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'bad_request', message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError(401, 'unauthorized', message);
  }
  static forbidden(message = 'Not allowed') {
    return new AppError(403, 'forbidden', message);
  }
  static notFound(message = 'Resource not found') {
    return new AppError(404, 'not_found', message);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError(409, 'conflict', message, details);
  }
  static unprocessable(message: string, details?: unknown) {
    return new AppError(422, 'unprocessable', message, details);
  }
  static upstream(message: string, details?: unknown) {
    return new AppError(502, 'upstream_error', message, details);
  }
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound('Route not found'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  // Multer signals its own limits (file too large, unexpected field name) with a
  // MulterError, which is neither AppError nor ZodError and was falling through
  // to a bare 500. Its `code` is the actionable part, so surface it as a 400.
  if (isMulterError(err)) {
    logger.warn({ code: err.code, field: err.field, path: req.path }, 'upload rejected');
    res.status(400).json({
      error: {
        code: 'upload_error',
        message: multerMessage(err),
        details: { multerCode: err.code, field: err.field },
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, path: req.path }, err.message);
    } else {
      logger.warn({ code: err.code, path: req.path }, err.message);
    }
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  logger.error({ err, path: req.path }, 'unhandled error');
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: isProd ? 'Internal server error' : String((err as Error)?.message ?? err),
    },
  });
}

interface MulterLikeError extends Error {
  code: string;
  field?: string;
}

/** Duck-typed so this file needs no multer import. */
function isMulterError(err: unknown): err is MulterLikeError {
  return (
    err instanceof Error &&
    err.name === 'MulterError' &&
    typeof (err as MulterLikeError).code === 'string'
  );
}

function multerMessage(err: MulterLikeError): string {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return 'That file is too large.';
    case 'LIMIT_UNEXPECTED_FILE':
      return `Unexpected upload field "${err.field ?? 'unknown'}".`;
    case 'LIMIT_FILE_COUNT':
      return 'Too many files in one upload.';
    default:
      return `Upload rejected (${err.code}).`;
  }
}
