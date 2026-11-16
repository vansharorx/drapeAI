import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { RequestHandler } from 'express';
import { z } from 'zod';

const secretText = process.env.JWT_SECRET;
if (!secretText || secretText.length < 32 || secretText.includes('replace-with-')) {
  throw new Error('JWT_SECRET must contain at least 32 random characters.');
}
const secret = new TextEncoder().encode(secretText);

export async function createAccessToken(userId: string) {
  return new SignJWT({ scope: 'user' }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('15m').sign(secret);
}

export function createRefreshToken() {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export const auth: RequestHandler = async (request, response, next) => {
  const header = request.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.', requestId: response.locals.requestId } });
    return;
  }
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const userId = z.string().uuid().safeParse(payload.sub);
    if (!userId.success) throw new Error('Invalid token subject');
    response.locals.userId = userId.data;
    next();
  } catch {
    response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Your session has expired. Sign in again.', requestId: response.locals.requestId } });
  }
};
