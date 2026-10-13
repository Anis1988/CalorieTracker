import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Analysis, Food, Provider, Settings } from '../src/lib/types.js';
import { modelName } from '../src/lib/types.js';
import { aiUsed, countAi, getCache, putCache } from './store.js';

/**
 * 📸 A food photo (or a few words) → each food and drink with its portion and nutrition.
 * Free Gemini first (or the AI picked in Settings); the other one takes over when the first is over its daily limit,
 * not set up or fails (Settings → AI → "Use the other AI as a backup"). The same photo/words are never paid twice.
 */

const Item = z.object({
  name: z.string().describe('Short everyday name, e.g. "Grilled chicken breast"'),
  portion: z.string().describe('The portion in everyday words, e.g. "1 medium breast", "1 cup", "2 slices"'),
  grams: z.number().describe('Estimated weight in grams (ml for drinks)'),
  calories: z.number(),
  protein: z.number().describe('grams'),
  carbs: z.number().describe('grams'),
  fat: z.number().describe('grams'),
  fiber: z.number().describe('grams'),
  sugar: z.number().describe('grams'),
  confidence: z.number().describe('0-100: how sure you are of this item and its portion'),
});
const Answer = z.object({
  title: z.string().describe('A short name for the whole meal, e.g. "Chicken Caesar salad"'),
  items: z.array(Item),
  healthScore: z.number().describe('1-10, how balanced and nourishing the meal is (10 = excellent). 0 if no food.'),
  notes: z.string().describe('One or two short sentences: what you assumed (hidden oil, dressing, portion) or why nothing was found'),
  tips: z.array(z.string()).describe('0-2 short, friendly, practical tips about this meal for the person\'s goal'),
});
type AiAnswer = z.infer<typeof Answer>;

const SYSTEM = `You are a careful nutritionist who estimates calories and nutrients from meal photos and descriptions.
- List every distinct food and drink you can see (or that is described) as its own item. Include things people forget: cooking oil or butter, sauces, dressings, toppings, cheese, sugar in drinks, bread on the side.
- Estimate each portion from visual cues: plate size (a dinner plate is about 26 cm), cutlery, hands, packaging, how deep the food is. Give grams (ml for drinks) and an everyday portion.
- Use standard nutrition values (USDA style) for the portion you estimated. Be realistic, not optimistic: restaurant and home-cooked food usually has more fat than plain ingredients.
- Nutrition numbers are for the item's whole portion. Calories should roughly match 4×protein + 4×carbs + 9×fat.
- If the person adds a note (e.g. "no dressing", "half of it", "2 servings"), follow it exactly.
- A packaged product with a visible label: use the label.
- If there is no food or drink at all, return no items and say so in notes.
- Plain, friendly words. Never give medical advice.`;

export interface AnalyzeInput { image?: { mime: string; data: string }; text?: string; note?: string; goal?: string; model?: Provider }

const promptOf = (i: AnalyzeInput, s: Settings) => [
  i.image ? 'Here is a photo of what I’m eating or drinking.' : `What I ate or drank: ${i.text}`,
  i.note ? `My note about it: ${i.note}` : '',
  s.ai.tips ? `My goal: ${s.profile.goal === 'lose' ? 'lose weight' : s.profile.goal === 'gain' ? 'gain weight / build muscle' : 'stay at my weight'}.` : 'No tips needed (leave tips empty).',
].filter(Boolean).join('\n');

/** The answer, made safe: numbers rounded, nothing negative, calories filled in from the macros if missing. */
function clean(a: AiAnswer): Omit<Analysis, 'by'> {
  const n = (v: unknown, d = 1) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? Math.round(x * 10 ** d) / 10 ** d : 0; };
  const items: Food[] = (a.items ?? []).filter((f) => f && f.name).map((f) => {
    const protein = n(f.protein), carbs = n(f.carbs), fat = n(f.fat);
    const calories = Math.round(n(f.calories, 0) || protein * 4 + carbs * 4 + fat * 9);
    return { name: String(f.name).slice(0, 80), portion: String(f.portion ?? '').slice(0, 60), grams: Math.round(n(f.grams, 0)), calories, protein, carbs, fat, fiber: n(f.fiber), sugar: n(f.sugar), confidence: Math.min(100, Math.round(n(f.confidence, 0))) };
  });
  return { title: String(a.title || items[0]?.name || 'Meal').slice(0, 80), items, healthScore: Math.min(10, Math.round(n(a.healthScore, 0))), notes: String(a.notes ?? '').slice(0, 400), tips: (a.tips ?? []).map(String).filter(Boolean).slice(0, 2) };
}

/** Loose reading of an AI's JSON (Gemini sometimes leaves fields out). */
function loose(raw: unknown): AiAnswer {
  const ok = Answer.safeParse(raw);
  if (ok.success) return ok.data;
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    title: String(o.title ?? ''),
    items: arr(o.items).map((x) => ({ ...(x as object) }) as AiAnswer['items'][number]),
    healthScore: Number(o.healthScore) || 0,
    notes: String(o.notes ?? ''),
    tips: arr(o.tips).map(String),
  };
}

// ---------- the shared AI plumbing (food and beauty) ----------
const FLASH = 'gemini-flash-latest';
class AiError extends Error { constructor(message: string, public status = 0) { super(message); } }
type Img = { mime: string; data: string };
interface Ask<T extends z.ZodTypeAny> { schema: T; system: string; prompt: string; images: Img[] }

