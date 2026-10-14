import { createHash } from 'node:crypto';
import type { Settings } from '../src/lib/types.js';
import { aiUsed, countAi, getCache, putCache } from './store.js';

/**
 * 🎨 An AI picture of the exact dish (Gemini's image model, GEMINI_API_KEY; about 4 cents a picture). Made once per
 * dish: the app shrinks it to JPEG on the phone and sends it back to be kept (ct:photo:draw-<key>-t / -f, ~10 years).
 * Daily limit: Settings → Cooking → AI pictures a day (ct:ai:<day>:image).
 */
export const drawKey = (title: string, summary: string) => createHash('sha256').update(`${title}\n${summary}`.toLowerCase()).digest('hex').slice(0, 24);

export async function drawDish(d: { title: string; summary: string; ingredients: string[] }, s: Settings): Promise<{ key: string; done?: boolean; image?: string }> {
  const key = drawKey(d.title, d.summary);
  if (await getCache<true>(`draw:${key}`)) return { key, done: true };
  if (!process.env.GEMINI_API_KEY?.trim()) throw new Error('AI pictures need GEMINI_API_KEY in Vercel');
  const limit = s.cooking.aiPicsPerDay;
  if ((await aiUsed('image')) >= limit) throw new Error(`Today’s AI pictures are used up (${limit}, Settings → Cooking)`);
  await countAi('image');
  const prompt = `A realistic, appetizing food photograph of "${d.title}" as home-cooked and served: ${d.summary} Main ingredients: ${d.ingredients.slice(0, 10).join(', ')}. Shot from a 45-degree angle on a simple plate or bowl, natural daylight, shallow depth of field, a clean kitchen table. No text, no labels, no hands, no people.`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.cooking.imageModel || 'gemini-2.5-flash-image')}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY!.trim() },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '4:3' } } }),
    signal: AbortSignal.timeout(90_000),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: { message?: string }; candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }[] } }[] };
  if (!res.ok) throw new Error(res.status === 429 ? 'Gemini’s picture allowance is used up for now' : `Gemini picture: ${(j.error?.message ?? `HTTP ${res.status}`).slice(0, 140)}`);
  const part = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.inlineData ?? (p.inline_data ? { mimeType: p.inline_data.mime_type, data: p.inline_data.data } : undefined)).find((x) => x?.data);
  if (!part?.data) throw new Error('Gemini didn’t make a picture this time');
  return { key, image: `data:${part.mimeType || 'image/png'};base64,${part.data}` };
}

/** The shrunk picture is kept, and the dish is marked as drawn (so it's never paid for twice). */
export async function keepDrawing(key: string, putPhoto: (id: string, dataUrl: string, days: number) => Promise<void>, thumb: string, full: string) {
  await putPhoto(`draw-${key}-t`, thumb, 3650);
  await putPhoto(`draw-${key}-f`, full, 3650);
  await putCache(`draw:${key}`, true, 3650);
}
