import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { ErrorRequestHandler, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { fileTypeFromBuffer } from 'file-type';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from './db.js';
import { auth, createAccessToken, createRefreshToken, hashRefreshToken } from './security.js';
import { GarmentRecognitionError, recognizeGarment } from './openrouter.js';

const app = express();
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);
const port = Number(process.env.PORT ?? 4000);
const maxUploadBytes = Math.min(10 * 1024 * 1024, Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024));
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploadRoot = path.resolve(serverRoot, process.env.UPLOAD_DIR ?? 'private-uploads');
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:8081';
const categories = ['Tops', 'Bottoms', 'Dresses', 'Shoes', 'Outerwear', 'Accessories'] as const;
const availabilities = ['Clean', 'Dirty', 'Reserved'] as const;

app.disable('x-powered-by');
app.use((request, response, next) => {
  response.locals.requestId = request.header('x-request-id')?.slice(0, 80) || randomUUID();
  response.setHeader('X-Request-ID', response.locals.requestId);
  next();
});
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: corsOrigin === '*' && process.env.NODE_ENV !== 'production' ? true : corsOrigin.split(',').map((origin) => origin.trim()), credentials: false }));
app.use(express.json({ limit: '48kb', type: 'application/json' }));
app.use('/v1/auth', rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/v1/outfit-recommendations', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }));
const uploadLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false });
const recognitionLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

app.get('/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok' });
  } catch {
    response.status(503).json({ status: 'unavailable' });
  }
});

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
});