async function gemini<T extends z.ZodTypeAny>(q: Ask<T>, s: Settings, model = s.ai.geminiModel): Promise<{ raw: unknown; model: string }> {
  const parts: Record<string, unknown>[] = q.images.map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } }));
  parts.push({ text: q.prompt });
  const schema = z.toJSONSchema(q.schema) as Record<string, unknown>;
  delete schema.$schema;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY!.trim() },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: `${q.system}\n\nAnswer with JSON only.` }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 6000, responseMimeType: 'application/json', responseJsonSchema: schema },
    }),
    signal: AbortSignal.timeout(70_000),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
  if (!res.ok) {
    // Pro's free allowance is small: Flash takes over.
    if (model !== FLASH && /pro/i.test(model) && [429, 403, 404].includes(res.status)) return gemini(q, s, FLASH);
    throw new AiError(res.status === 429 ? 'Gemini’s free allowance is used up for now' : `Gemini: ${(j.error?.message ?? `HTTP ${res.status}`).slice(0, 140)}`, res.status);
  }
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) throw new AiError(`Gemini gave no answer (${j.candidates?.[0]?.finishReason ?? 'empty'})`);
  try {
    return { raw: JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')), model };
  } catch {
    throw new AiError('Gemini’s answer could not be read');
  }
}

async function claude<T extends z.ZodTypeAny>(q: Ask<T>, s: Settings): Promise<{ raw: unknown; model: string }> {
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = q.images.map((im) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: im.mime as 'image/jpeg', data: im.data } }));
  content.push({ type: 'text', text: q.prompt });
  const client = new Anthropic({ timeout: 90_000, maxRetries: 2 });
  const res = await client.beta.messages.parse({
    model: s.ai.claudeModel,
    max_tokens: 6000,
    system: q.system,
    messages: [{ role: 'user', content }],
    // Low effort (the default): a short, focused answer keeps each read cheap. Haiku models get no effort setting.
    output_config: /haiku/i.test(s.ai.claudeModel) ? { format: betaZodOutputFormat(q.schema) } : { effort: s.ai.effort, format: betaZodOutputFormat(q.schema) },
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new AiError(`Claude gave no usable answer (${res.stop_reason})`);
  return { raw: res.parsed_output, model: s.ai.claudeModel };
}

const ready = (p: Provider) => (p === 'gemini' ? !!process.env.GEMINI_API_KEY?.trim() : !!process.env.ANTHROPIC_API_KEY?.trim());
const limitOf = (p: Provider, s: Settings) => (p === 'gemini' ? s.ai.geminiDailyLimit : s.ai.claudeUnlimited ? Infinity : s.ai.claudeDailyLimit);
const label = (p: Provider) => (p === 'gemini' ? 'Gemini' : 'Claude');

/**
 * Ask the AI picked in Settings (free Gemini first by default); the other one takes over when the first is over its
 * daily limit, isn't set up or fails. The answer is remembered (same question = free). `keep` decides what's worth
 * remembering (not empty answers).
 */
export async function ask<T extends z.ZodTypeAny, R>(q: Ask<T> & { cacheKey: unknown; model?: Provider }, s: Settings, make: (raw: unknown) => R, keep: (r: R) => boolean): Promise<R & { by: string; cached?: boolean; note?: string }> {
  type Out = R & { by: string; cached?: boolean; note?: string };
  const key = createHash('sha256').update(JSON.stringify(q.cacheKey)).digest('hex').slice(0, 40);
  const hit = await getCache<Out>(key);
  if (hit && !q.model) return { ...hit, cached: true };
  const first = q.model ?? s.ai.provider;
  const order: Provider[] = q.model || !s.ai.fallback ? [first] : [first, first === 'gemini' ? 'claude' : 'gemini'];
  const why: string[] = [];
  for (const p of order) {
    if (!ready(p)) { why.push(`${label(p)} isn’t set up (${p === 'gemini' ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY'} in Vercel)`); continue; }
    if ((await aiUsed(p)) >= limitOf(p, s)) { why.push(`${label(p)} is at today’s limit (${limitOf(p, s)}, Settings → AI)`); continue; }
    try {
      await countAi(p);
      const { raw, model } = p === 'gemini' ? await gemini(q, s) : await claude(q, s);
      const out = { ...make(raw), by: modelName(p, model), ...(why.length ? { note: `${why.join('; ')}, so ${label(p)} did it.` } : {}) } as Out;
      if (keep(out)) await putCache(key, out, s.ai.rememberDays);
      return out;
    } catch (e) {
      why.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new AiError(why.join('. ') || 'No AI is set up.');
}

// ---------- 📸 food ----------
export async function analyze(i: AnalyzeInput, s: Settings): Promise<Analysis> {
  return ask({ schema: Answer, system: SYSTEM, prompt: promptOf(i, s), images: i.image ? [i.image] : [], model: i.model,
    cacheKey: [i.image?.data ?? '', (i.text ?? '').trim().toLowerCase(), (i.note ?? '').trim().toLowerCase(), s.ai.tips] },
  s, (raw) => clean(loose(raw)), (r) => r.items.length > 0);
}
