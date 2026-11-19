import { z } from 'zod';

const categories = ['Tops', 'Bottoms', 'Dresses', 'Shoes', 'Outerwear', 'Accessories'] as const;

const recognitionSchema = z.object({
  isGarment: z.boolean(),
  confidence: z.number().min(0).max(1),
  name: z.string().trim().max(48).nullable(),
  category: z.enum(categories).nullable(),
  colorName: z.string().trim().max(32).nullable(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  pattern: z.string().trim().max(32).nullable(),
  season: z.array(z.enum(['Spring', 'Summer', 'Autumn', 'Winter', 'All-season'])).max(5),
  formality: z.enum(['Casual', 'Smart casual', 'Formal', 'Sport']).nullable(),
  occasion: z.array(z.string().trim().min(1).max(32)).max(5),
}).strict();

export type GarmentRecognition = z.infer<typeof recognitionSchema>;

export class GarmentRecognitionError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'GarmentRecognitionError';
  }
}

const instructions = `You classify one photographed clothing item for a personal wardrobe.
Return exactly one JSON object, without markdown or prose, with these fields:
isGarment (boolean), confidence (number 0 to 1), name (string or null), category (one of Tops, Bottoms, Dresses, Shoes, Outerwear, Accessories or null), colorName (string or null), colorHex (six-digit CSS hex string or null), pattern (string or null), season (array containing only Spring, Summer, Autumn, Winter, All-season), formality (Casual, Smart casual, Formal, Sport, or null), occasion (array of short strings).
Do not identify people, infer age, gender, ethnicity, body shape, brand, price, or location.
If a single garment is not clearly visible, set isGarment to false and every nullable suggestion to null; season and occasion must be empty arrays.
When uncertain, use null rather than guessing. Name should be a short generic label, such as "Black crew-neck T-shirt". ColorHex is allowed only when the dominant garment color is clear.`;

export async function recognizeGarment(image: Buffer, mimeType: string): Promise<GarmentRecognition> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new GarmentRecognitionError(503, 'AI_NOT_CONFIGURED', 'Garment recognition is not configured yet.');

  const model = process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let providerResponse: globalThis.Response;
  try {
    providerResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'x-title': 'DrapeAI',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 450,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: [
            { type: 'text', text: 'Classify this clothing photograph.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image.toString('base64')}` } },
          ] },
        ],
      }),
    });
  } catch {
    throw new GarmentRecognitionError(503, 'AI_UNAVAILABLE', 'Garment recognition is temporarily unavailable. Try again later.');
  } finally {
    clearTimeout(timeout);
  }

  if (!providerResponse.ok) {
    if (providerResponse.status === 401 || providerResponse.status === 403) throw new GarmentRecognitionError(503, 'AI_CONFIGURATION_ERROR', 'Garment recognition is temporarily unavailable.');
    if (providerResponse.status === 429) throw new GarmentRecognitionError(429, 'AI_RATE_LIMITED', 'The recognition limit has been reached. Try again later.');
    throw new GarmentRecognitionError(503, 'AI_UNAVAILABLE', 'Garment recognition is temporarily unavailable. Try again later.');
  }

  let payload: unknown;
  try { payload = await providerResponse.json(); } catch { throw new GarmentRecognitionError(502, 'AI_INVALID_RESPONSE', 'Garment recognition returned an invalid response.'); }
  const text = extractText(payload);
  if (!text) throw new GarmentRecognitionError(502, 'AI_INVALID_RESPONSE', 'Garment recognition did not return a result.');
  let parsedJson: unknown;
  try { parsedJson = JSON.parse(text); } catch { throw new GarmentRecognitionError(502, 'AI_INVALID_RESPONSE', 'Garment recognition returned an invalid result.'); }
  const parsed = recognitionSchema.safeParse(parsedJson);
  if (!parsed.success) throw new GarmentRecognitionError(502, 'AI_INVALID_RESPONSE', 'Garment recognition returned an invalid result.');
  return parsed.data;
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  return null;
}
