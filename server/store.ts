import { Redis } from '@upstash/redis';
import type { DayData, Entry, Favorite, Provider, Settings, ShelfItem } from '../src/lib/types.js';
import { withDefaults } from '../src/lib/types.js';
import { LocalStore } from './localStore.js';

/**
 * Upstash Redis (Vercel → Storage → Upstash for Redis, free). Everything is yours only (one access code):
 *   ct:settings            your settings
 *   ct:month:YYYY-MM       hash  entry id -> Entry       (one hash per month, so a range is a few reads)
 *   ct:water:YYYY-MM       hash  date -> ml
 *   ct:weight              hash  date -> kg
 *   ct:favs                hash  id -> Favorite
 *   ct:shelf               hash  id -> ShelfItem    (💄 beauty products you checked or own)
 *   ct:photo:<id>          small copy of a meal photo (kept Settings → Photos days)
 *   ct:cache:<hash>        an AI answer (the same photo/words are never paid for twice)
 *   ct:ai:<day>:<provider> AI reads today
 */
let redis: Redis | null | undefined;
export function db(): Redis | null {
  if (redis !== undefined) return redis;
  const { url, token } = redisKeys();
  // npm run dev without Upstash keys: a small local file instead (set by vite.config.ts, never on Vercel).
  redis = url && token ? new Redis({ url, token }) : process.env.CT_LOCAL_STORE === '1' ? (new LocalStore() as unknown as Redis) : null;
  return redis;
}
export const storeReady = () => !!db();

/**
 * The Upstash keys Vercel adds when you connect the database. Their names depend on the prefix picked when
 * connecting (KV_REST_API_URL, UPSTASH_REDIS_REST_URL, STORAGE_KV_REST_API_URL, MYDB_REDIS_REST_URL…), so any
 * name ending like that is taken. The read-only token is never used.
 */
function redisKeys(): { url?: string; token?: string } {
  const env = process.env;
  const pick = (ends: string[], not?: RegExp) => {
    for (const e of ends) if (env[e]?.trim()) return env[e]!.trim();
    const k = Object.keys(env).find((n) => ends.some((e) => n.endsWith(`_${e}`)) && (!not || !not.test(n)) && env[n]?.trim());
    return k ? env[k]!.trim() : undefined;
  };
  return { url: pick(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL', 'REDIS_REST_URL']), token: pick(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN', 'REDIS_REST_TOKEN'], /READ_ONLY/) };
}
function need(): Redis {
  const r = db();
  if (!r) throw new Error('Storage isn’t set up: in Vercel → Storage, create “Upstash for Redis” (or open it) and connect it to this project, then Deployments → Redeploy.');
  return r;
}

export async function getSettings(): Promise<Settings> {
  return withDefaults(await db()?.get<Settings>('ct:settings'));
}
export async function putSettings(s: Settings): Promise<Settings> {
  const v = withDefaults(s);
  await need().set('ct:settings', v);
  return v;
}

// ---------- entries ----------
const month = (date: string) => date.slice(0, 7);
const monthsBetween = (from: string, to: string) => {
  const out: string[] = [];
  const d = new Date(`${month(from)}-15T12:00:00Z`);
  while (out.length < 40) {
    const m = d.toISOString().slice(0, 7);
    if (m > month(to)) break;
    out.push(m);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
};

export async function listDays(from: string, to: string): Promise<Record<string, DayData>> {
  const r = need();
  const days: Record<string, DayData> = {};
  const day = (d: string) => (days[d] ??= { entries: [], water: 0 });
  await Promise.all(monthsBetween(from, to).map(async (m) => {
    const [entries, water] = await Promise.all([r.hgetall<Record<string, Entry>>(`ct:month:${m}`), r.hgetall<Record<string, number>>(`ct:water:${m}`)]);
    for (const e of Object.values(entries ?? {})) if (e.date >= from && e.date <= to) day(e.date).entries.push(e);
    for (const [d, ml] of Object.entries(water ?? {})) if (d >= from && d <= to) day(d).water = Number(ml) || 0;
  }));
  for (const d of Object.values(days)) d.entries.sort((a, b) => a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt));
  return days;
}

