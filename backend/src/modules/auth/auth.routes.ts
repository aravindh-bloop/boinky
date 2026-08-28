import { Router } from 'express';
import { asyncHandler, validate, z } from '../../http/handler.js';
import { requireAuth } from '../../http/auth.js';
import * as auth from './auth.service.js';

export const authRouter = Router();

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  password: z.string().min(6).max(200),
  role: z.enum(['farmer', 'official']),
  phone: z.string().trim().min(6).max(20).optional(),
  email: z.string().trim().email().optional(),
  preferredLanguage: z.string().trim().min(2).max(10).optional(),
  region: z.string().trim().min(1).max(120).optional(),
});

authRouter.post(
  '/signup',
  validate({ body: signupSchema }),
  asyncHandler(async (req, res) => {
    const result = await auth.signup(req.body);
    res.status(201).json(result);
  }),
);

const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await auth.login(req.body);
    res.json(result);
  }),
);

authRouter.get(
  '/me',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = await auth.getUserById(req.user!.sub);
    res.json({ user });
  }),
);

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  preferredLanguage: z.string().trim().min(2).max(10).optional(),
  region: z.string().trim().min(1).max(120).optional(),
});

authRouter.patch(
  '/me',
  requireAuth(),
  validate({ body: profileSchema }),
  asyncHandler(async (req, res) => {
    const user = await auth.updateProfile(req.user!.sub, req.body);
    res.json({ user });
  }),
);