app.post('/v1/auth/register', asyncRoute(async (request, response) => {
  const input = credentialsSchema.safeParse(request.body);
  if (!input.success) return fail(response, 422, 'VALIDATION_ERROR', 'Enter a valid email and a password with at least 10 characters.', input.error.issues.map((issue) => ({ field: issue.path.join('.'), code: issue.code })));
  const passwordHash = await bcrypt.hash(input.data.password, 12);
  try {
    const created = await pool.query<{ id: string; email: string }>('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [input.data.email, passwordHash]);
    return await issueSession(response, created.rows[0]!.id, created.rows[0]!.email, 201);
  } catch (error) {
    if (isPgCode(error, '23505')) return fail(response, 409, 'ACCOUNT_EXISTS', 'An account with this email already exists.');
    throw error;
  }
}));

app.post('/v1/auth/login', asyncRoute(async (request, response) => {
  const input = credentialsSchema.safeParse(request.body);
  if (!input.success) return fail(response, 422, 'VALIDATION_ERROR', 'Enter a valid email and password.');
  const result = await pool.query<{ id: string; email: string; password_hash: string }>('SELECT id, email, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL', [input.data.email]);
  const user = result.rows[0];
  const passwordMatches = await bcrypt.compare(input.data.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) return fail(response, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  return issueSession(response, user.id, user.email, 200);
}));

app.post('/v1/auth/refresh', asyncRoute(async (request, response) => {
  const input = z.object({ refreshToken: z.string().min(40).max(120) }).safeParse(request.body);
  if (!input.success) return fail(response, 401, 'UNAUTHORIZED', 'Sign in again to continue.');
  const tokenHash = hashRefreshToken(input.data.refreshToken);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query<{ id: string; user_id: string; email: string }>(
      `SELECT s.id, s.user_id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.refresh_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.deleted_at IS NULL FOR UPDATE OF s`, [tokenHash]);
    const session = found.rows[0];
    if (!session) { await client.query('ROLLBACK'); return fail(response, 401, 'UNAUTHORIZED', 'Your session has expired. Sign in again.'); }
    const nextRefresh = createRefreshToken();
    await client.query('UPDATE sessions SET refresh_hash = $1, expires_at = now() + interval \'30 days\' WHERE id = $2', [hashRefreshToken(nextRefresh), session.id]);
    const accessToken = await createAccessToken(session.user_id);
    await client.query('COMMIT');
    return response.json({ data: { accessToken, refreshToken: nextRefresh, user: { id: session.user_id, email: session.email } } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}));

app.post('/v1/auth/logout', asyncRoute(async (request, response) => {
  const input = z.object({ refreshToken: z.string().min(40).max(120) }).safeParse(request.body);
  if (input.success) await pool.query('UPDATE sessions SET revoked_at = now() WHERE refresh_hash = $1 AND revoked_at IS NULL', [hashRefreshToken(input.data.refreshToken)]);
  return response.status(204).end();
}));

app.get('/v1/me', auth, asyncRoute(async (_request, response) => {
  const result = await pool.query<{ id: string; email: string; created_at: string }>('SELECT id, email, created_at FROM users WHERE id = $1 AND deleted_at IS NULL', [userId(response)]);
  if (!result.rows[0]) return fail(response, 404, 'NOT_FOUND', 'Account not found.');
  return response.json({ data: { id: result.rows[0].id, email: result.rows[0].email, createdAt: result.rows[0].created_at } });
}));

app.delete('/v1/me', auth, asyncRoute(async (_request, response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const images = await client.query<{ object_key: string }>('SELECT object_key FROM garment_images WHERE user_id=$1 FOR UPDATE', [userId(response)]);
    for (const image of images.rows) await client.query('INSERT INTO object_deletion_queue(object_key) VALUES($1) ON CONFLICT DO NOTHING', [image.object_key]);
    const deleted = await client.query('DELETE FROM users WHERE id=$1 RETURNING id', [userId(response)]);
    if (!deleted.rowCount) { await client.query('ROLLBACK'); return fail(response, 404, 'NOT_FOUND', 'Account not found.'); }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
  await processObjectDeletionQueue();
  return response.status(204).end();
}));

app.get('/v1/garments', auth, asyncRoute(async (request, response) => {
  const query = z.object({ category: z.enum(categories).optional(), availability: z.enum(availabilities).optional(), q: z.string().trim().max(80).optional(), archived: z.enum(['true', 'false']).optional(), cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(30) }).safeParse(request.query);
  if (!query.success) return fail(response, 422, 'VALIDATION_ERROR', 'Some wardrobe filters are invalid.');
  const values: unknown[] = [userId(response)];
  const where = ['g.user_id = $1'];
  if (query.data.category) { values.push(query.data.category); where.push(`g.category = $${values.length}`); }
  if (query.data.availability) { values.push(query.data.availability); where.push(`g.availability = $${values.length}`); }
  if (query.data.q) { values.push(`%${escapeLike(query.data.q)}%`); where.push(`(g.name ILIKE $${values.length} ESCAPE '\\' OR g.occasion ILIKE $${values.length} ESCAPE '\\')`); }
  if (query.data.archived !== 'true') where.push('g.archived = false');
  if (query.data.cursor) {
    values.push(query.data.cursor);
    where.push(`(g.created_at,g.id) < (SELECT created_at,id FROM garments WHERE id = $${values.length} AND user_id = $1)`);
  }
  values.push(query.data.limit + 1);
  const result = await pool.query<GarmentRow>(
    `SELECT g.id, g.name, g.category, g.color, g.occasion, g.availability, g.favorite, g.archived, g.created_at,
      EXISTS (SELECT 1 FROM garment_images gi WHERE gi.garment_id = g.id) AS has_image
     FROM garments g WHERE ${where.join(' AND ')} ORDER BY g.created_at DESC, g.id DESC LIMIT $${values.length}`,
    values,
  );
  const hasMore = result.rows.length > query.data.limit;
  const rows = result.rows.slice(0, query.data.limit);
  return response.json({ data: rows.map(serializeGarment), nextCursor: hasMore ? rows[rows.length - 1]?.id ?? null : null });
}));

const garmentInput = z.object({
  name: z.string().trim().min(1).max(48),
  category: z.enum(categories),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#B9B2A8'),
  occasion: z.string().trim().max(160).default('Everyday'),
  availability: z.enum(availabilities).default('Clean'),
});

app.post('/v1/garments', auth, asyncRoute(async (request, response) => {
  const parsed = garmentInput.safeParse(request.body);
  if (!parsed.success) return fail(response, 422, 'VALIDATION_ERROR', 'Check the garment details.', parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), code: issue.code })));
  const values = parsed.data;
  const result = await pool.query<GarmentRow>(
    `INSERT INTO garments (user_id,name,category,color,occasion,availability) VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id,name,category,color,occasion,availability,favorite,archived,created_at,false AS has_image`,
    [userId(response), values.name, values.category, values.color, values.occasion, values.availability],
  );
  return response.status(201).json({ data: serializeGarment(result.rows[0]!) });
}));

