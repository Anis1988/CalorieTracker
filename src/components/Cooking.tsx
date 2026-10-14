import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { errText, newId } from '../lib/api';
import { nowTime, todayStr } from '../lib/date';
import { useStore } from '../lib/store';
import { kcalText, mealAt } from '../lib/nutrition';
import type { Entry, Recipe, RecipeIngredient, RecipePhoto, ShopItem } from '../lib/types';
import { MacroLine } from './Food';
import { ICONS, Icon, PhotoViewer, Sheet, toast } from './ui';
import { api } from '../lib/api';
import { shrink } from '../lib/image';

/** 🍳 Cooking pieces. Each is also drawn in the Cooking guide with a made-up recipe. */

const missingOf = (r: Recipe) => r.ingredients.filter((g) => !g.have);

/** Amounts for another number of servings, in friendly numbers (½ cup, 250 g). */
export function amount(g: RecipeIngredient, factor: number): string {
  if (g.qty == null) return g.unit || '';
  const q = g.qty * factor;
  const metric = /^(g|ml|kg|l)$/i.test(g.unit);
  let txt: string;
  if (metric) txt = String(q >= 100 ? Math.round(q / 5) * 5 : Math.round(q * 10) / 10);
  else {
    const whole = Math.floor(q + 0.01);
    const frac = q - whole;
    const f = frac < 0.13 ? '' : frac < 0.3 ? '¼' : frac < 0.42 ? '⅓' : frac < 0.6 ? '½' : frac < 0.71 ? '⅔' : frac < 0.88 ? '¾' : '';
    txt = frac >= 0.88 ? String(whole + 1) : `${whole || (f ? '' : '0')}${f}`;
  }
  return `${txt}${g.unit ? (metric ? ' ' : ' ') + g.unit : ''}`.trim();
}

/** 🖼️ A recipe's photo, found once (free) and kept with the recipe. */
const photoAsks = new Map<string, Promise<RecipePhoto | null>>();
export function findPhoto(r: Pick<Recipe, 'title' | 'cuisine' | 'photoQuery'>): Promise<RecipePhoto | null> {
  const k = r.title.toLowerCase();
  let p = photoAsks.get(k);
  if (!p) { p = api.recipePhoto(r.title, r.cuisine, r.photoQuery).then((x) => x.photo).catch(() => null); photoAsks.set(k, p); }
  return p;
}
/** Photos found before matching got stricter (no "v") are looked for again. */
export const needsPhoto = (r: Pick<Recipe, 'photo'>) => r.photo === undefined || (!!r.photo && !r.photo.v);

/**
 * 🎨 An AI picture of the exact dish (Gemini, about 4 cents, once per dish): the picture comes back full size, is shrunk
 * on the phone (a small and a big JPEG) and kept on the server. Same dish again = the kept picture, free.
 */
const drawAsks = new Map<string, Promise<RecipePhoto | null>>();
export function drawPhoto(r: Pick<Recipe, 'title' | 'summary' | 'ingredients'>): Promise<RecipePhoto | null> {
  const k = r.title.toLowerCase();
  let p = drawAsks.get(k);
  if (!p) {
    p = (async () => {
      const d = await api.drawDish({ title: r.title, summary: r.summary, ingredients: r.ingredients.map((g) => g.name) });
      if (!d.done && d.image) {
        const [thumb, full] = await Promise.all([shrink(await (await fetch(d.image)).blob(), 400, 0.78), shrink(await (await fetch(d.image)).blob(), 1280, 0.85)]);
        await api.keepDrawing(d.key, thumb, full);
      }
      return { thumb: `ai:draw-${d.key}-t`, full: `ai:draw-${d.key}-f`, credit: 'Picture made by AI (Gemini)', link: '', v: 2, ai: true };
    })();
    p.catch(() => drawAsks.delete(k));
    drawAsks.set(k, p);
  }
  return p;
}

