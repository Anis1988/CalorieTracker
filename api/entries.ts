import { guard, json } from '../server/guard.js';
import { deleteEntry, getEntry, getPhoto, getSettings, listDays, putEntry, putPhoto, setWater } from '../server/store.js';
import type { Entry } from '../src/lib/types.js';
import { MEALS } from '../src/lib/types.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const fail = (e: unknown) => json({ error: e instanceof Error ? e.message : String(e) }, 500);

/** GET ?from&to → { days }  ·  GET ?photo=id → { photo } */
export async function GET(req: Request): Promise<Response> {
  const blocked = guard(req, 'entries', 120);
  if (blocked) return blocked;
  const q = new URL(req.url).searchParams;
  try {
    const photo = q.get('photo');
    if (photo) return json({ photo: /^[\w-]{6,60}$/.test(photo) ? await getPhoto(photo) : null }, 200, { 'Cache-Control': 'private, max-age=86400' });
    const from = q.get('from') ?? '', to = q.get('to') ?? '';
    if (!DATE.test(from) || !DATE.test(to) || from > to) return json({ error: 'Bad dates' }, 400);
    return json({ days: await listDays(from, to) });
  } catch (e) { return fail(e); }
}

/** POST { entry, photo?: dataURL, oldDate? } → save (add or change) · POST { water: { date, ml } } */
export async function POST(req: Request): Promise<Response> {
  const blocked = guard(req, 'entries', 60);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => ({}))) as { entry?: Entry; photo?: string; oldDate?: string; water?: { date: string; ml: number } };
  try {
    if (b.water) {
      if (!DATE.test(b.water.date)) return json({ error: 'Bad date' }, 400);
      await setWater(b.water.date, Number(b.water.ml) || 0);
      return json({ ok: true });
    }
    const e = b.entry;
    if (!e || !/^[\w-]{6,60}$/.test(e.id) || !DATE.test(e.date) || !/^\d{2}:\d{2}$/.test(e.time) || !MEALS.some((m) => m.id === e.meal) || !Array.isArray(e.items)) return json({ error: 'That meal couldn’t be saved (missing details).' }, 400);
    const s = await getSettings();
    const entry: Entry = { ...e, title: String(e.title || 'Meal').slice(0, 80), items: e.items.slice(0, 40) };
    if (b.photo && s.photos.keep && /^data:image\/jpeg;base64,/.test(b.photo) && b.photo.length < 400_000) {
      entry.photo = entry.id;
      await putPhoto(entry.id, b.photo, s.photos.days);
    }
    const old = b.oldDate && DATE.test(b.oldDate) ? await getEntry(e.id, b.oldDate) : null;
    if (old?.photo && !entry.photo) entry.photo = old.photo;
    await putEntry(entry, old ?? undefined);
    return json({ entry });
  } catch (e) { return fail(e); }
}

/** DELETE ?id&date */
export async function DELETE(req: Request): Promise<Response> {
  const blocked = guard(req, 'entries', 60);
  if (blocked) return blocked;
  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '', date = q.get('date') ?? '';
  if (!/^[\w-]{6,60}$/.test(id) || !DATE.test(date)) return json({ error: 'Bad request' }, 400);
  try { await deleteEntry(id, date); return json({ ok: true }); } catch (e) { return fail(e); }
}
