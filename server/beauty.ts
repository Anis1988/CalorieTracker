import { z } from 'zod';
import type { BeautyCheck, Provider, Settings, Verdict } from '../src/lib/types.js';
import { avoidHits } from '../src/lib/avoid.js';
import { ask } from './ai.js';

/**
 * 💄 A beauty product (photos of the front and/or the ingredient list) → is it good for YOUR skin?
 * Same AI rules as food (free Gemini first, Claude backup, daily limits, answers remembered).
 * Your "avoid" list is checked with plain text matching on the ingredients (no AI): a match always means
 * "Not for you", whatever the AI thinks.
 */
const Answer = z.object({
  brand: z.string(),
  product: z.string().describe('Product name, e.g. "Hydro Boost Water Gel"'),
  category: z.string().describe('One of: Cleanser, Toner, Serum, Moisturizer, Sunscreen, Eye cream, Mask, Exfoliant, Oil, Primer, Foundation, Concealer, Powder, Blush, Bronzer, Highlighter, Eyeshadow, Eyeliner, Mascara, Brow, Lipstick, Lip gloss, Lip balm, Makeup remover, Body, Hair, Other'),
  verdict: z.enum(['good', 'ok', 'avoid']).describe('good = a good match for this person; ok = fine but not ideal; avoid = likely not for them'),
  score: z.number().describe('1-10, how well it suits THIS person'),
  summary: z.string().describe('2-3 friendly sentences: is it for them and why'),
  good: z.array(z.object({ name: z.string(), why: z.string() })).describe('Up to 5 ingredients/features that help their skin, with a short why'),
  watch: z.array(z.object({ name: z.string(), why: z.string() })).describe('Up to 5 ingredients/features to be careful with for them, with a short why'),
  ingredients: z.array(z.string()).describe('The full ingredient list (INCI names) as read on the label, in order; or the usual list for this product if no label is visible'),
  ingredientsFrom: z.enum(['label', 'known', 'none']).describe('label = read from the photo; known = the usual formula from your knowledge; none = unknown'),
  howToUse: z.array(z.string()).describe('1-3 short tips for this person (when, how, what to pair it with)'),
  shade: z.string().describe('For face makeup only: shade advice for their tone/undertone (or what to look for). Else empty.'),
  pao: z.string().describe('Period after opening if visible on the jar symbol (e.g. "12M"), else empty'),
});

const SYSTEM = `You are a friendly, careful cosmetic chemist and makeup artist. You look at photos of a beauty product (front, back, ingredient list) and judge whether it suits ONE person, using their skin profile.
- Read the brand, product name and category from the photos. If an ingredient list is visible, copy it in order (ingredientsFrom = "label"). If not, give the usual formula for this exact product if you know it well (ingredientsFrom = "known"); otherwise leave it empty ("none") and say so in the summary.
- Judge for THIS person: skin type, sensitivity, concerns, ingredients to avoid, preferences. Name the specific ingredients that help or may bother them (e.g. ceramides and glycerin help dry skin; denatured alcohol and strong fragrance can bother dry or sensitive skin; heavy oils can clog pores on acne-prone skin).
- Anything from their avoid list (or a well-known name for it, like "parfum" for fragrance) means verdict "avoid".
- Pregnancy-safe asked: flag retinoids (retinol, retinal, tretinoin), high-dose salicylic acid and hydroquinone.
- For face makeup (foundation, concealer, powder, tinted products): give shade advice for their tone and undertone.
- Be honest and balanced, not alarmist. Plain words. This is guidance, not medical advice; suggest a patch test for sensitive skin.`;

const profileText = (s: Settings) => {
  const b = s.beauty;
  return [
    `Skin type: ${b.skinType}${b.sensitive ? ', sensitive' : ''}.`,
    b.concerns.length ? `Concerns: ${b.concerns.join(', ')}.` : '',
    b.avoid.length ? `Ingredients to avoid: ${b.avoid.join(', ')}.` : '',
    b.tone ? `Skin tone: ${b.tone}${b.undertone ? `, ${b.undertone} undertone` : ''}.` : '',
    [b.fragranceFree && 'prefers fragrance-free', b.vegan && 'wants vegan products', b.pregnancy && 'needs pregnancy-safe products'].filter(Boolean).join(', '),
  ].filter(Boolean).join('\n');
};