app.get('/v1/garments/:id', auth, asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  if (!id) return fail(response, 404, 'NOT_FOUND', 'Garment not found.');
  const result = await pool.query<GarmentRow>(`SELECT g.id,g.name,g.category,g.color,g.occasion,g.availability,g.favorite,g.archived,g.created_at,
    EXISTS (SELECT 1 FROM garment_images gi WHERE gi.garment_id=g.id) AS has_image FROM garments g WHERE g.id=$1 AND g.user_id=$2`, [id, userId(response)]);
  if (!result.rows[0]) return fail(response, 404, 'NOT_FOUND', 'Garment not found.');
  return response.json({ data: serializeGarment(result.rows[0]) });
}));

app.patch('/v1/garments/:id', auth, asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  if (!id) return fail(response, 404, 'NOT_FOUND', 'Garment not found.');
  const parsed = garmentInput.partial().strict().safeParse(request.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) return fail(response, 422, 'VALIDATION_ERROR', 'Provide valid garment fields to update.', parsed.success ? undefined : parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), code: issue.code })));
  const columns: Record<keyof typeof parsed.data, string> = { name: 'name', category: 'category', color: 'color', occasion: 'occasion', availability: 'availability' };
  const values: unknown[] = [id, userId(response)];
  const setters = Object.entries(parsed.data).map(([key, value]) => { values.push(value); return `${columns[key as keyof typeof parsed.data]} = $${values.length}`; });
  const result = await pool.query<GarmentRow>(
    `UPDATE garments g SET ${setters.join(', ')}, updated_at=now() WHERE g.id=$1 AND g.user_id=$2
     RETURNING g.id,g.name,g.category,g.color,g.occasion,g.availability,g.favorite,g.archived,g.created_at,
     EXISTS (SELECT 1 FROM garment_images gi WHERE gi.garment_id=g.id) AS has_image`, values);
  if (!result.rows[0]) return fail(response, 404, 'NOT_FOUND', 'Garment not found.');
  return response.json({ data: serializeGarment(result.rows[0]) });
}));

app.post('/v1/garments/:id/favorite', auth, asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  const input = z.object({ favorite: z.boolean() }).safeParse(request.body);
  if (!id || !input.success) return fail(response, 422, 'VALIDATION_ERROR', 'Favorite state is invalid.');
  const result = await pool.query('UPDATE garments SET favorite=$1,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id', [input.data.favorite, id, userId(response)]);
  if (!result.rowCount) return fail(response, 404, 'NOT_FOUND', 'Garment not found.');
  return response.json({ data: { id, favorite: input.data.favorite } });
}));

app.patch('/v1/garments/:id/archive', auth, asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  const input = z.object({ archived: z.boolean() }).safeParse(request.body);
  if (!id || !input.success) return fail(response, 422, 'VALIDATION_ERROR', 'Archive state is invalid.');
  const result = await pool.query('UPDATE garments SET archived=$1,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id', [input.data.archived, id, userId(response)]);
  if (!result.rowCount) return fail(response, 404, 'NOT_FOUND', 'Garment not found.');
  return response.json({ data: { id, archived: input.data.archived } });
}));

app.delete('/v1/garments/:id', auth, asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  if (!id) return fail(response, 404, 'NOT_FOUND', 'Garment not found.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const files = await client.query<{ object_key: string }>('SELECT gi.object_key FROM garment_images gi JOIN garments g ON g.id=gi.garment_id WHERE g.id=$1 AND g.user_id=$2 FOR UPDATE OF gi', [id, userId(response)]);
    const deleted = await client.query('DELETE FROM garments WHERE id=$1 AND user_id=$2 RETURNING id', [id, userId(response)]);
    if (!deleted.rowCount) { await client.query('ROLLBACK'); return fail(response, 404, 'NOT_FOUND', 'Garment not found.'); }
    for (const file of files.rows) await client.query('INSERT INTO object_deletion_queue(object_key) VALUES($1) ON CONFLICT DO NOTHING', [file.object_key]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
  await processObjectDeletionQueue();
  return response.status(204).end();
}));

