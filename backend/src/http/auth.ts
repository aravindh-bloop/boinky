import type { RequestHandler } from 'express';
import { AppError } from './errors.js';
import { verifyToken, type TokenPayload, type UserRole } from '../modules/auth/jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

function extractToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
}

/** Require a valid JWT. Optionally restrict to specific roles. */
export function requireAuth(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const token = extractToken(req.headers.authorization);
    if (!token) return next(AppError.unauthorized());
    try {
      const payload = verifyToken(token);
      if (roles.length > 0 && !roles.includes(payload.role)) {
        return next(AppError.forbidden(`Requires role: ${roles.join(' or ')}`));
      }
      req.user = payload;
      next();
    } catch {
      next(AppError.unauthorized('Invalid or expired token'));
    }
  };
}

/** Attach req.user if a valid token is present, but never reject. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = extractToken(req.headers.authorization);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      /* ignore */
    }
  }
  next();
};

export function currentUser(req: Express.Request): TokenPayload {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
