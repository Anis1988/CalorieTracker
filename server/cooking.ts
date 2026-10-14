import { z } from 'zod';
import type { Provider, Recipe, RecipeSearch, Settings } from '../src/lib/types.js';
import { allergyHits } from '../src/lib/allergy.js';
import { ask } from './ai.js';

/**
 * 🍳 What's in the kitchen (typed and/or photos) → recipes you can make now, and ones that need 1–2 more things.
 * The AI picked in Settings → AI does it (the same one as for Calories and Beauty). Allergies are checked again with
 * plain word matching after the AI: a recipe that has one is flagged and goes last, whatever the AI says.
 */
const Ing = z.object({
  name: z.string().describe('Ingredient in everyday words, e.g. "chicken thighs"'),
  qty: z.number().nullable().describe('Amount for the recipe as written (for its servings), null for "to taste"'),
  unit: z.string().describe('g, ml, cup, tbsp, tsp, piece, clove, pinch… or empty'),
  have: z.boolean().describe('true if the person has it (in their list, photos or staples)'),
  sub: z.string().describe('For a missing ingredient: an easy swap from what they have, or empty'),
});
const R = z.object({
  title: z.string(),
  summary: z.string().describe('One appetising sentence'),
  cuisine: z.string(),
  meal: z.string().describe('Breakfast, Lunch, Dinner, Snack or Dessert'),
  minutes: z.number().describe('Total time, prep + cooking'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  servings: z.number(),
  perServing: z.object({ calories: z.number(), protein: z.number(), carbs: z.number(), fat: z.number(), fiber: z.number(), sugar: z.number() }).describe('Nutrition for ONE serving, grams except calories'),
  ingredients: z.array(Ing),
  steps: z.array(z.string()).describe('Clear numbered steps; mention times like "10 minutes" and temperatures'),
  tips: z.array(z.string()).describe('0-2 short tips (make-ahead, swaps, serving)'),
  tags: z.array(z.string()).describe('2-4 short tags, e.g. "One pan", "High protein", "15 min"'),
});
const Answer = z.object({
  detected: z.array(z.string()).describe('Ingredients you can see in the photos (empty if no photos)'),
  recipes: z.array(R),
});

const SYSTEM = `You are a warm, practical chef and nutritionist. From what someone has in their kitchen, suggest the best recipes they can cook.
- Use well-loved, proven dishes (the kind that get top ratings), adapted to what they have. Real home cooking, not gimmicks.
- First recipes need NOTHING extra (only their ingredients and staples). Then recipes that need only 1 or 2 more ingredients, marked have=false, each with an easy swap in "sub" when one exists.
- Read photos carefully: list every ingredient you can see in "detected" (fridge shelves, packets, fruit, jars).
- Follow their diet, allergies (never use them), dislikes, tools, time limit, skill and servings exactly.
- Nutrition per serving must be realistic and add up (calories ≈ 4×protein + 4×carbs + 9×fat). Include cooking oil.
- Amounts for the stated servings, in their units. Steps clear enough for a beginner, with times and temperatures.
- Vary the dishes (not 5 versions of the same thing). Plain, friendly words.`;

export interface CookInput { ingredients: string[]; images: { mime: string; data: string }[]; meal?: string; cuisine?: string; minutes?: number; servings?: number; kcal?: number; protein?: number; wish?: string; model?: Provider }

export async function findRecipes(i: CookInput, s: Settings): Promise<RecipeSearch> {
  const c = s.cooking;
  const lines = [
    i.ingredients.length ? `I have: ${i.ingredients.join(', ')}.` : 'Look at my photos to see what I have.',
    c.staples.length ? `Staples I always have: ${c.staples.join(', ')}.` : '',
    `Servings: ${i.servings || c.servings}. Units: ${c.units === 'us' ? 'US cups/oz' : 'metric (g, ml)'}.`,
    i.meal && i.meal !== 'Any' ? `Meal: ${i.meal}.` : '',
    i.cuisine && i.cuisine !== 'Any' ? `Cuisine: ${i.cuisine}.` : '',
    (i.minutes || c.maxTime) ? `Ready in at most ${i.minutes || c.maxTime} minutes.` : '',
    c.skill !== 'any' ? `Skill: ${c.skill}.` : '',
    c.diet ? `Diet: ${c.diet}.` : '',
    c.allergies.length ? `ALLERGIES (never use): ${c.allergies.join(', ')}.` : '',
    c.dislikes.length ? `I don't like: ${c.dislikes.join(', ')}.` : '',
    c.tools.length ? `Kitchen tools: ${c.tools.join(', ')}.` : '',
    i.kcal ? `Each serving should be about ${Math.round(i.kcal)} kcal or less${i.protein ? ` with at least ${Math.round(i.protein)} g protein if possible` : ''}.` : '',
    i.wish ? `I'd like: ${i.wish}.` : '',
    `Give ${c.count} recipes.`,
  ].filter(Boolean).join('\n');
  const r = await ask({ schema: Answer, system: SYSTEM, prompt: lines, images: i.images, model: i.model, maxTokens: 16000,
    cacheKey: ['cook', i, c] }, s, (raw) => clean(raw), (x) => x.recipes.length > 0);
  // Free check after the AI: allergies by plain words. Flagged recipes go last.
  const recipes = r.recipes.map((x) => ({ ...x, allergyHits: allergyHits(c.allergies, x.ingredients) }));
  recipes.sort((a, b) => (a.allergyHits.length ? 1 : 0) - (b.allergyHits.length ? 1 : 0) || missing(a) - missing(b));
  return { ...r, recipes };
}
const missing = (x: Recipe) => x.ingredients.filter((g) => !g.have).length;

function clean(raw: unknown): Omit<RecipeSearch, 'by'> {
  const ok = Answer.safeParse(raw);
  const o = (ok.success ? ok.data : raw && typeof raw === 'object' ? raw : {}) as Partial<z.infer<typeof Answer>>;
  const str = (v: unknown, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const num = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.round(x * 10 ** d) / 10 ** d : 0; };
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const recipes: Recipe[] = arr(o.recipes).slice(0, 10).map((r0, n) => {
    const r = (r0 ?? {}) as Record<string, unknown>;
    const ps = (r.perServing ?? {}) as Record<string, unknown>;
    const protein = num(ps.protein, 1), carbs = num(ps.carbs, 1), fat = num(ps.fat, 1);
    return {
      id: `r${n}-${Date.now().toString(36)}`,
      title: str(r.title, 90) || 'Recipe', summary: str(r.summary, 300), cuisine: str(r.cuisine, 40), meal: str(r.meal, 20),
      minutes: num(r.minutes), difficulty: (r.difficulty === 'medium' || r.difficulty === 'hard' ? r.difficulty : 'easy') as Recipe['difficulty'], servings: Math.max(1, num(r.servings) || 2),
      perServing: { calories: num(ps.calories) || Math.round(protein * 4 + carbs * 4 + fat * 9), protein, carbs, fat, fiber: num(ps.fiber, 1), sugar: num(ps.sugar, 1) },
      ingredients: arr(r.ingredients).slice(0, 40).map((g0) => { const g = (g0 ?? {}) as Record<string, unknown>; return { name: str(g.name, 80), qty: g.qty == null || !Number.isFinite(Number(g.qty)) ? null : Number(g.qty), unit: str(g.unit, 20), have: g.have !== false, sub: str(g.sub, 120) }; }).filter((g) => g.name),
      steps: arr(r.steps).map((x) => str(x, 600)).filter(Boolean).slice(0, 25),
      tips: arr(r.tips).map((x) => str(x, 240)).filter(Boolean).slice(0, 3),
      tags: arr(r.tags).map((x) => str(x, 24)).filter(Boolean).slice(0, 5),
      allergyHits: [],
    };
  }).filter((r) => r.ingredients.length && r.steps.length);
  return { detected: arr(o.detected).map((x) => str(x, 50)).filter(Boolean).slice(0, 40), recipes };
}

/** 📸 Pantry scan: just the ingredients in the photos (no recipes). */
const Seen = z.object({ items: z.array(z.string()).describe('Every food ingredient you can see, in everyday words, e.g. "eggs", "spinach", "greek yogurt"') });
const RECEIPT = `You read grocery receipts. List the food and drink items that were bought, as everyday ingredient names a cook would use (e.g. "BNLS CHKN BRST" → "chicken breast", "ORG BABY SPIN" → "spinach", "GRK YOG 0%" → "greek yogurt"). No brands, no sizes, no prices, no duplicates. Skip anything that isn't food (bags, soap, paper towels), deposits, coupons and totals.`;
/** 📸 Pantry scan (fridge, cupboard) or 🧾 a grocery receipt: just the ingredients (no recipes). */
// A receipt's non-food lines, caught by plain words even if the AI lets one through.
const NOT_FOOD = /\b((carrier|shopping|plastic|reusable|paper) bags?|bag fee|soap|detergent|laundry|paper towels?|kitchen roll|tissues?|toilet|napkins?|tin ?foil|aluminium foil|aluminum foil|cling ?film|cling ?wrap|plastic wrap|batter(y|ies)|shampoo|conditioner|toothpaste|toothbrush|deodorant|razors?|diapers?|nappies|wipes|cleaner|bleach|sponges?|dish ?washer|trash bags?|bin liners?|charcoal|lighter|candles?|cigarettes?|tobacco|vape|gift ?card|deposit|bottle return|tax|total|subtotal|coupon|discount|savings|cash|visa|tip|cat food|dog food|pet food|litter|ibuprofen|paracetamol|plasters?|band-?aids?|magazine|flowers?)\b/i;

export async function seeIngredients(images: { mime: string; data: string }[], s: Settings, kind: 'kitchen' | 'receipt' = 'kitchen'): Promise<{ items: string[]; by: string }> {
  const receipt = kind === 'receipt';
  const r = await ask({ schema: Seen, system: receipt ? RECEIPT : 'You list the food ingredients you can see in kitchen photos (fridge, pantry, counter, shopping bags). Everyday names, no brands, no duplicates.', prompt: receipt ? 'What food did I buy?' : 'What ingredients can you see?', images, cacheKey: [kind, images.map((x) => x.data)] },
    s, (raw) => ({ items: ((Seen.safeParse(raw).success ? (raw as { items: string[] }).items : (raw as { items?: unknown })?.items) as unknown[] ?? []).map(String).map((x) => x.trim()).filter(Boolean).slice(0, 60) }), (x) => x.items.length > 0);
  if (!receipt) return r;
  const seen = new Set<string>();
  return { ...r, items: r.items.filter((x) => !NOT_FOOD.test(x) && !seen.has(x.toLowerCase()) && !!seen.add(x.toLowerCase())) };
}