// Local private storage is for development only. Production must replace this adapter with a managed private object store.
app.post('/v1/garments/:id/image', auth, uploadLimiter, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: maxUploadBytes }), asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  if (!id) return fail(response, 404, 'NOT_FOUND', 'Garment not found.');
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) return fail(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Choose a JPEG, PNG, or WebP image.');
  const owned = await pool.query('SELECT id FROM garments WHERE id=$1 AND user_id=$2', [id, userId(response)]);
  if (!owned.rowCount) return fail(response, 404, 'NOT_FOUND', 'Garment not found.');
  const detected = await fileTypeFromBuffer(request.body);
  if (!detected || !['image/jpeg', 'image/png', 'image/webp'].includes(detected.mime) || request.body.length > maxUploadBytes) return fail(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'That file is not a supported image.');
  const objectKey = `${randomUUID()}.${detected.ext}`;
  await mkdir(uploadRoot, { recursive: true });
  const filePath = path.join(uploadRoot, objectKey);
  await writeFile(filePath, request.body, { flag: 'wx', mode: 0o600 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ object_key: string }>('SELECT object_key FROM garment_images WHERE garment_id=$1 AND user_id=$2 FOR UPDATE', [id, userId(response)]);
    for (const row of existing.rows) await client.query('INSERT INTO object_deletion_queue(object_key) VALUES($1) ON CONFLICT DO NOTHING', [row.object_key]);
    await client.query('DELETE FROM garment_images WHERE garment_id=$1 AND user_id=$2', [id, userId(response)]);
    await client.query('INSERT INTO garment_images(user_id,garment_id,object_key,mime_type,byte_size) VALUES($1,$2,$3,$4,$5)', [userId(response), id, objectKey, detected.mime, request.body.length]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    await unlink(filePath).catch(() => undefined);
    throw error;
  } finally { client.release(); }
  await processObjectDeletionQueue();
  return response.status(201).json({ data: { garmentId: id, hasImage: true } });
}));

app.get('/v1/garments/:id/image', auth, asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  if (!id) return fail(response, 404, 'NOT_FOUND', 'Image not found.');
  const result = await pool.query<{ object_key: string; mime_type: string }>(
    'SELECT gi.object_key,gi.mime_type FROM garment_images gi JOIN garments g ON g.id=gi.garment_id WHERE gi.garment_id=$1 AND gi.user_id=$2 AND g.user_id=$2', [id, userId(response)]);
  const image = result.rows[0];
  if (!image || !/^[a-f0-9-]+\.(jpg|png|webp)$/.test(image.object_key)) return fail(response, 404, 'NOT_FOUND', 'Image not found.');
  response.setHeader('Cache-Control', 'private, no-store');
  response.type(image.mime_type);
  return response.sendFile(path.join(uploadRoot, image.object_key), (error) => { if (error && !response.headersSent) fail(response, 404, 'NOT_FOUND', 'Image not found.'); });
}));

// The client must obtain explicit, per-image consent before it sends a photograph to an AI provider.
app.post('/v1/ai/garment-recognition', auth, recognitionLimiter, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: maxUploadBytes }), asyncRoute(async (request, response) => {
  if (request.header('x-drapeai-ai-consent') !== 'true') return fail(response, 422, 'AI_CONSENT_REQUIRED', 'Confirm that this photo may be sent to the AI service first.');
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) return fail(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Choose a JPEG, PNG, or WebP image.');
  const detected = await fileTypeFromBuffer(request.body);
  if (!detected || !['image/jpeg', 'image/png', 'image/webp'].includes(detected.mime) || request.body.length > maxUploadBytes) return fail(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'That file is not a supported image.');
  const recognition = await recognizeGarment(request.body, detected.mime);
  return response.json({ data: { ...recognition, provider: 'openrouter', requiresUserReview: true } });
}));