/** A picture address: a web address as is, an AI picture ("ai:<id>") fetched from the server (with the access code). */
export function useSrc(src?: string): string | undefined {
  const st = useStore();
  const [out, setOut] = useState<string | undefined>(src && !src.startsWith('ai:') ? src : undefined);
  useEffect(() => {
    if (!src) return setOut(undefined);
    if (!src.startsWith('ai:')) return setOut(src);
    let live = true;
    void st.photo(src.slice(3)).then((u) => live && setOut(u ?? undefined));
    return () => { live = false; };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  return out;
}

/** The small photo on a card (a soft placeholder while it's being found). */
function RecipeThumb({ r }: { r: Recipe }) {
  const src = useSrc(r.photo && r.photo.v ? r.photo.thumb : undefined);
  if (src) return <img src={src} alt="" loading="lazy" className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover" />;
  if (r.photo && r.photo.v) return <span className="h-[72px] w-[72px] shrink-0 animate-pulse rounded-2xl" style={{ background: 'var(--trk)' }} aria-hidden="true" />;
  return <span className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl text-2xl ${needsPhoto(r) ? 'animate-pulse' : ''}`} style={{ background: 'var(--trk)' }} aria-hidden="true">🍽️</span>;
}

export function RecipeCard({ r, onOpen }: { r: Recipe; onOpen?: () => void }) {
  const miss = missingOf(r);
  return (
    <button className="card tap block w-full !p-4 text-left" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <RecipeThumb r={r} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-semibold leading-snug">{r.fav ? '⭐ ' : ''}{r.title}</p>
          <p className="mt-0.5 text-sm muted">{r.summary}</p>
        </div>
        <div className="shrink-0 text-right"><p className="num text-lg font-semibold leading-none">{Math.round(r.perServing.calories)}</p><p className="text-[10px] muted">kcal / serving</p></div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="muted">⏱ {r.minutes} min · {r.difficulty} · {r.servings} serving{r.servings === 1 ? '' : 's'}</span>
        <MacroLine t={r.perServing} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {r.allergyHits.length > 0 && <span className="rounded-full bg-red-500/15 px-2.5 py-1 font-bold text-red-700 dark:text-red-300">⚠️ Has {r.allergyHits.join(', ')}</span>}
        {miss.length === 0 ? <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-bold text-emerald-800 dark:text-emerald-300">✅ You have everything</span>
          : <span className="rounded-full bg-orange-500/15 px-2.5 py-1 font-bold text-orange-800 dark:text-orange-300">🛒 Needs {miss.map((g) => g.name).join(', ')}</span>}
        {r.tags.slice(0, 3).map((t) => <span key={t} className="rounded-full border px-2.5 py-1 font-semibold" style={{ borderColor: 'var(--bd)' }}>{t}</span>)}
        {r.rating ? <span className="px-1 py-1 font-bold text-amber-600 dark:text-amber-300">{'★'.repeat(r.rating)}</span> : null}
      </div>
    </button>
  );
}

/** One recipe: servings, ingredients (have / missing + swaps), nutrition, steps, and what you can do with it. */
export function RecipeSheet({ r: r0, onClose, saved }: { r: Recipe; onClose: () => void; saved?: boolean }) {
  const st = useStore();
  const [r, setR] = useState(r0);
  const [big, setBig] = useState(false);
  const [another, setAnother] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  // Not the right dish? The next best matching photo (and it's kept with the recipe if saved).
  const anotherPhoto = async () => {
    if (!r.photo) return;
    setAnother(true);
    const skip = [...skipped, r.photo.full];
    try {
      const { photo } = await api.recipePhoto(r.title, r.cuisine, r.photoQuery, skip);
      if (!photo) toast('info', 'No other matching photo found.');
      else {
        setSkipped(skip);
        setR((x) => ({ ...x, photo }));
        const m = st.recipes.find((x) => x.id === r.id);
        if (m) void st.saveRecipe({ ...m, photo }).catch(() => undefined);
      }
    } catch (e) { toast('err', errText(e)); }
    setAnother(false);
  };
  const [drawing, setDrawing] = useState(false);
  const keepPhoto = (photo: RecipePhoto | null) => {
    setR((x) => ({ ...x, photo }));
    const m = st.recipes.find((x) => x.id === r.id);
    if (m) void st.saveRecipe({ ...m, photo }).catch(() => undefined);
  };
  // A recipe without a photo yet (e.g. saved before photos existed): find one, and keep it with the saved recipe.
  // Then, when Settings → Cooking → Recipe pictures asks for it, an AI picture of the exact dish replaces it.
  useEffect(() => {
    let live = true;
    void (async () => {
      if (needsPhoto(r)) { const photo = await findPhoto(r); if (live) keepPhoto(photo); }
      if (st.settings.cooking.pictures === 'real' || r.photo?.ai) return;
      if (live) setDrawing(true);
      try { const photo = await drawPhoto(r); if (live && photo) keepPhoto(photo); } catch { /* daily limit or no key: the real photo stays */ }
      if (live) setDrawing(false);
    })();
    return () => { live = false; };
  }, [r.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const bannerSrc = useSrc(r.photo && r.photo.v ? r.photo.thumb : undefined);
  const fullSrc = useSrc(big && r.photo && r.photo.v ? r.photo.full : undefined);
  const [servings, setServings] = useState(r.servings);
  const [cook, setCook] = useState(false);
  const [eat, setEat] = useState(false);
  const [notes, setNotes] = useState(r.myNotes ?? '');
  const mine = st.recipes.find((x) => x.id === r.id || x.title === r.title);
  const factor = servings / r.servings;
  const miss = missingOf(r);
  const save = async (patch: Partial<Recipe> = {}) => {
    try { await st.saveRecipe({ ...r, ...mine, ...patch, id: mine?.id ?? `rc-${newId()}` }); if (!patch.rating && !patch.fav && !patch.cooked && !patch.myNotes) toast('ok', 'Saved to Recipes.'); } catch (e) { toast('err', errText(e)); }
  };
  const toList = async () => {
    const have = new Set(st.shopping.map((x) => x.name.toLowerCase()));
    const add: ShopItem[] = miss.filter((g) => !have.has(g.name.toLowerCase())).map((g) => ({ id: newId(), name: g.name, done: false, from: r.title }));
    try { await st.setShopping([...st.shopping, ...add]); toast('ok', add.length ? `Added ${add.length} to your shopping list.` : 'Already on your list.'); } catch (e) { toast('err', errText(e)); }
  };
  return (
    <Sheet title={r.title} onClose={onClose} wide>
      <div className="space-y-4">
        {r.photo && r.photo.v ? (
          <button className="tap relative block w-full overflow-hidden rounded-3xl" onClick={() => setBig(true)} aria-label={`See the photo of ${r.title} full screen`}>
            {bannerSrc ? <img src={bannerSrc} alt={r.title} className="h-48 w-full object-cover sm:h-60" /> : <div className="h-48 w-full animate-pulse" style={{ background: 'var(--trk)' }} />}
            {drawing && <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white"><span className="spinner !h-3 !w-3" /> Drawing this dish…</span>}
            <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">⤢ Full screen</span>
          </button>
        ) : needsPhoto(r) ? <div className="h-48 w-full animate-pulse rounded-3xl" style={{ background: 'var(--trk)' }} aria-hidden="true" /> : null}
        {r.photo && r.photo.v && (
          <p className="-mt-3 flex items-center justify-end gap-2 text-[10px] muted">
            <span>{r.photo.ai ? '🎨 Picture made by AI for this recipe' : `${r.photo.credit} · photo of a similar dish`}</span>
            {!r.photo.ai && <button className="font-bold underline" disabled={another} onClick={() => void anotherPhoto()}>{another ? 'Looking…' : '↻ Another photo'}</button>}
          </p>
        )}
        <p className="text-sm muted">{r.summary}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="chip !cursor-default">⏱ {r.minutes} min</span><span className="chip !cursor-default">{r.difficulty}</span>{r.cuisine && <span className="chip !cursor-default">{r.cuisine}</span>}
          {r.tags.map((t) => <span key={t} className="chip !cursor-default">{t}</span>)}
        </div>
        {r.allergyHits.length > 0 && <p className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">⚠️ This recipe has {r.allergyHits.join(', ')}: on your allergy list.</p>}
        <div className="rounded-3xl p-3" style={{ background: 'var(--trk)' }}>
          <p className="label">Per serving</p>
          <p className="num mt-1 text-2xl font-semibold">{kcalText(r.perServing.calories, st.settings.units)}</p>
          <MacroLine t={r.perServing} className="!text-sm" />
          <p className="mt-1 text-xs muted">Fiber {Math.round(r.perServing.fiber)} g · Sugar {Math.round(r.perServing.sugar)} g</p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="font-display text-[17px] font-semibold">Ingredients</h3>
            <div className="flex items-center gap-1.5">
              <button className="btn h-9 w-9 !min-h-0 !p-0" aria-label="Fewer servings" disabled={servings <= 1} onClick={() => setServings((n) => n - 1)}><Icon d={ICONS.minus} className="h-4 w-4" /></button>
              <span className="num w-20 text-center text-sm font-bold">{servings} serving{servings === 1 ? '' : 's'}</span>
              <button className="btn h-9 w-9 !min-h-0 !p-0" aria-label="More servings" disabled={servings >= 20} onClick={() => setServings((n) => n + 1)}><Icon d={ICONS.plus} className="h-4 w-4" /></button>
            </div>
          </div>
          <ul className="divide-y divide-stone-900/[0.06] dark:divide-white/[0.06]">
            {r.ingredients.map((g, i) => (
              <li key={i} className="flex items-start gap-2 py-2 text-sm">
                <span aria-hidden="true">{g.have ? '✅' : '🛒'}</span>
                <span className="min-w-0 flex-1"><b className="num font-semibold">{amount(g, factor)}</b> {g.name}{!g.have && <span className="font-bold text-orange-700 dark:text-orange-300"> · missing</span>}
                  {!g.have && g.sub && <span className="block text-xs muted">Swap: {g.sub}</span>}
                </span>
              </li>
            ))}
          </ul>
          {miss.length > 0 && <button className="btn mt-1 w-full" onClick={() => void toList()}>🛒 Add {miss.length} missing to my shopping list</button>}
        </div>

        <div>
          <h3 className="mb-1 font-display text-[17px] font-semibold">Steps</h3>
          <ol className="space-y-2">{r.steps.map((s, i) => <li key={i} className="flex gap-2.5 text-sm leading-relaxed"><span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-xs font-bold text-orange-800 dark:text-orange-200">{i + 1}</span><span>{s}</span></li>)}</ol>
          {r.tips.map((t) => <p key={t} className="mt-2 text-sm">💡 {t}</p>)}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary col-span-2 !min-h-[52px] text-base" onClick={() => setCook(true)}>👩‍🍳 Start cooking</button>
          <button className="btn" onClick={() => setEat(true)}>🍽️ Log this meal</button>
          {mine ? <button className="btn" onClick={() => void save({ fav: !mine.fav })}>{mine.fav ? '⭐ Favorite' : '☆ Make favorite'}</button> : <button className="btn" onClick={() => void save()}>💾 Save recipe</button>}
        </div>
        {mine && (
          <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--bd)' }}>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="My rating">
              <span className="mr-1 text-sm font-semibold">My rating</span>
              {[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={mine.rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={`tap h-10 w-9 rounded-xl text-2xl ${n <= (mine.rating ?? 0) ? 'text-amber-500' : 'text-stone-300 dark:text-stone-600'}`} onClick={() => void save({ rating: n })}>★</button>)}
            </div>
            <p className="text-xs muted">{mine.cooked ? `Cooked ${mine.cooked} time${mine.cooked > 1 ? 's' : ''}${mine.lastCooked ? `, last on ${mine.lastCooked}` : ''}.` : 'Not cooked yet.'}</p>
            <label className="block text-xs font-semibold muted">My notes<input className="input mt-1 w-full" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (mine.myNotes ?? '') && void save({ myNotes: notes })} placeholder="e.g. less salt next time, kids loved it" maxLength={300} /></label>
            <button className="btn-ghost text-red-700 dark:text-red-300" onClick={() => { if (confirm(`Remove “${r.title}” from Recipes?`)) void st.deleteRecipe(mine.id).then(onClose).catch((e) => toast('err', errText(e))); }}><Icon d={ICONS.trash} className="h-4 w-4" /> Remove from Recipes</button>
          </div>
        )}
        <p className="text-center text-[11px] muted">{r.by ?? ''}{saved ? '' : ' · nutrition is an estimate'}</p>
      </div>
      {cook && <CookMode r={r} factor={factor} onClose={() => setCook(false)} onDone={() => { setCook(false); setEat(true); if (mine) void save({ cooked: (mine.cooked ?? 0) + 1, lastCooked: todayStr() }); }} />}
      {eat && <EatSheet r={r} onClose={() => setEat(false)} />}
      {big && bannerSrc && fullSrc && r.photo && <PhotoViewer thumb={bannerSrc} full={fullSrc} alt={r.title} credit={r.photo.credit} onClose={() => setBig(false)} />}
    </Sheet>
  );
}

/** 🍽️ Log this meal in Calories (no AI: the recipe's numbers × servings eaten). */
function EatSheet({ r, onClose }: { r: Recipe; onClose: () => void }) {
  const st = useStore();
  const [n, setN] = useState(1);
  const [busy, setBusy] = useState(false);
  const p = r.perServing;
  const k = (x: number) => Math.round(x * n * 10) / 10;
  const log = async () => {
    setBusy(true);
    const time = nowTime();
    const e: Entry = { id: newId(), date: todayStr(), time, meal: mealAt(time, st.settings.meals), title: r.title, source: 'manual', by: 'From a recipe', createdAt: new Date().toISOString(),
      items: [{ name: r.title, portion: `${n} serving${n === 1 ? '' : 's'}`, grams: 0, calories: Math.round(p.calories * n), protein: k(p.protein), carbs: k(p.carbs), fat: k(p.fat), fiber: k(p.fiber), sugar: k(p.sugar), confidence: 80 }] };
    try { await st.saveEntry(e); toast('ok', `Logged in Calories: ${Math.round(p.calories * n)} kcal.`); onClose(); } catch (x) { toast('err', errText(x)); }
    setBusy(false);
  };
  return (
    <Sheet title="Log this meal" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm">How much did you eat?</p>
        <div className="flex flex-wrap gap-2">{[0.5, 1, 1.5, 2].map((x) => <button key={x} className={`chip !px-4 !py-2 text-sm ${n === x ? '!border-transparent bg-gradient-to-br from-orange-300 to-orange-500 text-[#2b1203]' : ''}`} onClick={() => setN(x)}>{x} serving{x === 1 ? '' : 's'}</button>)}</div>
        <p className="num text-xl font-semibold">{Math.round(p.calories * n)} kcal</p>
        <MacroLine t={{ calories: p.calories * n, protein: p.protein * n, carbs: p.carbs * n, fat: p.fat * n, fiber: p.fiber * n, sugar: p.sugar * n }} />
        <button className="btn-primary w-full" disabled={busy} onClick={() => void log()}>{busy ? <span className="spinner" /> : 'Add to today in Calories'}</button>
      </div>
    </Sheet>
  );
}

/** Minutes mentioned in a step ("simmer 10–12 minutes" → 12). */
export function stepMinutes(s: string): number | null {
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:[-–to]+\s*(\d+(?:\.\d+)?))?\s*(min|minute|minutes|mins|hour|hours|hr|hrs)\b/i);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]);
  return /^h/i.test(m[3]) ? n * 60 : n;
}

/** 👩‍🍳 Cook mode: one big step at a time, the screen stays on, tap a timer. */
function CookMode({ r, factor, onClose, onDone }: { r: Recipe; factor: number; onClose: () => void; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    void nav.wakeLock?.request('screen').then((l) => { lock.current = l; }).catch(() => undefined);
    return () => void lock.current?.release().catch(() => undefined);
  }, []);
  // Escape / the phone's back button closes cook mode only (not the recipe under it).
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);
  useEffect(() => {
    if (left == null) return;
    if (left <= 0) {
      try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch { /* not on this phone */ }
      try { const a = new AudioContext(); const o = a.createOscillator(); o.frequency.value = 880; o.connect(a.destination); o.start(); setTimeout(() => { o.stop(); void a.close(); }, 900); } catch { /* no sound */ }
      toast('info', '⏰ Timer done!');
      setLeft(null);
      return;
    }
    const t = setTimeout(() => setLeft((x) => (x == null ? null : x - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const step = r.steps[i];
  const mins = useMemo(() => stepMinutes(step), [step]);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fbf5ef] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] animate-[fade_.25s_ease-out] dark:bg-[#0f0905]" role="dialog" aria-modal="true" aria-label={`Cooking ${r.title}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="label">Step {i + 1} of {r.steps.length}</p>
        <button className="btn h-10 w-10 !min-h-0 !rounded-full !p-0" aria-label="Close cook mode" onClick={onClose}><Icon d={ICONS.close} className="h-4 w-4" stroke={2.4} /></button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--trk)' }}><div className="h-full rounded-full bg-gradient-to-r from-orange-300 to-orange-500 transition-[width] duration-500" style={{ width: `${((i + 1) / r.steps.length) * 100}%` }} /></div>
      <div key={i} className="rise flex flex-1 flex-col justify-center overflow-y-auto py-6">
        <p className="font-display text-[26px] font-semibold leading-snug">{step}</p>
        {mins && (
          <button className={`btn-primary mt-6 self-start !min-h-[56px] !rounded-full px-6 text-lg ${left != null ? 'animate-pulse' : ''}`} onClick={() => setLeft(left == null ? Math.round(mins * 60) : null)}>
            ⏱ {left != null ? `${mmss(left)} · tap to stop` : `Start a ${mins} min timer`}
          </button>
        )}
      </div>
      {show && (
        <ul className="rise mb-3 max-h-[35vh] overflow-y-auto rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--bd)' }}>
          {r.ingredients.map((g, k) => <li key={k} className="py-0.5"><b className="num">{amount(g, factor)}</b> {g.name}</li>)}
        </ul>
      )}
      <button className="btn-ghost mb-2 self-center text-sm" onClick={() => setShow((x) => !x)}>{show ? 'Hide' : 'Show'} ingredients</button>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn !min-h-[56px]" disabled={i === 0} onClick={() => setI((x) => x - 1)}><Icon d={ICONS.left} /> Back</button>
        {i < r.steps.length - 1
          ? <button className="btn-primary !min-h-[56px] text-base" onClick={() => setI((x) => x + 1)}>Next <Icon d={ICONS.right} /></button>
          : <button className="btn-primary !min-h-[56px] text-base" onClick={onDone}>🎉 Done</button>}
      </div>
    </div>,
    document.body,
  );
}

/** Type ingredients as chips (Enter or comma adds one). */
export function ChipInput({ values, onChange, placeholder, label }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; label: string }) {
  const [t, setT] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
    const next = [...values];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setT('');
  };
  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => <span key={v} className="chip !cursor-default !py-1.5 !pl-3 text-sm">{v}<button className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-stone-500 hover:text-red-600" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button></span>)}
        </div>
      )}
      <div className="flex gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">{label}</span>
          <input className="input w-full" value={t} placeholder={placeholder} onChange={(e) => (/[,;]$/.test(e.target.value) ? add(e.target.value) : setT(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter' && t.trim()) { e.preventDefault(); add(t); } }} />
        </label>
        <button className="btn" disabled={!t.trim()} onClick={() => add(t)} aria-label={`Add to ${label}`}><Icon d={ICONS.plus} /></button>
      </div>
    </div>
  );
}
