import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export type UserRole = 'farmer' | 'official';

export interface TokenPayload {
  sub: string; // user id
  role: UserRole;
  name: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') throw new Error('Malformed token');
  return decoded as unknown as TokenPayload;
}