export async function putEntry(e: Entry, old?: { date: string }): Promise<void> {
  const r = need();
  if (old && month(old.date) !== month(e.date)) await r.hdel(`ct:month:${month(old.date)}`, e.id);
  await r.hset(`ct:month:${month(e.date)}`, { [e.id]: e });
}
export async function getEntry(id: string, date: string): Promise<Entry | null> {
  return (await need().hget<Entry>(`ct:month:${month(date)}`, id)) ?? null;
}
export async function deleteEntry(id: string, date: string): Promise<void> {
  const r = need();
  const e = await getEntry(id, date);
  await r.hdel(`ct:month:${month(date)}`, id);
  if (e?.photo) await r.del(`ct:photo:${e.photo}`);
}

export async function putPhoto(id: string, dataUrl: string, days: number) {
  await need().set(`ct:photo:${id}`, dataUrl, { ex: Math.max(1, days) * 86400 });
}
export const getPhoto = async (id: string) => (await need().get<string>(`ct:photo:${id}`)) ?? null;

export async function setWater(date: string, ml: number) {
  await need().hset(`ct:water:${month(date)}`, { [date]: Math.max(0, Math.round(ml)) });
}

// ---------- weight & favorites ----------
export const weights = async () => (await need().hgetall<Record<string, number>>('ct:weight')) ?? {};
export const setWeight = async (date: string, kg: number) => void (await need().hset('ct:weight', { [date]: Math.round(kg * 100) / 100 }));
export const delWeight = async (date: string) => void (await need().hdel('ct:weight', date));

export const favorites = async () => Object.values((await need().hgetall<Record<string, Favorite>>('ct:favs')) ?? {}).sort((a, b) => a.title.localeCompare(b.title));
export const putFavorite = async (f: Favorite) => void (await need().hset('ct:favs', { [f.id]: f }));
export const delFavorite = async (id: string) => void (await need().hdel('ct:favs', id));

// ---------- 💄 beauty shelf ----------
export const shelf = async () => Object.values((await need().hgetall<Record<string, ShelfItem>>('ct:shelf')) ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const getShelfItem = async (id: string) => (await need().hget<ShelfItem>('ct:shelf', id)) ?? null;
export const putShelfItem = async (x: ShelfItem) => void (await need().hset('ct:shelf', { [x.id]: x }));
export async function delShelfItem(id: string) {
  const r = need();
  const x = await getShelfItem(id);
  await r.hdel('ct:shelf', id);
  if (x?.photo) await r.del(`ct:photo:${x.photo}`);
}

// ---------- AI: daily limits and the answer cache ----------
const today = () => new Date().toISOString().slice(0, 10);
export const aiUsed = async (p: Provider) => Number((await db()?.get<number>(`ct:ai:${today()}:${p}`)) ?? 0);
export async function countAi(p: Provider) {
  const r = need();
  const k = `ct:ai:${today()}:${p}`;
  await r.incr(k);
  await r.expire(k, 3 * 86400);
}
export const getCache = async <T>(key: string) => (await db()?.get<T>(`ct:cache:${key}`)) ?? null;
export const putCache = async (key: string, v: unknown, days: number) => { if (days > 0) await db()?.set(`ct:cache:${key}`, v, { ex: days * 86400 }); };

/** 🗑 Settings → Data → Delete everything: every key of this app. */
export async function wipe(): Promise<number> {
  const r = need();
  let cursor: string | number = 0;
  let n = 0;
  do {
    const [next, keys] = (await r.scan(cursor, { match: 'ct:*', count: 200 })) as [string | number, string[]];
    if (keys.length) n += await r.del(...keys);
    cursor = next;
  } while (String(cursor) !== '0');
  return n;
}
