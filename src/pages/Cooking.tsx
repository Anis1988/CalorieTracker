import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore, dayOf } from '../lib/store';
import { api, errText, newId } from '../lib/api';
import { forAi, thumb } from '../lib/image';
import { todayStr } from '../lib/date';
import { macroGoals, sum } from '../lib/nutrition';
import { CUISINES, MEAL_KINDS, type Provider, type Recipe, type RecipeSearch } from '../lib/types';
import { ChipInput, RecipeCard, RecipeSheet } from '../components/Cooking';
import { Fold, ICONS, Icon, Toggle, toast } from '../components/ui';

/** 🍳 Cook: what you have (typed, your pantry, photos) → recipes, the ones you can make now first. */
export function CookHome({ snap, setSnap }: { snap: boolean; setSnap: (v: boolean) => void }) {
  const st = useStore();
  const c = st.settings.cooking;
  const [items, setItems] = useState<string[]>(() => { try { return JSON.parse(sessionStorage.getItem('ct.cookItems') ?? '[]'); } catch { return []; } });
  const [pics, setPics] = useState<{ ai: string; small: string }[]>([]);
  const [usePantry, setUsePantry] = useState(true);
  const [meal, setMeal] = useState('Any');
  const [cuisine, setCuisine] = useState('Any');
  const [minutes, setMinutes] = useState(0);
  const [servings, setServings] = useState(c.servings);
  const [fit, setFit] = useState(c.fitDay);
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<RecipeSearch | null>(() => { try { return JSON.parse(sessionStorage.getItem('ct.cookRes') ?? 'null'); } catch { return null; } });
  const [open, setOpen] = useState<Recipe | null>(null);
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const out = useRef<HTMLDivElement>(null);

  useEffect(() => { try { sessionStorage.setItem('ct.cookItems', JSON.stringify(items)); } catch { /* private mode */ } }, [items]);
  useEffect(() => { if (snap) { cam.current?.click(); setSnap(false); } }, [snap, setSnap]);

  // What's left of today in Calories (for "Fit my day").
  const g = macroGoals(st.settings);
  const eaten = sum(dayOf(st.days, todayStr()).entries.flatMap((e) => e.items));
  const leftKcal = Math.max(0, g.calories - eaten.calories);
  const leftProtein = Math.max(0, g.protein - eaten.protein);

  const add = async (files: FileList | null) => {
    const list = [...(files ?? [])].slice(0, 3 - pics.length);
    try { const o = await Promise.all(list.map(async (f) => ({ ai: await forAi(f), small: await thumb(f) }))); setPics((p) => [...p, ...o].slice(0, 3)); } catch (e) { toast('err', errText(e)); }
  };
  const all = [...items, ...(usePantry ? st.pantry.filter((p) => !items.some((x) => x.toLowerCase() === p.toLowerCase())) : [])];
  const find = async (model?: Provider) => {
    setBusy(true); setErr('');
    try {
      const r = await api.findRecipes({ ingredients: all, images: pics.map((p) => p.ai), meal, cuisine, minutes, servings, kcal: fit ? leftKcal : 0, protein: fit ? leftProtein : 0, wish: wish.trim() || undefined, model });
      setRes(r);
      try { sessionStorage.setItem('ct.cookRes', JSON.stringify(r)); } catch { /* too big or private mode */ }
      setTimeout(() => out.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (e) { setErr(errText(e)); }
    setBusy(false);
  };
  const other: Provider = st.settings.ai.provider === 'gemini' ? 'claude' : 'gemini';
  const now = res?.recipes.filter((r) => r.ingredients.every((x) => x.have)) ?? [];
  const more = res?.recipes.filter((r) => !r.ingredients.every((x) => x.have)) ?? [];

  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      <input ref={gal} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />

      <section className="card rise space-y-3">
        <h1 className="text-2xl font-semibold">What do you have?</h1>
        <ChipInput label="ingredients" values={items} onChange={setItems} placeholder="e.g. chicken, rice, spinach, lemon" />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn !min-h-[52px]" onClick={() => cam.current?.click()} disabled={pics.length >= 3}><Icon d={ICONS.camera} /> Snap ingredients</button>
          <button className="btn !min-h-[52px]" onClick={() => gal.current?.click()} disabled={pics.length >= 3}><Icon d={ICONS.image} /> From gallery</button>
        </div>
        {pics.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {pics.map((p, i) => (
              <div key={i} className="relative"><img src={p.small} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-2xl object-cover" />
                <button className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white" aria-label={`Remove photo ${i + 1}`} onClick={() => setPics((l) => l.filter((_, j) => j !== i))}><Icon d={ICONS.close} className="h-4 w-4" stroke={2.4} /></button>
              </div>
            ))}
          </div>
        )}
        {st.pantry.length > 0 && <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Use my pantry ({st.pantry.length} items)</span><Toggle on={usePantry} onChange={setUsePantry} label="Use my pantry" /></div>}
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-sm"><b>Fit my day</b><span className="block text-xs muted">{leftKcal ? `About ${leftKcal} kcal and ${leftProtein} g protein left today` : 'Nothing left of today’s calories'}</span></span>
          <Toggle on={fit} onChange={setFit} label="Fit my day" />
        </div>
        <Fold title="More options" subtitle={[meal !== 'Any' && meal, cuisine !== 'Any' && cuisine, minutes && `${minutes} min`, `${servings} servings`].filter(Boolean).join(' · ')}>
          <p className="text-xs font-semibold muted">Meal</p>
          <div className="flex flex-wrap gap-1.5">{MEAL_KINDS.map((m) => <Pill key={m} on={meal === m} onClick={() => setMeal(m)}>{m}</Pill>)}</div>
          <p className="pt-2 text-xs font-semibold muted">Time</p>
          <div className="flex flex-wrap gap-1.5">{[0, 15, 30, 45, 60].map((m) => <Pill key={m} on={minutes === m} onClick={() => setMinutes(m)}>{m ? `≤ ${m} min` : 'Any'}</Pill>)}</div>
          <p className="pt-2 text-xs font-semibold muted">Cuisine</p>
          <div className="flex flex-wrap gap-1.5">{CUISINES.map((m) => <Pill key={m} on={cuisine === m} onClick={() => setCuisine(m)}>{m}</Pill>)}</div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-sm font-semibold">Servings</span>
            <span className="flex items-center gap-1.5">
              <button className="btn h-9 w-9 !min-h-0 !p-0" aria-label="Fewer servings" disabled={servings <= 1} onClick={() => setServings((n) => n - 1)}><Icon d={ICONS.minus} className="h-4 w-4" /></button>
              <span className="num w-6 text-center font-bold">{servings}</span>
              <button className="btn h-9 w-9 !min-h-0 !p-0" aria-label="More servings" disabled={servings >= 12} onClick={() => setServings((n) => n + 1)}><Icon d={ICONS.plus} className="h-4 w-4" /></button>
            </span>
          </div>
          <label className="block pt-2 text-xs font-semibold muted">Anything special?<input className="input mt-1 w-full" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="e.g. something spicy, kid-friendly, one pan" maxLength={200} /></label>
        </Fold>
        {err && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            <p>{err}</p>
            {st.status?.keys[other] && <button className="btn mt-2 !min-h-[38px] text-xs" onClick={() => void find(other)}>Try {other === 'claude' ? 'Claude' : 'Gemini'} this once</button>}
          </div>
        )}
        <button className="btn-primary w-full !min-h-[56px] text-base" disabled={busy || (!all.length && !pics.length)} onClick={() => void find()}>{busy ? <><span className="spinner" /> Cooking up ideas…</> : '🍳 Find recipes'}</button>
        {busy && <p className="text-center text-xs muted">This takes about 20–60 seconds: the AI writes each recipe in full.</p>}
      </section>

      <div ref={out} className="scroll-mt-20" />
      {res && !busy && (
        <>
          {res.detected.length > 0 && (
            <section className="card rise !py-3">
              <p className="text-sm font-bold">👀 I can see</p>
              <p className="mt-1 text-sm">{res.detected.join(', ')}</p>
              <button className="btn-ghost -ml-2 mt-1 text-xs" onClick={() => setItems([...new Set([...items, ...res.detected])])}><Icon d={ICONS.plus} className="h-4 w-4" /> Add these to my list (to edit them)</button>
            </section>
          )}
          {now.length > 0 && <h2 className="rise pt-1 font-display text-lg font-semibold">✅ Make it now</h2>}
          {now.map((r) => <RecipeCard key={r.id} r={r} onOpen={() => setOpen({ ...r, by: res.by })} />)}
          {more.length > 0 && <h2 className="rise pt-1 font-display text-lg font-semibold">🛒 Need 1–2 more things</h2>}
          {more.map((r) => <RecipeCard key={r.id} r={r} onOpen={() => setOpen({ ...r, by: res.by })} />)}
          {!res.recipes.length && <p className="card text-sm muted">No recipes came back. Add a few more ingredients and try again.</p>}
          <p className="text-center text-[11px] muted">{res.by}{res.cached ? ' · remembered (free)' : ''}{res.note ? ` · ${res.note}` : ''}</p>
        </>
      )}
      {open && <RecipeSheet r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const Pill = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button className={`chip !px-3 !py-1.5 text-[13px] ${on ? '!border-transparent bg-gradient-to-br from-orange-300 to-orange-500 text-[#2b1203]' : ''}`} aria-pressed={on} onClick={onClick}>{children}</button>
);

/** 📖 Recipes: the ones you saved, with favorites, ratings and how often you cooked them. */
export function Recipes() {
  const st = useStore();
  const [f, setF] = useState<'all' | 'fav' | 'cooked'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Recipe | null>(null);
  const list = st.recipes.filter((r) => (f === 'all' || (f === 'fav' ? r.fav : (r.cooked ?? 0) > 0)) && (!q.trim() || `${r.title} ${r.cuisine} ${r.tags.join(' ')} ${r.ingredients.map((g) => g.name).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      <h1 className="text-2xl font-semibold">My recipes</h1>
      <div className="flex flex-wrap gap-1.5">
        {([['all', `All ${st.recipes.length}`], ['fav', `⭐ Favorites ${st.recipes.filter((r) => r.fav).length}`], ['cooked', `👩‍🍳 Cooked ${st.recipes.filter((r) => r.cooked).length}`]] as const).map(([id, l]) => <Pill key={id} on={f === id} onClick={() => setF(id)}>{l}</Pill>)}
      </div>
      {st.recipes.length > 4 && <label className="block"><span className="sr-only">Search my recipes</span><input className="input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a dish or an ingredient" /></label>}
      {list.map((r) => <RecipeCard key={r.id} r={r} onOpen={() => setOpen(r)} />)}
      {!list.length && <p className="card text-sm muted">{st.recipes.length ? 'Nothing here.' : 'Recipes you save from Cook show here: tap “💾 Save recipe” on one you like.'}</p>}
      {open && <RecipeSheet r={open} saved onClose={() => setOpen(null)} />}
    </div>
  );
}

/** 🧺 Pantry: what you always have (used by Cook), and the shopping list. */
export function Pantry() {
  const st = useStore();
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState<string[] | null>(null);
  const [newItem, setNewItem] = useState('');
  const cam = useRef<HTMLInputElement>(null);
  const save = (l: string[]) => void st.setPantry(l).catch((e) => toast('err', errText(e)));
  const [kind, setKind] = useState<'kitchen' | 'receipt'>('kitchen');
  const rec = useRef<HTMLInputElement>(null);
  const recGal = useRef<HTMLInputElement>(null);
  const [done, setDone] = useState<{ added: string[]; ticked: string[]; undo: () => void } | null>(null);
  const scan = async (files: FileList | null, k: 'kitchen' | 'receipt') => {
    const list = [...(files ?? [])].slice(0, 3);
    if (!list.length) return;
    setBusy(true); setKind(k);
    try {
      const r = await api.seeIngredients(await Promise.all(list.map(forAi)), k);
      const fresh = r.items.filter((x) => !st.pantry.some((p) => p.toLowerCase() === x.toLowerCase()));
      // A receipt goes straight into the pantry (non-food is already left out); a fridge photo is shown first.
      if (k === 'receipt') addReceipt(fresh); else setSeen(fresh);
    } catch (e) { toast('err', errText(e)); }
    setBusy(false);
  };
  const addSeen = (items: string[]) => { save([...st.pantry, ...items]); toast('ok', `Added ${items.length} to your pantry.`); };
  // 🧾 Receipt: everything bought goes into the pantry, and it's ticked on the shopping list (loose match:
  // "spinach" ticks "baby spinach"). One tap undoes it.
  const addReceipt = (items: string[]) => {
    const pantryBefore = st.pantry, shopBefore = st.shopping;
    const low = items.map((x) => x.toLowerCase());
    const hit = (n: string) => low.some((x) => x.includes(n.toLowerCase()) || n.toLowerCase().includes(x));
    const ticked = st.shopping.filter((x) => !x.done && hit(x.name));
    if (items.length) save([...st.pantry, ...items]);
    if (ticked.length) setShop(st.shopping.map((x) => (ticked.includes(x) ? { ...x, done: true } : x)));
    setDone({ added: items, ticked: ticked.map((x) => x.name), undo: () => { save(pantryBefore); setShop(shopBefore); setDone(null); toast('info', 'Undone.'); } });
  };
  const shop = st.shopping;
  const setShop = (l: typeof shop) => void st.setShopping(l).catch((e) => toast('err', errText(e)));
  const share = async () => {
    const text = `🛒 Shopping list\n${shop.filter((x) => !x.done).map((x) => `• ${x.name}`).join('\n')}`;
    try { if (navigator.share) await navigator.share({ title: 'Shopping list', text }); else { await navigator.clipboard.writeText(text); toast('ok', 'Copied: paste it in a message or a note.'); } } catch { /* cancelled */ }
  };
  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void scan(e.target.files, 'kitchen'); e.target.value = ''; }} />
      <input ref={rec} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void scan(e.target.files, 'receipt'); e.target.value = ''; }} />
      <input ref={recGal} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void scan(e.target.files, 'receipt'); e.target.value = ''; }} />
      <h1 className="text-2xl font-semibold">Pantry</h1>
      <section className="card rise space-y-3">
        <div className="flex items-baseline justify-between"><h2 className="font-display text-[17px] font-semibold">🧺 What I have</h2><span className="text-xs muted">{st.pantry.length} items</span></div>
        <p className="text-xs muted">Cook uses these every time (turn it off there). Salt, oil and other staples are in Settings → Cooking.</p>
        <ChipInput label="pantry" values={st.pantry} onChange={save} placeholder="e.g. rice, eggs, canned tomatoes" />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn !min-h-[52px]" disabled={busy} onClick={() => cam.current?.click()}>{busy && kind === 'kitchen' ? <><span className="spinner" /> Looking…</> : <><Icon d={ICONS.camera} /> Snap my fridge</>}</button>
          <button className="btn !min-h-[52px]" disabled={busy} onClick={() => rec.current?.click()}>{busy && kind === 'receipt' ? <><span className="spinner" /> Reading…</> : <>🧾 Scan a receipt</>}</button>
        </div>
        <button className="btn-ghost -mt-1 text-xs" disabled={busy} onClick={() => recGal.current?.click()}><Icon d={ICONS.image} className="h-4 w-4" /> Receipt photo from the gallery (a long receipt can be up to 3 photos)</button>
        {done && (
          <div className="rise space-y-2 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 p-3 text-sm">
            <p className="font-bold">{done.added.length ? `🧾 Added ${done.added.length} to your pantry` : '🧾 Everything on it is already in your pantry'}</p>
            {done.added.length > 0 && <p>{done.added.join(', ')}</p>}
            {done.ticked.length > 0 && <p className="text-xs muted">✅ Ticked on your shopping list: {done.ticked.join(', ')}</p>}
            <p className="text-xs muted">Non-food items (bags, soap, tax…) were left out.</p>
            <div className="flex gap-2"><button className="btn !min-h-[38px] text-xs" onClick={done.undo}>Undo</button><button className="btn !min-h-[38px] text-xs" onClick={() => setDone(null)}>OK</button></div>
          </div>
        )}
        {seen && (
          <div className="rise space-y-2 rounded-2xl border p-3" style={{ borderColor: 'var(--bd)' }}>
            <p className="text-sm font-bold">{!seen.length ? '👀 Everything in the photo is already in your pantry.' : `👀 Found ${seen.length} new item${seen.length === 1 ? '' : 's'}. Tap one to leave it out.`}</p>
            <div className="flex flex-wrap gap-1.5">{seen.map((x) => <button key={x} className="chip !px-3 !py-1.5" onClick={() => setSeen(seen.filter((y) => y !== x))}>{x} ×</button>)}</div>
            <div className="flex gap-2"><button className="btn-primary flex-1" disabled={!seen.length} onClick={() => { addSeen(seen); setSeen(null); }}>Add to my pantry</button><button className="btn" onClick={() => setSeen(null)}>Cancel</button></div>
          </div>
        )}
        {st.pantry.length > 0 && <button className="btn-ghost -ml-2 text-xs text-red-700 dark:text-red-300" onClick={() => confirm('Empty the pantry?') && save([])}><Icon d={ICONS.trash} className="h-4 w-4" /> Empty the pantry</button>}
      </section>

      <section className="card rise rise-1 space-y-2">
        <div className="flex items-baseline justify-between"><h2 className="font-display text-[17px] font-semibold">🛒 Shopping list</h2><span className="text-xs muted">{shop.filter((x) => !x.done).length} to buy</span></div>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1"><span className="sr-only">Add to the shopping list</span><input className="input w-full" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add something" onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) { setShop([...shop, { id: newId(), name: newItem.trim(), done: false }]); setNewItem(''); } }} /></label>
          <button className="btn" disabled={!newItem.trim()} aria-label="Add to the shopping list" onClick={() => { setShop([...shop, { id: newId(), name: newItem.trim(), done: false }]); setNewItem(''); }}><Icon d={ICONS.plus} /></button>
        </div>
        <ul>
          {shop.map((x) => (
            <li key={x.id} className="flex items-center gap-2 border-t py-1.5 first:border-0" style={{ borderColor: 'var(--trk)' }}>
              <button role="checkbox" aria-checked={x.done} aria-label={x.name} className={`tap flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${x.done ? 'border-transparent bg-orange-500 text-white' : ''}`} style={x.done ? undefined : { borderColor: 'var(--bd)' }} onClick={() => setShop(shop.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)))}>{x.done && <Icon d={ICONS.check} className="pop-in h-4 w-4" stroke={3} />}</button>
              <span className={`min-w-0 flex-1 text-sm ${x.done ? 'line-through muted' : 'font-semibold'}`}>{x.name}{x.from && <span className="block text-[11px] font-normal muted">for {x.from}</span>}</span>
              <button className="btn-ghost" aria-label={`Remove ${x.name}`} onClick={() => setShop(shop.filter((y) => y.id !== x.id))}><Icon d={ICONS.close} className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        {!shop.length && <p className="text-sm muted">Empty. Recipes can add what’s missing with one tap.</p>}
        {shop.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn" onClick={() => void share()}>📤 Share the list</button>
            {shop.some((x) => x.done) && <button className="btn" onClick={() => { const got = shop.filter((x) => x.done).map((x) => x.name); save([...st.pantry, ...got.filter((g) => !st.pantry.some((p) => p.toLowerCase() === g.toLowerCase()))]); setShop(shop.filter((x) => !x.done)); toast('ok', `${got.length} moved to your pantry.`); }}>✅ Bought: move to pantry</button>}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- 📖 the Cooking guide (made-up recipe, no working buttons) ---------- */
const EX: Recipe = {
  id: 'g1', title: 'Lemon Garlic Chicken & Rice', summary: 'Juicy one-pan chicken with fluffy lemony rice and wilted spinach.', cuisine: 'Mediterranean', meal: 'Dinner', minutes: 35, difficulty: 'easy', servings: 2,
  perServing: { calories: 560, protein: 42, carbs: 58, fat: 16, fiber: 3, sugar: 2 },
  ingredients: [{ name: 'chicken breast', qty: 300, unit: 'g', have: true, sub: '' }, { name: 'rice', qty: 150, unit: 'g', have: true, sub: '' }, { name: 'spinach', qty: 2, unit: 'cups', have: true, sub: '' }, { name: 'lemon', qty: 1, unit: 'piece', have: false, sub: '2 tbsp vinegar' }],
  steps: ['Brown the chicken 6 minutes a side.', 'Add rice and stock, simmer 15 minutes.'], tips: [], tags: ['One pan', 'High protein'], allergyHits: [],
};
const Example = ({ children, caption }: { children: ReactNode; caption: string }) => (
  <figure className="space-y-1.5"><div className="pointer-events-none select-none rounded-2xl border border-dashed p-2" style={{ borderColor: 'var(--bd)' }} aria-hidden="true">{children}</div><figcaption className="text-xs muted">{caption}</figcaption></figure>
);
const P = ({ children }: { children: ReactNode }) => <p className="text-[15px] leading-relaxed text-stone-700 dark:text-stone-300">{children}</p>;

export function CookingGuide() {
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-semibold">Cooking guide</h1>
      <p className="text-sm muted">How the 🍳 Cooking side works. Tap a topic.</p>
      <Fold icon="✨" title="What it does" open>
        <P>Tell it what you have (type it, snap your fridge or counter, or use your pantry) and it suggests recipes, with calories, protein, carbs and fat <b>per serving</b>. Recipes you can make <b>right now</b> come first; then ones that need just 1 or 2 more things, with an easy swap when there is one.</P>
        <Example caption="Made-up recipe that needs one more thing."><RecipeCard r={EX} /></Example>
      </Fold>
      <Fold icon="🔎" title="Finding recipes">
        <P>Type ingredients (press Enter or a comma after each), tap <b>Snap ingredients</b> (up to 3 photos), or both. <b>More options</b>: meal, time, cuisine, servings, and anything special (“spicy”, “kid-friendly”).</P>
        <P><b>Fit my day</b> uses what’s left of today in 🥗 Calories, so the recipes fit your goal (and help your protein). It takes 20 to 60 seconds: the AI writes every recipe in full. The same search again is free.</P>
      </Fold>
      <Fold icon="👩‍🍳" title="Cooking a recipe">
        <P>Open a recipe to see the ingredients (✅ have, 🛒 missing, with swaps), the steps and the nutrition. Change the servings with − and +: the amounts follow.</P>
        <P><b>Start cooking</b> shows one big step at a time and keeps your screen on. When a step says “10 minutes”, tap the timer: the phone buzzes and beeps when it’s done. At the end you can log what you ate.</P>
      </Fold>
      <Fold icon="🍽️" title="Logging it in Calories">
        <P><b>Log this meal</b> adds it to today in 🥗 Calories (½, 1, 1½ or 2 servings), with the recipe’s numbers. No AI, no cost.</P>
      </Fold>
      <Fold icon="📖" title="Recipes, pantry and shopping">
        <P><b>💾 Save recipe</b> keeps it in the Recipes tab: make it a ⭐ favorite, rate it, add notes; it counts how often you cooked it.</P>
        <P><b>Pantry</b>: what you always have (type it or snap your fridge). Cook adds it to every search. Back from the shop? Tap <b>🧾 Scan a receipt</b> and take a photo of it: all the food you bought goes straight into your pantry (bags, soap and other non-food are left out) and is ticked on your shopping list. Something wrong? Tap <b>Undo</b>. <b>Shopping list</b>: tap “Add missing to my shopping list” on a recipe, tick things off in the shop, share the list, and move what you bought to the pantry.</P>
      </Fold>
      <Fold icon="⚙️" title="Your kitchen (Settings → Cooking)">
        <P>Diet (vegetarian, halal, keto…), allergies, foods you don’t like, your kitchen tools (air fryer, oven…), staples you always have, servings, time limit, how hard, how many recipes, and metric or US cups.</P>
        <P><b>Allergies are checked twice</b>: the AI is told never to use them, and every ingredient is checked again word by word. A recipe that still has one shows ⚠️ in red and goes last.</P>
      </Fold>
      <Fold icon="🤖" title="The AI">
        <P>Recipes are written by the AI you choose in Settings → AI, the same one for 🥗 Calories, 💄 Beauty and 🍳 Cooking. Pick Claude (and Sonnet or Opus) to use it everywhere. A search is one AI read; Claude Sonnet costs a few cents, Opus a bit more.</P>
      </Fold>
    </div>
  );
}