app.post('/v1/outfit-recommendations', auth, asyncRoute(async (request, response) => {
  const input = z.object({ prompt: z.string().trim().max(240).default(''), occasion: z.string().trim().max(80).default('Everyday'), excludeGarmentIds: z.array(z.string().uuid()).max(40).default([]) }).safeParse(request.body);
  if (!input.success) return fail(response, 422, 'VALIDATION_ERROR', 'Check the outfit request and try again.');
  const result = await pool.query<GarmentRow>(
    `SELECT id,name,category,color,occasion,availability,favorite,archived,created_at,false AS has_image FROM garments
     WHERE user_id=$1 AND archived=false AND availability='Clean' AND NOT (id = ANY($2::uuid[])) ORDER BY created_at DESC LIMIT 150`,
    [userId(response), input.data.excludeGarmentIds]);
  const candidates = result.rows.map(serializeGarment);
  const context = `${input.data.occasion} ${input.data.prompt}`.toLowerCase();
  const preferred = candidates.filter((item) => item.occasion.toLowerCase().split(',').some((tag) => context.includes(tag.trim())));
  const poolItems = preferred.length >= 2 ? preferred : candidates;
  const combinations: Array<{ ids: string[]; roles: string[] }> = [];
  const dresses = poolItems.filter((item) => item.category === 'Dresses');
  const tops = poolItems.filter((item) => item.category === 'Tops');
  const bottoms = poolItems.filter((item) => item.category === 'Bottoms');
  const shoes = poolItems.filter((item) => item.category === 'Shoes');
  for (const dress of dresses) for (const shoe of shoes) combinations.push({ ids: [dress.id, shoe.id], roles: ['dress', 'shoes'] });
  for (const top of tops) for (const bottom of bottoms) {
    const shoe = shoes.find((candidate) => !combinations.some((combination) => combination.ids.includes(candidate.id)));
    combinations.push(shoe ? { ids: [top.id, bottom.id, shoe.id], roles: ['top', 'bottom', 'shoes'] } : { ids: [top.id, bottom.id], roles: ['top', 'bottom'] });
  }
  const recommendations = combinations.slice(0, 3).map((combination) => {
    const selected = combination.ids.map((id) => candidates.find((candidate) => candidate.id === id)!).filter(Boolean);
    return { items: combination.ids.map((garmentId, position) => ({ garmentId, role: combination.roles[position]! })), explanation: `${selected.map((item) => item.name).join(' + ')}. These garments are in your wardrobe and marked clean.`, limitations: ['This is a category-based preview. It does not verify dress-code fit or use weather.'] };
  });
  return response.json({ data: { recommendations, mode: 'wardrobe-match-fallback', candidateCount: candidates.length } });
}));

app.get('/v1/outfits', auth, asyncRoute(async (_request, response) => {
  const result = await pool.query<{ id: string; title: string; occasion: string; explanation: string; created_at: string; garment_ids: string[] }>(
    `SELECT o.id,o.title,o.occasion,o.explanation,o.created_at,COALESCE(array_agg(oi.garment_id ORDER BY oi.position) FILTER(WHERE oi.garment_id IS NOT NULL),'{}') AS garment_ids
     FROM outfits o LEFT JOIN outfit_items oi ON oi.outfit_id=o.id AND oi.user_id=o.user_id WHERE o.user_id=$1
     GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100`, [userId(response)]);
  return response.json({ data: result.rows.map((row) => ({ id: row.id, title: row.title, occasion: row.occasion, explanation: row.explanation, garmentIds: row.garment_ids, createdAt: row.created_at })) });
}));

app.delete('/v1/outfits/:id', auth, asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  if (!id) return fail(response, 404, 'NOT_FOUND', 'Saved look not found.');
  const result = await pool.query('DELETE FROM outfits WHERE id=$1 AND user_id=$2', [id, userId(response)]);
  if (!result.rowCount) return fail(response, 404, 'NOT_FOUND', 'Saved look not found.');
  return response.status(204).end();
}));

