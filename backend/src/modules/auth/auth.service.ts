import bcrypt from 'bcryptjs';
import { query, queryMaybe } from '../../db/query.js';
import { AppError } from '../../http/errors.js';
import { signToken, type UserRole } from './jwt.js';

export interface UserRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  password_hash: string;
  role: UserRole;
  preferred_language: string;
  region: string | null;
  created_at: string;
}

export type PublicUser = Omit<UserRow, 'password_hash'>;

const SALT_ROUNDS = 10;

function toPublic(u: UserRow): PublicUser {
  const { password_hash: _omit, ...rest } = u;
  return rest;
}

export interface SignupInput {
  name: string;
  password: string;
  role: UserRole;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  region?: string;
}

export async function signup(input: SignupInput) {
  if (!input.phone && !input.email) {
    throw AppError.badRequest('Provide at least one of phone or email');
  }

  const clash = await queryMaybe<{ id: string }>(
    `select id from users
      where (($1::text is not null and phone = $1)
          or ($2::text is not null and email = $2))
      limit 1`,
    [input.phone ?? null, input.email ?? null],
  );
  if (clash) throw AppError.conflict('An account with that phone or email already exists');

  const hash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const [user] = await query<UserRow>(
    `insert into users (name, phone, email, password_hash, role, preferred_language, region)
     values ($1, $2, $3, $4, $5, coalesce($6, 'en'), $7)
     returning *`,
    [
      input.name,
      input.phone ?? null,
      input.email ?? null,
      hash,
      input.role,
      input.preferredLanguage ?? null,
      input.region ?? null,
    ],
  );
  if (!user) throw new Error('Insert returned no row');

  return issue(user);
}

export interface LoginInput {
  identifier: string; // phone or email
  password: string;
}

export async function login(input: LoginInput) {
  const user = await queryMaybe<UserRow>(
    `select * from users where phone = $1 or email = $1 limit 1`,
    [input.identifier],
  );
  if (!user) throw AppError.unauthorized('Invalid credentials');

  const ok = await bcrypt.compare(input.password, user.password_hash);
  if (!ok) throw AppError.unauthorized('Invalid credentials');

  return issue(user);
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await queryMaybe<UserRow>(`select * from users where id = $1`, [id]);
  if (!user) throw AppError.notFound('User not found');
  return toPublic(user);
}

export async function updateProfile(
  id: string,
  patch: { name?: string; preferredLanguage?: string; region?: string },
): Promise<PublicUser> {
  const user = await queryMaybe<UserRow>(
    `update users set
       name = coalesce($2, name),
       preferred_language = coalesce($3, preferred_language),
       region = coalesce($4, region)
     where id = $1
     returning *`,
    [id, patch.name ?? null, patch.preferredLanguage ?? null, patch.region ?? null],
  );
  if (!user) throw AppError.notFound('User not found');
  return toPublic(user);
}

function issue(user: UserRow) {
  const token = signToken({ sub: user.id, role: user.role, name: user.name });
  return { token, user: toPublic(user) };
}
