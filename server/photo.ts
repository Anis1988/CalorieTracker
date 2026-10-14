import { getCache, putCache } from './store.js';
import type { RecipePhoto } from '../src/lib/types.js';

/**
 * 🖼️ A real food photo for a recipe (free). Candidates come from Pixabay (PIXABAY_API_KEY), Pexels (PEXELS_API_KEY)
 * and Wikimedia Commons (no key); each is scored on how many of the dish's words its description/tags contain, and
 * only a photo that clearly matches the dish is used: better no photo than a random "food" picture.
 * Search words: the AI's photo phrase for the dish (photoQuery) first, then the title. Remembered 30 days per dish.
 */
const STOP = new Set(['and', 'with', 'the', 'a', 'of', 'in', 'on', 'easy', 'quick', 'simple', 'my', 'style', 'one', 'pan', 'sheet', 'healthy', 'best', 'homemade', 'classic', 'creamy', 'crispy', 'spicy', 'fresh', 'light', 'minute', 'minutes', 'bowl', 'plate', 'food', 'dish', 'meal', 'recipe', 'serving']);
const words = (s: string) => [...new Set(s.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter((w) => w.length > 2 && !STOP.has(w)))];
const stem = (w: string) => w.replace(/(es|s)$/, '');
const scoreOf = (text: string, want: string[]) => { const t = text.toLowerCase(); return want.filter((w) => t.includes(stem(w))).length; };

interface Cand extends RecipePhoto { score: number }

async function pixabay(q: string, want: string[]): Promise<Cand[]> {
  const key = process.env.PIXABAY_API_KEY?.trim();
  if (!key) return [];
  const r = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&image_type=photo&category=food&safesearch=true&per_page=20&order=popular`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return [];
  const j = (await r.json()) as { hits?: { tags: string; user: string; pageURL: string; webformatURL: string; largeImageURL: string }[] };
  return (j.hits ?? []).map((h) => ({ thumb: h.webformatURL, full: h.largeImageURL, credit: `Photo: ${h.user} · Pixabay`, link: h.pageURL, score: scoreOf(`${h.tags} ${h.pageURL}`, want) }));
}

async function pexels(q: string, want: string[]): Promise<Cand[]> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return [];
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20`, { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return [];
  const j = (await r.json()) as { photos?: { url: string; alt?: string; photographer: string; src: { medium: string; large2x: string } }[] };
  return (j.photos ?? []).map((p) => ({ thumb: p.src.medium, full: p.src.large2x, credit: `Photo: ${p.photographer} · Pexels`, link: p.url, score: scoreOf(`${p.alt ?? ''} ${p.url}`, want) }));
}

async function wikimedia(q: string, want: string[]): Promise<Cand[]> {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480`;
  const r = await fetch(u, { headers: { 'User-Agent': 'CalorieTracker/1.0 (personal app)' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return [];
  const j = (await r.json()) as { query?: { pages?: Record<string, { title: string; imageinfo?: { url: string; thumburl?: string; descriptionurl: string; extmetadata?: { Artist?: { value?: string }; ImageDescription?: { value?: string } } }[] }> } };
  return Object.values(j.query?.pages ?? {}).filter((p) => /\.(jpe?g|png|webp)$/i.test(p.title) && p.imageinfo?.[0]?.thumburl).map((p) => {
    const ii = p.imageinfo![0];
    const who = (ii.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 40);
    const desc = (ii.extmetadata?.ImageDescription?.value ?? '').replace(/<[^>]+>/g, ' ');
    return { thumb: ii.thumburl!, full: ii.url, credit: `Photo: ${who || 'Wikimedia Commons'} · Wikimedia`, link: ii.descriptionurl, score: scoreOf(`${p.title} ${desc}`, want) };
  });
}

/** Best matching photos for the dish, best first (only clear matches). */
async function candidates(title: string, query: string, cuisine: string): Promise<Cand[]> {
  const want = words(`${query} ${title}`).slice(0, 6);
  const need = want.length <= 2 ? 1 : 2; // how many of the dish's words a photo must show to count as a match
  const queries = [query, title, words(title).slice(0, 3).join(' '), cuisine && `${cuisine} ${words(title).slice(0, 2).join(' ')}`].map((q) => (q ?? '').trim()).filter((q, i, a) => q && a.indexOf(q) === i);
  const seen = new Set<string>();
  let all: Cand[] = [];
  for (const q of queries) {
    const got = (await Promise.all([pixabay(q, want), pexels(q, want), wikimedia(q, want)].map((p) => p.catch(() => [] as Cand[])))).flat();
    for (const c of got) if (!seen.has(c.full)) { seen.add(c.full); all.push(c); }
    if (all.some((c) => c.score >= Math.max(need, Math.min(3, want.length)))) break; // a strong match: no need to search more
  }
  all = all.filter((c) => c.score >= need);
  // Higher score first; on a tie, Pixabay/Pexels (consistent food photography) before Wikimedia.
  return all.sort((a, b) => b.score - a.score || Number(/Wikimedia/.test(a.credit)) - Number(/Wikimedia/.test(b.credit)));
}

export async function recipePhoto(title: string, cuisine = '', query = '', skip: string[] = []): Promise<RecipePhoto | null> {
  const key = `photo2:${words(`${query} ${title}`).join('-')}`;
  if (!skip.length) {
    const hit = await getCache<RecipePhoto | { none: true }>(key);
    if (hit) return 'none' in hit ? null : hit;
  }
  const list = await candidates(title, query || title, cuisine);
  const pick = list.find((c) => !skip.includes(c.full)) ?? null;
  const out: RecipePhoto | null = pick ? { thumb: pick.thumb, full: pick.full, credit: pick.credit, link: pick.link, v: 2 } : null;
  if (!skip.length) await putCache(key, out ?? { none: true }, out ? 30 : 3);
  return out;
}