app.post('/v1/outfits', auth, asyncRoute(async (request, response) => {
  const parsed = z.object({ title: z.string().trim().min(1).max(80), occasion: z.string().trim().min(1).max(80), explanation: z.string().trim().min(1).max(500), garmentIds: z.array(z.string().uuid()).min(2).max(10) }).safeParse(request.body);
  if (!parsed.success || (parsed.success && new Set(parsed.data.garmentIds).size !== parsed.data.garmentIds.length)) return fail(response, 422, 'VALIDATION_ERROR', 'Choose a valid outfit with distinct garments.');
  const input = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eligible = await client.query<{ id: string }>("SELECT id FROM garments WHERE user_id=$1 AND id=ANY($2::uuid[]) AND archived=false AND availability='Clean' FOR SHARE", [userId(response), input.garmentIds]);
    if (eligible.rowCount !== input.garmentIds.length) { await client.query('ROLLBACK'); return fail(response, 422, 'INELIGIBLE_GARMENT', 'Every saved item must be in your active wardrobe and marked clean.'); }
    const saved = await client.query<{ id: string; created_at: string }>('INSERT INTO outfits(user_id,title,occasion,explanation) VALUES($1,$2,$3,$4) RETURNING id,created_at', [userId(response), input.title, input.occasion, input.explanation]);
    for (const [position, garmentId] of input.garmentIds.entries()) {
      const garment = eligible.rows.find((row) => row.id === garmentId);
      const detail = await client.query<{ name: string; category: string; color: string; occasion: string }>('SELECT name,category,color,occasion FROM garments WHERE id=$1 AND user_id=$2', [garmentId, userId(response)]);
      if (!garment || !detail.rows[0]) throw new Error('Eligible garment disappeared while saving outfit.');
      await client.query('INSERT INTO outfit_items(outfit_id,garment_id,garment_snapshot,user_id,position) VALUES($1,$2,$3,$4,$5)', [saved.rows[0]!.id, garmentId, JSON.stringify(detail.rows[0]), userId(response), position]);
    }
    await client.query('COMMIT');
    return response.status(201).json({ data: { id: saved.rows[0]!.id, ...input, createdAt: saved.rows[0]!.created_at } });
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
}));

app.get('/v1/trips', auth, asyncRoute(async (_request, response) => {
  const result = await pool.query<{ id: string; destination: string; start_date: string; end_date: string; notes: string; garment_ids: string[] }>(
    `SELECT t.id,t.destination,t.start_date,t.end_date,t.notes,COALESCE(array_agg(ti.garment_id) FILTER(WHERE ti.garment_id IS NOT NULL),'{}') AS garment_ids
     FROM trips t LEFT JOIN trip_items ti ON ti.trip_id=t.id AND ti.user_id=t.user_id WHERE t.user_id=$1 GROUP BY t.id ORDER BY t.start_date`, [userId(response)]);
  return response.json({ data: result.rows.map((row) => ({ id: row.id, destination: row.destination, startDate: row.start_date, endDate: row.end_date, notes: row.notes, garmentIds: row.garment_ids })) });
}));

app.post('/v1/trips', auth, asyncRoute(async (request, response) => {
  const parsed = z.object({ destination: z.string().trim().min(1).max(100), startDate: z.iso.date(), endDate: z.iso.date(), notes: z.string().trim().max(180).default('') }).safeParse(request.body);
  if (!parsed.success || (parsed.success && parsed.data.endDate < parsed.data.startDate)) return fail(response, 422, 'VALIDATION_ERROR', 'Check the trip destination and dates.');
  const trip = parsed.data;
  const result = await pool.query<{ id: string }>('INSERT INTO trips(user_id,destination,start_date,end_date,notes) VALUES($1,$2,$3,$4,$5) RETURNING id', [userId(response), trip.destination, trip.startDate, trip.endDate, trip.notes]);
  return response.status(201).json({ data: { id: result.rows[0]!.id, ...trip, garmentIds: [] } });
}));

