import { getCache, putCache } from './store.js';
import type { RecipePhoto } from '../src/lib/types.js';

/**
 * 🖼️ A real food photo for a recipe (free): Pexels (PEXELS_API_KEY), else Pixabay (PIXABAY_API_KEY), else Wikimedia
 * Commons (no key). A small copy for the cards and a big one for full screen. Remembered 30 days per dish.
 */
const STOP = new Set(['and', 'with', 'the', 'a', 'of', 'in', 'on', 'easy', 'quick', 'simple', 'my', 'style', 'one', 'pan', 'sheet', 'healthy', 'best']);
const words = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const score = (text: string, want: string[]) => { const t = text.toLowerCase(); return want.filter((w) => t.includes(w)).length; };

async function pexels(q: string, want: string[]): Promise<RecipePhoto | null> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return null;
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=landscape`, { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const j = (await r.json()) as { photos?: { url: string; alt?: string; photographer: string; src: { medium: string; large2x: string } }[] };
  const best = (j.photos ?? []).map((p) => ({ p, s: score(`${p.alt ?? ''} ${p.url}`, want) })).sort((a, b) => b.s - a.s)[0]?.p;
  return best ? { thumb: best.src.medium, full: best.src.large2x, credit: `Photo: ${best.photographer} · Pexels`, link: best.url } : null;
}

async function pixabay(q: string, want: string[]): Promise<RecipePhoto | null> {
  const key = process.env.PIXABAY_API_KEY?.trim();
  if (!key) return null;
  const r = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&image_type=photo&category=food&safesearch=true&per_page=15`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const j = (await r.json()) as { hits?: { tags: string; user: string; pageURL: string; webformatURL: string; largeImageURL: string }[] };
  const best = (j.hits ?? []).map((h) => ({ h, s: score(h.tags, want) })).sort((a, b) => b.s - a.s)[0]?.h;
  return best ? { thumb: best.webformatURL, full: best.largeImageURL, credit: `Photo: ${best.user} · Pixabay`, link: best.pageURL } : null;
}

async function wikimedia(q: string): Promise<RecipePhoto | null> {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=6&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480`;
  const r = await fetch(u, { headers: { 'User-Agent': 'CalorieTracker/1.0 (personal app)' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const j = (await r.json()) as { query?: { pages?: Record<string, { title: string; imageinfo?: { url: string; thumburl?: string; descriptionurl: string; extmetadata?: { Artist?: { value?: string } } }[] }> } };
  const pages = Object.values(j.query?.pages ?? {}).filter((p) => /\.(jpe?g|png|webp)$/i.test(p.title) && p.imageinfo?.[0]?.thumburl);
  const p = pages[0];
  if (!p) return null;
  const ii = p.imageinfo![0];
  const who = (ii.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 40);
  return { thumb: ii.thumburl!, full: ii.url, credit: `Photo: ${who || 'Wikimedia Commons'} · Wikimedia`, link: ii.descriptionurl };
}

export async function recipePhoto(title: string, cuisine = ''): Promise<RecipePhoto | null> {
  const want = words(title);
  const key = `photo:${want.join('-')}`;
  const hit = await getCache<RecipePhoto | { none: true }>(key);
  if (hit) return 'none' in hit ? null : hit;
  // The dish name first; then a shorter version (the main words); then the cuisine + main word.
  const tries = [want.join(' '), want.slice(0, 3).join(' '), `${cuisine} ${want[0] ?? ''} food`.trim()].filter((q, i, a) => q && a.indexOf(q) === i);
  let out: RecipePhoto | null = null;
  for (const q of tries) {
    for (const f of [pexels, pixabay]) { try { out = await f(q, want); } catch { out = null; } if (out) break; }
    if (out) break;
  }
  if (!out) { try { out = await wikimedia(want.slice(0, 3).join(' ') + ' food'); } catch { out = null; } }
  await putCache(key, out ?? { none: true }, out ? 30 : 2);
  return out;
}
