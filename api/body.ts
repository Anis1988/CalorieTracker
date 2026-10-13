import { guard, json } from '../server/guard.js';
import { delFavorite, delWeight, favorites, putFavorite, setWeight, weights } from '../server/store.js';
import type { Favorite } from '../src/lib/types.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const fail = (e: unknown) => json({ error: e instanceof Error ? e.message : String(e) }, 500);

/** GET → { weights: {date: kg}, favorites } */
export async function GET(req: Request): Promise<Response> {
  const blocked = guard(req, 'body', 60);
  if (blocked) return blocked;
  try { return json({ weights: await weights(), favorites: await favorites() }); } catch (e) { return fail(e); }
}

/** POST { weight: { date, kg } } | { favorite } */
export async function POST(req: Request): Promise<Response> {
  const blocked = guard(req, 'body', 60);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => ({}))) as { weight?: { date: string; kg: number }; favorite?: Favorite };
  try {
    if (b.weight) {
      const kg = Number(b.weight.kg);
      if (!DATE.test(b.weight.date) || !(kg > 20 && kg < 400)) return json({ error: 'That weight doesn’t look right.' }, 400);
      await setWeight(b.weight.date, kg);
      return json({ ok: true });
    }
    const f = b.favorite;
    if (f && /^[\w-]{6,60}$/.test(f.id) && Array.isArray(f.items)) {
      await putFavorite({ id: f.id, title: String(f.title || 'Favorite').slice(0, 80), items: f.items.slice(0, 40), meal: f.meal, createdAt: f.createdAt || new Date().toISOString() });
      return json({ ok: true });
    }
    return json({ error: 'Nothing to save' }, 400);
  } catch (e) { return fail(e); }
}

/** DELETE ?weight=date | ?favorite=id */
export async function DELETE(req: Request): Promise<Response> {
  const blocked = guard(req, 'body', 60);
  if (blocked) return blocked;
  const q = new URL(req.url).searchParams;
  try {
    const w = q.get('weight'), f = q.get('favorite');
    if (w && DATE.test(w)) await delWeight(w);
    else if (f && /^[\w-]{6,60}$/.test(f)) await delFavorite(f);
    else return json({ error: 'Bad request' }, 400);
    return json({ ok: true });
  } catch (e) { return fail(e); }
}