app.patch('/v1/trips/:id', auth, asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  const parsed = z.object({ destination: z.string().trim().min(1).max(100).optional(), startDate: z.iso.date().optional(), endDate: z.iso.date().optional(), notes: z.string().trim().max(180).optional() }).strict().safeParse(request.body);
  if (!id || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) return fail(response, 422, 'VALIDATION_ERROR', 'Check the trip details.');
  const current = await pool.query<{ start_date: string; end_date: string }>('SELECT start_date,end_date FROM trips WHERE id=$1 AND user_id=$2', [id, userId(response)]);
  if (!current.rows[0]) return fail(response, 404, 'NOT_FOUND', 'Trip not found.');
  const startDate = parsed.data.startDate ?? dateOnly(current.rows[0].start_date);
  const endDate = parsed.data.endDate ?? dateOnly(current.rows[0].end_date);
  if (endDate < startDate) return fail(response, 422, 'VALIDATION_ERROR', 'Return date must not be before the departure date.');
  const input = parsed.data;
  const values: unknown[] = [id, userId(response)];
  const updates: string[] = [];
  for (const [key, value] of Object.entries(input)) { values.push(value); updates.push(`${key === 'startDate' ? 'start_date' : key === 'endDate' ? 'end_date' : key}=$${values.length}`); }
  const result = await pool.query('UPDATE trips SET ' + updates.join(',') + ' WHERE id=$1 AND user_id=$2 RETURNING id', values);
  if (!result.rowCount) return fail(response, 404, 'NOT_FOUND', 'Trip not found.');
  return response.json({ data: { id, ...input, startDate, endDate } });
}));

app.put('/v1/trips/:id/items', auth, asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  const parsed = z.object({ garmentIds: z.array(z.uuid()).max(40) }).safeParse(request.body);
  if (!id || !parsed.success || new Set(parsed.data.garmentIds).size !== parsed.data.garmentIds.length) return fail(response, 422, 'VALIDATION_ERROR', 'Choose distinct wardrobe items.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trip = await client.query('SELECT id FROM trips WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId(response)]);
    if (!trip.rowCount) { await client.query('ROLLBACK'); return fail(response, 404, 'NOT_FOUND', 'Trip not found.'); }
    if (parsed.data.garmentIds.length) {
      const eligible = await client.query("SELECT id FROM garments WHERE user_id=$1 AND id=ANY($2::uuid[]) AND archived=false AND availability='Clean' FOR SHARE", [userId(response), parsed.data.garmentIds]);
      if (eligible.rowCount !== parsed.data.garmentIds.length) { await client.query('ROLLBACK'); return fail(response, 422, 'INELIGIBLE_GARMENT', 'Packing lists can only contain active pieces marked clean.'); }
    }
    await client.query('DELETE FROM trip_items WHERE trip_id=$1 AND user_id=$2', [id, userId(response)]);
    for (const garmentId of parsed.data.garmentIds) await client.query('INSERT INTO trip_items(trip_id,garment_id,user_id) VALUES($1,$2,$3)', [id, garmentId, userId(response)]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
  return response.json({ data: { tripId: id, garmentIds: parsed.data.garmentIds } });
}));

app.delete('/v1/trips/:id', auth, asyncRoute(async (request, response) => {
  const id = uuidParam(request.params.id);
  if (!id) return fail(response, 404, 'NOT_FOUND', 'Trip not found.');
  const result = await pool.query('DELETE FROM trips WHERE id=$1 AND user_id=$2', [id, userId(response)]);
  if (!result.rowCount) return fail(response, 404, 'NOT_FOUND', 'Trip not found.');
  return response.status(204).end();
}));

app.use((_request, response) => fail(response, 404, 'NOT_FOUND', 'This endpoint was not found.'));
const errorHandler: ErrorRequestHandler = (error: unknown, _request: Request, response: Response, _next) => {
  if (response.headersSent) return;
  if (error instanceof GarmentRecognitionError) return fail(response, error.status, error.code, error.message);
  if (isPgCode(error, '23505')) return fail(response, 409, 'CONFLICT', 'That information already exists.');
  if (isPgCode(error, '23503')) return fail(response, 409, 'CONFLICT', 'This item is still referenced by another record.');
  if (isPgCode(error, '23514')) return fail(response, 422, 'VALIDATION_ERROR', 'One or more values are not allowed.');
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0;
  if (status === 413) return fail(response, 413, 'PAYLOAD_TOO_LARGE', 'Choose an image smaller than the upload limit.');
  const internalCode = isPgCode(error, String((error as { code?: unknown } | null)?.code ?? '')) && /^[A-Z0-9_]+$/.test(String(error.code)) ? String(error.code) : 'INTERNAL_ERROR';
  console.error(JSON.stringify({ level: 'error', requestId: response.locals.requestId, code: internalCode }));
  return fail(response, 500, 'INTERNAL_ERROR', 'Something went wrong. Try again.');
};
app.use(errorHandler);

