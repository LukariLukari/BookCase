import jwt, { type SignOptions } from 'jsonwebtoken';

export type AuthPayload = { id: string; sub: string; role: string };

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'bookcase-local-development-only';
  throw new Error('JWT_SECRET is required in production');
}

export function signJwt(payload: Record<string, unknown>, expiresIn: SignOptions['expiresIn'] = '7d') {
  return jwt.sign(payload, jwtSecret(), { expiresIn });
}

export function verifyJwt(token: string) {
  try {
    return jwt.verify(token, jwtSecret());
  } catch {
    return null;
  }
}

export function getRequestUser(request: Request): AuthPayload | null {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload || typeof payload === 'string') return null;
  if (typeof payload.id !== 'string' || typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null;
  return payload as AuthPayload;
}
