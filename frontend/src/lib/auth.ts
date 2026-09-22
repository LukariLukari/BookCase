import jwt from 'jsonwebtoken';

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'bookcase-local-development-only';
  throw new Error('JWT_SECRET is required in production');
}

export function signJwt(payload: any, expiresIn: string = '7d') {
  return jwt.sign(payload, jwtSecret(), { expiresIn: expiresIn as any });
}

export function verifyJwt(token: string) {
  try {
    return jwt.verify(token, jwtSecret());
  } catch (error) {
    return null;
  }
}
