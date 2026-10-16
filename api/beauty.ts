import { guard, json } from '../server/guard.js';
import { checkProduct, type KnownProduct } from '../server/beauty.js';
import { delShelfItem, getSettings, getShelfItem, putPhoto, putShelfItem, shelf } from '../server/store.js';
import type { Provider, ShelfItem } from '../src/lib/types.js';
import { SHELF_STATUS } from '../src/lib/types.js';

const ID = /^[\w-]{6,60}$/;
const fail = (e: unknown, code = 500) => json({ error: e instanceof Error ? e.message : String(e) }, code);

/** 🏷️ A barcode product from Open Beauty Facts (sent by the phone), made safe. Needs an ingredient list. */
function known(p: unknown): KnownProduct | undefined {
  if (!p || typeof p !== 'object') return undefined;
  const o = p as Record<string, unknown>;
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const ingredients = (Array.isArray(o.ingredients) ? o.ingredients : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 120);
  const code = str(o.code, 20).replace(/\D/g, '');
  if (!ingredients.length || code.length < 6) return undefined;
  return { code, brand: str(o.brand, 60), name: str(o.name, 100), category: str(o.category, 30), ingredients };
}

/** GET → { shelf } */
export async function GET(req: Request): Promise<Response> {
  const blocked = guard(req, 'beauty', 60);
  if (blocked) return blocked;
  try { return json({ shelf: await shelf() }); } catch (e) { return fail(e); }
}

/**
 * POST { check: { images: dataURL[], note?, model?, product? } } → the verdict for your skin (nothing saved; product = 🏷️ barcode find)
 * POST { item, photo?: dataURL } → save to My shelf (add or change)
 */
export async function POST(req: Request): Promise<Response> {
  const b = (await req.json().catch(() => ({}))) as { check?: { images?: string[]; note?: string; model?: Provider; product?: KnownProduct }; item?: ShelfItem; photo?: string };
  const blocked = guard(req, 'beauty', b.check ? 20 : 60);
  if (blocked) return blocked;
  try {
    const s = await getSettings();
    if (b.check) {
      const images = (b.check.images ?? []).slice(0, 3).map((x) => x.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => ({ mime: m[1], data: m[2] }));
      const product = known(b.check.product);
      if (!images.length && !product) return json({ error: 'Add a photo of the product first.' }, 400);
      const model = b.check.model === 'claude' || b.check.model === 'gemini' ? b.check.model : undefined;
      return json(await checkProduct({ images: product ? [] : images, note: b.check.note?.trim().slice(0, 300), model, product }, s));
    }
    const x = b.item;
    if (!x || !ID.test(x.id) || !SHELF_STATUS.some((st) => st.id === x.status)) return json({ error: 'That product couldn’t be saved.' }, 400);
    const old = await getShelfItem(x.id);
    const item: ShelfItem = { ...x, photo: old?.photo ?? x.photo };
    if (b.photo && s.photos.keep && /^data:image\/jpeg;base64,/.test(b.photo) && b.photo.length < 400_000) {
      item.photo = x.id;
      await putPhoto(x.id, b.photo, s.photos.days);
    }
    await putShelfItem(item);
    return json({ item });
  } catch (e) { return fail(e, b.check ? 502 : 500); }
}

/** DELETE ?id */
export async function DELETE(req: Request): Promise<Response> {
  const blocked = guard(req, 'beauty', 60);
  if (blocked) return blocked;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!ID.test(id)) return json({ error: 'Bad request' }, 400);
  try { await delShelfItem(id); return json({ ok: true }); } catch (e) { return fail(e); }
}