const VERDICT_RANK: Record<Verdict, number> = { avoid: 0, ok: 1, good: 2 };

/** A product found by its barcode on Open Beauty Facts (name + ingredient list, no photo needed). */
export interface KnownProduct { code: string; brand: string; name: string; category: string; ingredients: string[] }

export async function checkProduct(i: { images: { mime: string; data: string }[]; note?: string; model?: Provider; product?: KnownProduct }, s: Settings): Promise<Omit<BeautyCheck, 'id' | 'createdAt'>> {
  const k = i.product;
  const prompt = `My skin profile:\n${profileText(s)}${i.note ? `\nMy note: ${i.note}` : ''}\n${k
    ? `The product (from its barcode, on Open Beauty Facts): ${[k.brand, k.name].filter(Boolean).join(' ') || 'unknown name'}${k.category && k.category !== 'Other' ? ` (${k.category})` : ''}.\nIngredient list (INCI, as listed): ${k.ingredients.join(', ')}\nUse this ingredient list (ingredientsFrom = "label"). Is it good for me?`
    : `Here ${i.images.length > 1 ? 'are photos' : 'is a photo'} of the product. Is it good for me?`}`;
  const r = await ask({ schema: Answer, system: SYSTEM, prompt, images: i.images, model: i.model, cacheKey: ['beauty', k ? ['code', k.code, k.ingredients] : i.images.map((x) => x.data), i.note ?? '', s.beauty] },
    s, (raw) => clean(raw), (x) => !!(x.product || x.brand));
  if (k) Object.assign(r, { brand: r.brand || k.brand, product: r.product || k.name, ingredients: k.ingredients, ingredientsFrom: 'database', code: k.code });
  // The free check, after the AI: your avoid list against the ingredients. A match can't be turned into "good".
  const hits = avoidHits(s.beauty.avoid, r.ingredients);
  if (s.beauty.fragranceFree) for (const h of avoidHits(['Fragrance'], r.ingredients)) if (!hits.includes(h)) hits.push(h);
  if (!hits.length) return { ...r, avoidHits: [] };
  return { ...r, avoidHits: hits, verdict: 'avoid', score: Math.min(r.score, 3), summary: r.verdict === 'avoid' ? r.summary : `It has ${hits.join(', ')}, which is on your avoid list. ${r.summary}` };
}

function clean(raw: unknown): Omit<BeautyCheck, 'id' | 'createdAt' | 'by' | 'avoidHits'> {
  const ok = Answer.safeParse(raw);
  const o = (ok.success ? ok.data : (raw && typeof raw === 'object' ? raw : {})) as Partial<z.infer<typeof Answer>>;
  const str = (v: unknown, n = 300) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const pairs = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => ({ name: str((x as { name?: unknown })?.name, 60), why: str((x as { why?: unknown })?.why, 200) })).filter((x) => x.name).slice(0, 6);
  const verdict: Verdict = o.verdict && o.verdict in VERDICT_RANK ? o.verdict : 'ok';
  return {
    brand: str(o.brand, 60), product: str(o.product, 100), category: str(o.category, 30) || 'Other', verdict,
    score: Math.max(1, Math.min(10, Math.round(Number(o.score) || (verdict === 'good' ? 8 : verdict === 'ok' ? 5 : 2)))),
    summary: str(o.summary, 600), good: pairs(o.good), watch: pairs(o.watch),
    ingredients: (Array.isArray(o.ingredients) ? o.ingredients : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 120),
    ingredientsFrom: o.ingredientsFrom === 'label' || o.ingredientsFrom === 'known' ? o.ingredientsFrom : 'none',
    howToUse: (Array.isArray(o.howToUse) ? o.howToUse : []).map((x) => str(x, 200)).filter(Boolean).slice(0, 3),
    shade: str(o.shade, 300), pao: str(o.pao, 10),
  };
}
