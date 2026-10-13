import { guard, json } from '../server/guard.js';
import { findRecipes, seeIngredients } from '../server/cooking.js';
import { delRecipe, getSettings, pantry, putPantry, putRecipe, putShopping, recipes, shopping } from '../server/store.js';
import type { Provider, Recipe, ShopItem } from '../src/lib/types.js';

const ID = /^[\w-]{2,60}$/;
const imgs = (l?: string[]) => (l ?? []).slice(0, 3).map((x) => x.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => ({ mime: m[1], data: m[2] }));
const list = (l: unknown, n = 80) => (Array.isArray(l) ? l : []).map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, n);
const fail = (e: unknown, code = 500) => json({ error: e instanceof Error ? e.message : String(e) }, code);

/** GET → { recipes, pantry, shopping } */
export async function GET(req: Request): Promise<Response> {
  const blocked = guard(req, 'cooking', 60);
  if (blocked) return blocked;
  try { const [r, p, sh] = await Promise.all([recipes(), pantry(), shopping()]); return json({ recipes: r, pantry: p, shopping: sh }); } catch (e) { return fail(e); }
}

/**
 * POST { find: { ingredients, images, meal, cuisine, minutes, servings, kcal, protein, wish, model } } → recipes (not saved)
 * POST { see: { images } } → ingredients seen in the photos
 * POST { recipe } → save to Recipes · { pantry: [] } · { shopping: [] }
 */
export async function POST(req: Request): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as { find?: Record<string, unknown> & { images?: string[]; ingredients?: string[] }; see?: { images?: string[] }; recipe?: Recipe; pantry?: string[]; shopping?: ShopItem[] };
  const blocked = guard(req, 'cooking', b.find || b.see ? 15 : 60);
  if (blocked) return blocked;
  try {
    const s = await getSettings();
    if (b.find) {
      const f = b.find;
      const images = imgs(f.images);
      const ingredients = list(f.ingredients);
      if (!images.length && !ingredients.length) return json({ error: 'Add a few ingredients or a photo first.' }, 400);
      const n = (v: unknown, max: number) => Math.min(max, Math.max(0, Number(v) || 0));
      const model = f.model === 'claude' || f.model === 'gemini' ? (f.model as Provider) : undefined;
      return json(await findRecipes({ ingredients, images, meal: String(f.meal ?? '').slice(0, 20), cuisine: String(f.cuisine ?? '').slice(0, 30), minutes: n(f.minutes, 600), servings: n(f.servings, 20), kcal: n(f.kcal, 5000), protein: n(f.protein, 400), wish: String(f.wish ?? '').trim().slice(0, 200), model }, s));
    }
    if (b.see) {
      const images = imgs(b.see.images);
      if (!images.length) return json({ error: 'Add a photo first.' }, 400);
      return json(await seeIngredients(images, s));
    }
    if (b.recipe) {
      const r = b.recipe;
      if (!ID.test(r.id) || !Array.isArray(r.ingredients) || !Array.isArray(r.steps)) return json({ error: 'That recipe couldn’t be saved.' }, 400);
      await putRecipe({ ...r, createdAt: r.createdAt || new Date().toISOString() });
      return json({ ok: true });
    }
    if (b.pantry) { await putPantry(list(b.pantry, 300)); return json({ ok: true }); }
    if (b.shopping) {
      const l = (Array.isArray(b.shopping) ? b.shopping : []).slice(0, 300).map((x) => ({ id: String(x.id).slice(0, 40), name: String(x.name).trim().slice(0, 80), done: !!x.done, from: x.from ? String(x.from).slice(0, 90) : undefined })).filter((x) => x.name);
      await putShopping(l);
      return json({ ok: true });
    }
    return json({ error: 'Bad request' }, 400);
  } catch (e) { return fail(e, b.find || b.see ? 502 : 500); }
}

/** DELETE ?id → remove a saved recipe */
export async function DELETE(req: Request): Promise<Response> {
  const blocked = guard(req, 'cooking', 60);
  if (blocked) return blocked;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!ID.test(id)) return json({ error: 'Bad request' }, 400);
  try { await delRecipe(id); return json({ ok: true }); } catch (e) { return fail(e); }
}
