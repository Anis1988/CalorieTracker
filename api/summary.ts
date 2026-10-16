import { json, needCode, rateLimited } from '../server/guard.js';
import { aiHistory, getSettings, listDays, shelf, shopping } from '../server/store.js';
import { calorieGoal } from '../src/lib/nutrition.js';
import { CLAUDE_MODELS, type Entry, type Settings, type ShelfItem } from '../src/lib/types.js';

/**
 * 📋 GET /api/summary → a short read-only status for the owner's "My apps" page (LifeTracker, apps.html):
 * calories today vs the goal, the last meal, a beauty/cooking note, and what the AI used (today, 7 days, this month).
 * Same access code as the app (header X-Access-Token = APP_ACCESS_TOKEN). Only https://anis1988.github.io may call it
 * from a browser (CORS); nothing is changed here.
 */
const ORIGIN = 'https://anis1988.github.io';

/**
 * Cost per AI read, an ESTIMATE (the app doesn't keep token counts): Gemini is used on Google's free allowance (0);
 * Claude depends on the model picked in Settings → AI (a beauty/food read is ~2–4k tokens in, ~1k out; recipe searches
 * are longer); an AI recipe picture from Gemini's image model is about 4 cents.
 */
const CLAUDE_USD: Record<string, number> = { 'claude-haiku-5-5': 0.005, 'claude-sonnet-5-5': 0.015, 'claude-opus-5-5': 0.04 };
const IMAGE_USD = 0.04;
const claudeUsd = (s: Settings) => CLAUDE_USD[s.ai.claudeModel] ?? (/haiku/i.test(s.ai.claudeModel) ? 0.005 : /opus/i.test(s.ai.claudeModel) ? 0.04 : 0.015);

function cors(req: Request): Record<string, string> {
  return req.headers.get('origin') === ORIGIN ? { 'Access-Control-Allow-Origin': ORIGIN, Vary: 'Origin' } : { Vary: 'Origin' };
}

export function OPTIONS(req: Request): Response {
  if (req.headers.get('origin') !== ORIGIN) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'X-Access-Token', 'Access-Control-Max-Age': '600', Vary: 'Origin' } });
}

/** YYYY-MM-DD in a time zone (your phone's, kept in Settings by the app), UTC if unknown. */
function dayIn(tz: string, d = new Date()): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); } catch { return d.toISOString().slice(0, 10); }
}
const shift = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const round2 = (n: number) => Math.round(n * 100) / 100;

type Line = { icon: string; text: string; tone: 'good' | 'warn' | 'info' };