async function issueSession(response: Response, userIdValue: string, email: string, status: 200 | 201) {
  const accessToken = await createAccessToken(userIdValue);
  const refreshToken = createRefreshToken();
  await pool.query('INSERT INTO sessions(user_id,refresh_hash,expires_at) VALUES($1,$2,now()+interval \'30 days\')', [userIdValue, hashRefreshToken(refreshToken)]);
  return response.status(status).json({ data: { accessToken, refreshToken, user: { id: userIdValue, email } } });
}

async function processObjectDeletionQueue() {
  const pending = await pool.query<{ object_key: string }>('SELECT object_key FROM object_deletion_queue ORDER BY queued_at LIMIT 50');
  for (const entry of pending.rows) {
    try {
      if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(entry.object_key)) throw new Error('Invalid private object key');
      await unlink(path.join(uploadRoot, entry.object_key)).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
      await pool.query('DELETE FROM object_deletion_queue WHERE object_key=$1', [entry.object_key]);
    } catch (error) {
      await pool.query('UPDATE object_deletion_queue SET attempt_count=attempt_count+1,last_error=$2 WHERE object_key=$1', [entry.object_key, error instanceof Error ? error.message.slice(0, 250) : 'Unknown storage error']);
    }
  }
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<unknown>) {
  return (request: Request, response: Response, next: (error?: unknown) => void) => { Promise.resolve(handler(request, response)).catch(next); };
}

function fail(response: Response, status: number, code: string, message: string, details?: Array<{ field: string; code: string }>) {
  return response.status(status).json({ error: { code, message, requestId: response.locals.requestId, ...(details ? { details } : {}) } });
}

function userId(response: Response) { return response.locals.userId as string; }
function uuidParam(value: string | string[] | undefined) {
  if (typeof value !== 'string') return undefined;
  return z.uuid().safeParse(value).success ? value : undefined;
}
function dateOnly(value: string | Date) { return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10); }
function isPgCode(error: unknown, code: string): error is { code: string } { return typeof error === 'object' && error !== null && 'code' in error && error.code === code; }
function escapeLike(value: string) { return value.replace(/[\\%_]/g, '\\$&'); }

type GarmentRow = { id: string; name: string; category: typeof categories[number]; color: string; occasion: string; availability: typeof availabilities[number]; favorite: boolean; archived: boolean; created_at: string; has_image: boolean };
function serializeGarment(row: GarmentRow) {
  return { id: row.id, name: row.name, category: row.category, color: row.color, occasion: row.occasion, availability: row.availability, favorite: row.favorite, archived: row.archived, hasImage: row.has_image, createdAt: row.created_at };
}

async function start() {
  await mkdir(uploadRoot, { recursive: true });
  await pool.query('SELECT 1');
  await processObjectDeletionQueue().catch(() => console.error(JSON.stringify({ level: 'error', event: 'object_cleanup_failed' })));
  const cleanupTimer = setInterval(() => {
    processObjectDeletionQueue().catch(() => console.error(JSON.stringify({ level: 'error', event: 'object_cleanup_failed' })));
  }, 60_000);
  cleanupTimer.unref();
  app.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ level: 'info', event: 'api_listening', port, nodeEnv: process.env.NODE_ENV ?? 'development' })));
}

start().catch((error: unknown) => {
  console.error(JSON.stringify({ level: 'error', event: 'api_start_failed', code: isPgCode(error, String((error as { code?: unknown } | null)?.code ?? '')) ? String((error as { code: string }).code) : 'CONFIGURATION_OR_DATABASE_ERROR' }));
  process.exitCode = 1;
});
