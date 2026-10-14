import { guard, json } from '../server/guard.js';
import { aiUsed, getSettings, putSettings, storeReady, wipe } from '../server/store.js';
import type { Settings, Status } from '../src/lib/types.js';

/** GET → { settings, status } */
export async function GET(req: Request): Promise<Response> {
  const blocked = guard(req, 'settings', 60);
  if (blocked) return blocked;
  const status: Status = {
    store: storeReady(),
    keys: { gemini: !!process.env.GEMINI_API_KEY?.trim(), claude: !!process.env.ANTHROPIC_API_KEY?.trim() },
    used: storeReady() ? { gemini: await aiUsed('gemini'), claude: await aiUsed('claude'), image: await aiUsed('image') } : { gemini: 0, claude: 0, image: 0 },
  };
  return json({ settings: await getSettings(), status });
}

/** PUT { settings } → saved settings  ·  POST { wipe: true } → delete everything */
export async function PUT(req: Request): Promise<Response> {
  const blocked = guard(req, 'settings', 60);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => ({}))) as { settings?: Settings };
  if (!b.settings) return json({ error: 'Nothing to save' }, 400);
  try { return json({ settings: await putSettings(b.settings) }); } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
}

export async function POST(req: Request): Promise<Response> {
  const blocked = guard(req, 'settings', 10);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => ({}))) as { wipe?: boolean };
  if (b.wipe !== true) return json({ error: 'Bad request' }, 400);
  try { return json({ deleted: await wipe() }); } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
}