export async function GET(req: Request): Promise<Response> {
  const h = cors(req);
  const bad = needCode(req, h);
  if (bad) return bad;
  const slow = rateLimited(req, 'summary', 20);
  if (slow) return new Response(slow.body, { status: slow.status, headers: { ...Object.fromEntries(slow.headers), ...h } });
  try {
    const s = await getSettings();
    const today = dayIn(s.display.timeZone);
    const [days, items, shop] = await Promise.all([listDays(shift(today, -6), today), shelf().catch(() => [] as ShelfItem[]), shopping().catch(() => [])]);
    const lines: Line[] = [];

    // 🥗 calories today vs goal
    const goal = calorieGoal(s);
    const eaten = Math.round((days[today]?.entries ?? []).reduce((t, e) => t + e.items.reduce((a, f) => a + (Number(f.calories) || 0), 0), 0));
    const kcal = (n: number) => (s.units.energy === 'kJ' ? `${Math.round(n * 4.184).toLocaleString('en-US')} kJ` : `${n.toLocaleString('en-US')} kcal`);
    lines.push(eaten > goal
      ? { icon: '🍽️', text: `${kcal(eaten)} of ${kcal(goal)} today: over by ${kcal(eaten - goal)}`, tone: 'warn' }
      : { icon: '🍽️', text: eaten ? `${kcal(eaten)} of ${kcal(goal)} today, ${kcal(goal - eaten)} left` : `Nothing logged today yet (goal ${kcal(goal)})`, tone: eaten ? 'good' : 'info' });

    // 🕘 last meal (this week)
    const all: Entry[] = Object.values(days).flatMap((d) => d.entries).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    const last = all[0];
    if (last) {
      const when = last.date === today ? `today ${last.time}` : last.date === shift(today, -1) ? `yesterday ${last.time}` : `${last.date.slice(5)} ${last.time}`;
      const k = Math.round(last.items.reduce((a, f) => a + (Number(f.calories) || 0), 0));
      lines.push({ icon: '🕘', text: `Last meal: ${last.title.slice(0, 40)} (${kcal(k)}, ${when})`, tone: 'info' });
    } else lines.push({ icon: '🕘', text: 'No meals logged this week', tone: 'info' });

    // 💄 / 🍳 one note
    const expiring = s.beauty.on ? items.filter((x) => { const left = daysLeft(x, today); return left !== null && left < 30; }) : [];
    const toBuy = s.cooking.on ? shop.filter((x) => !x.done).length : 0;
    if (expiring.length) lines.push({ icon: '💄', text: `${expiring.length} beauty product${expiring.length > 1 ? 's' : ''} to replace soon (${expiring[0].product.slice(0, 30)}${expiring.length > 1 ? '…' : ''})`, tone: 'warn' });
    else if (toBuy) lines.push({ icon: '🍳', text: `${toBuy} thing${toBuy > 1 ? 's' : ''} on the shopping list`, tone: 'info' });
    else if (s.beauty.on && items.length) lines.push({ icon: '💄', text: `${items.length} products on My shelf, ${items.filter((x) => x.status === 'using' || x.status === 'loved').length} in use`, tone: 'info' });

    // 🤖 AI: per UTC day (that's how the counters are kept)
    const utc = new Date().toISOString().slice(0, 10);
    const monthStart = `${utc.slice(0, 8)}01`;
    const first = monthStart < shift(utc, -6) ? monthStart : shift(utc, -6);
    const list: string[] = [];
    for (let d = first; d <= utc; d = shift(d, 1)) list.push(d);
    const { counts, since } = await aiHistory(list);
    const cUsd = claudeUsd(s);
    const tally = (ds: string[]) => {
      let calls = 0, usd = 0;
      for (const d of ds) { const c = counts[d]; if (!c) continue; calls += c.gemini + c.claude + c.image; usd += c.claude * cUsd + c.image * IMAGE_USD; }
      return { calls, usd: round2(usd) };
    };
    const week = list.filter((d) => d >= shift(utc, -6));
    const month = list.filter((d) => d >= monthStart);
    const t = counts[utc] ?? { gemini: 0, claude: 0, image: 0 };
    const claudeName = CLAUDE_MODELS.find((m) => m.id === s.ai.claudeModel)?.name ?? s.ai.claudeModel;
    const byModel = [
      { model: 'Gemini (free)', calls: t.gemini, usd: 0 },
      { model: claudeName, calls: t.claude, usd: round2(t.claude * cUsd) },
      { model: 'AI recipe pictures', calls: t.image, usd: round2(t.image * IMAGE_USD) },
    ].filter((m) => m.calls > 0);
    const from = since ?? utc;
    const ai = {
      today: tally([utc]), week: tally(week), month: tally(month), byModel, estimate: true,
      ...(from > shift(utc, -6) || from > monthStart ? { since: from, note: `Week and month counted from ${from} (when the app started keeping daily AI counts).` } : {}),
    };
    return json({ app: 'calorie-tracker', lines: lines.slice(0, 3), ai, at: new Date().toISOString() }, 200, h);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, h);
  }
}

/** Days until an opened product is past its "12M" date (null if not opened / no date). */
function daysLeft(x: Pick<ShelfItem, 'openedOn' | 'paoMonths'>, today: string): number | null {
  if (!x.openedOn || !x.paoMonths) return null;
  const d = new Date(`${x.openedOn}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + x.paoMonths);
  return Math.round((d.getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000);
}
