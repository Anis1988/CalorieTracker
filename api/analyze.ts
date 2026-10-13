import { guard, json } from '../server/guard.js';
import { analyze } from '../server/ai.js';
import { getSettings } from '../server/store.js';
import type { Provider } from '../src/lib/types.js';

/** POST { image?: dataURL, text?, note?, model? } → the breakdown (nothing is saved here). */
export async function POST(req: Request): Promise<Response> {
  const blocked = guard(req, 'analyze', 20);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => ({}))) as { image?: string; text?: string; note?: string; model?: Provider };
  const m = b.image?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (b.image && !m) return json({ error: 'That picture couldn’t be read. Try another one.' }, 400);
  const text = b.text?.trim().slice(0, 1000);
  if (!m && !text) return json({ error: 'Send a photo or a few words about what you ate.' }, 400);
  try {
    const s = await getSettings();
    const out = await analyze({ image: m ? { mime: m[1], data: m[2] } : undefined, text, note: b.note?.trim().slice(0, 300), model: b.model === 'claude' || b.model === 'gemini' ? b.model : undefined }, s);
    return json(out);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
}
