import { useEffect, useMemo, useRef, useState } from 'react';
import { api, errText, newId } from '../lib/api';
import { forAi, thumb } from '../lib/image';
import { canReadBarcodes, digits, readBarcode } from '../lib/barcode';
import { addDays, nowTime, todayStr } from '../lib/date';
import { useStore } from '../lib/store';
import { mealAt, kcalText, sum } from '../lib/nutrition';
import { MEALS, type Analysis, type Entry, type Food, type Meal, type Provider, type Source } from '../lib/types';
import { EntryRow, FoodEditor, HealthBadge, MacroLine } from './Food';
import { ICONS, Icon, Seg, Sheet, Skeleton, Toggle, toast } from './ui';

export type AddMode = 'pick' | 'photo' | 'gallery' | 'text' | 'barcode' | 'favorites';

/** ➕ Add food: photo (camera or gallery), a few words, a barcode, or a favorite. */
export function AddSheet({ date, mode: start = 'pick', onClose }: { date: string; mode?: AddMode; onClose: () => void }) {
  const st = useStore();
  const s = st.settings;
  const [stage, setStage] = useState<'pick' | 'text' | 'barcode' | 'favorites' | 'note' | 'reading' | 'review'>('pick');
  const [image, setImage] = useState<{ ai: string; small: string } | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<Analysis | null>(null);
  const [source, setSource] = useState<Source>('photo');
  const [error, setError] = useState<string | null>(null);
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (start === 'photo') cam.current?.click();
    else if (start === 'gallery') gal.current?.click();
    else if (start === 'text' || start === 'barcode' || start === 'favorites') setStage(start);
  }, [start]);

  const read = async (b: { image?: string; text?: string; note?: string; model?: Provider }) => {
    setStage('reading');
    setError(null);
    try {
      const r = await api.analyze(b);
      setResult(r);
      if (!r.items.length) { setStage('review'); return; }
      if (!s.ai.review) return void (await save(r, b.image ? image?.small : undefined));
      setStage('review');
    } catch (e) {
      setError(errText(e));
      setStage(b.image ? 'note' : 'text');
    }
  };

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const ai = await forAi(f);
      const small = await thumb(f);
      setImage({ ai, small });
      setSource('photo');
      if (s.ai.askNote) setStage('note');
      else void read({ image: ai });
    } catch (e) { toast('err', errText(e)); }
  };

  const save = async (r: Analysis, photo?: string) => {
    const time = date === todayStr() ? nowTime() : '12:00';
    const e: Entry = { id: newId(), date, time, meal: mealAt(time, s.meals), title: r.title, items: r.items, source, by: r.by, healthScore: r.healthScore, notes: r.notes, createdAt: new Date().toISOString() };
    try { await st.saveEntry(e, photo); toast('ok', `Saved: ${r.title}, ${kcalText(sum(r.items).calories, s.units)}`); onClose(); } catch (err) { toast('err', errText(err)); }
  };

  const title = stage === 'review' ? 'Check and save' : stage === 'reading' ? 'Reading your food…' : stage === 'text' ? 'Describe it' : stage === 'barcode' ? 'Scan a barcode' : stage === 'favorites' ? 'Favorites & recent' : stage === 'note' ? 'Anything to add?' : 'Add food';

  return (
    <Sheet title={title} onClose={onClose}>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
      <input ref={gal} type="file" accept="image/*" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />

      {stage === 'pick' && (
        <div className="space-y-3">
          <button className="btn-primary w-full !min-h-[64px] text-base" onClick={() => cam.current?.click()}><Icon d={ICONS.camera} className="h-6 w-6" /> Take a photo</button>
          <div className="grid grid-cols-2 gap-2">
            <BigChoice icon={ICONS.image} label="From gallery" onClick={() => gal.current?.click()} />
            <BigChoice icon={ICONS.pen} label="Describe it" onClick={() => setStage('text')} />
            <BigChoice icon={ICONS.barcode} label="Barcode" onClick={() => setStage('barcode')} />
            <BigChoice icon={ICONS.star} label="Favorites" onClick={() => setStage('favorites')} />
          </div>
          <p className="text-xs muted">The AI lists every food it sees with its portion, calories, protein, carbs and fat. You can fix anything before saving.</p>
        </div>
      )}

      {stage === 'note' && image && (
        <div className="space-y-3">
          <img src={image.small} alt="Your food" className="mx-auto max-h-56 rounded-3xl object-cover" />
          <label className="block text-sm font-semibold">Anything the photo doesn’t show? (optional)
            <input className="input mt-1 w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. no dressing, I ate half, 2 servings" maxLength={300} />
          </label>
          {error && <ErrorBox text={error} onOther={(m) => void read({ image: image.ai, note, model: m })} />}
          <button className="btn-primary w-full" onClick={() => void read({ image: image.ai, note })}>Read my food</button>
        </div>
      )}

      {stage === 'text' && (
        <div className="space-y-3">
          <label className="block text-sm font-semibold">What did you eat or drink?
            <textarea className="input mt-1 min-h-[110px] w-full py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 2 scrambled eggs, 1 slice of toast with butter and a latte" maxLength={1000} />
          </label>
          {error && <ErrorBox text={error} onOther={(m) => void read({ text, model: m })} />}
          <button className="btn-primary w-full" disabled={text.trim().length < 2} onClick={() => { setSource('text'); setImage(null); void read({ text }); }}>Work it out</button>
        </div>
      )}

      {stage === 'barcode' && <Barcode onFound={(r) => { setSource('barcode'); setImage(null); setResult(r); setStage('review'); }} />}

      {stage === 'favorites' && <Favorites date={date} onPick={(r) => { setSource('favorite'); setImage(null); setResult(r); setStage('review'); }} />}

      {stage === 'reading' && (
        <div className="space-y-4 py-2 text-center">
          {image ? (
            <div className="relative mx-auto w-fit overflow-hidden rounded-3xl">
              <img src={image.small} alt="Your food" className="max-h-64 object-cover" />
              <div className="scan pointer-events-none absolute inset-x-0 top-0 h-full" aria-hidden="true" />
            </div>
          ) : <div className="text-5xl" aria-hidden="true">🥗</div>}
          <p className="text-sm muted"><span className="spinner" /> Finding each food and its portion…</p>
          <Skeleton rows={3} label="Reading your food" />
        </div>
      )}

      {stage === 'review' && result && (
        <Review date={date} analysis={result} photo={image?.small} source={source} onDone={onClose}
          onRetry={image ? (m) => void read({ image: image.ai, note, model: m }) : source === 'text' ? (m) => void read({ text, model: m }) : undefined} />
      )}
    </Sheet>
  );
}

function BigChoice({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return <button className="btn !min-h-[72px] flex-col !gap-1 !rounded-[22px]" onClick={onClick}><Icon d={icon} className="h-6 w-6" />{label}</button>;
}

function ErrorBox({ text, onOther }: { text: string; onOther: (m: Provider) => void }) {
  const st = useStore();
  const other: Provider = st.settings.ai.provider === 'gemini' ? 'claude' : 'gemini';
  return (
    <div className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
      <p>{text}</p>
      {st.status?.keys[other] && <button className="btn mt-2 !min-h-[38px] text-xs" onClick={() => onOther(other)}>Try {other === 'claude' ? 'Claude' : 'Gemini'} this once</button>}
    </div>
  );
}

/** Check the breakdown, fix it, pick the meal and save. Also used to change a saved meal (entry). */
export function Review({ date, analysis, photo, source, entry, onDone, onRetry }: { date: string; analysis: Analysis; photo?: string; source: Source; entry?: Entry; onDone: () => void; onRetry?: (m: Provider) => void }) {
  const st = useStore();
  const s = st.settings;
  const [items, setItems] = useState<Food[]>(analysis.items);
  const [title, setTitle] = useState(analysis.title);
  const [day, setDay] = useState(entry?.date ?? date);
  const [time, setTime] = useState(entry?.time ?? (date === todayStr() ? nowTime() : '12:00'));
  const [meal, setMeal] = useState<Meal>(entry?.meal ?? mealAt(time, s.meals));
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState('');
  const [adding, setAdding] = useState(false);
  const t = sum(items);
  const other: Provider = s.ai.provider === 'gemini' ? 'claude' : 'gemini';

  const addItem = async () => {
    setAdding(true);
    try {
      const r = await api.analyze({ text: more });
      setItems((x) => [...x, ...r.items]);
      setMore('');
    } catch (e) { toast('err', errText(e)); }
    setAdding(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      const e: Entry = { ...(entry ?? { id: newId(), createdAt: new Date().toISOString(), source, by: analysis.by, healthScore: analysis.healthScore, notes: analysis.notes }), date: day, time, meal, title: title.trim() || 'Meal', items };
      await st.saveEntry(e, entry ? undefined : photo, entry?.date);
      if (fav) await st.saveFavorite({ id: newId(), title: e.title, items, meal, createdAt: new Date().toISOString() });
      toast('ok', entry ? 'Changes saved.' : `Saved: ${e.title}, ${kcalText(t.calories, s.units)}`);
      onDone();
    } catch (e) { toast('err', errText(e)); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      {photo && <img src={photo} alt="Your food" className="mx-auto max-h-52 w-full rounded-3xl object-cover" />}
      <div className="flex items-start gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">Name of the meal</span><input className="input w-full font-display text-lg font-semibold" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        {s.display.healthScore && <HealthBadge score={analysis.healthScore} />}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'var(--trk)' }}>
        <span className="num text-2xl font-semibold">{kcalText(t.calories, s.units)}</span>
        <MacroLine t={t} />
      </div>
      <FoodEditor items={items} onChange={setItems} units={s.units} />
      <div className="flex gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">Add something</span><input className="input w-full" value={more} onChange={(e) => setMore(e.target.value)} placeholder="Add something: e.g. a can of coke" onKeyDown={(e) => e.key === 'Enter' && more.trim() && void addItem()} /></label>
        <button className="btn" disabled={!more.trim() || adding} onClick={() => void addItem()} aria-label="Add this item">{adding ? <span className="spinner" /> : <Icon d={ICONS.plus} />}</button>
      </div>
      {(analysis.notes || (s.ai.tips && analysis.tips.length > 0)) && (
        <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--bd)' }}>
          {analysis.notes && <p className="muted">{analysis.notes}</p>}
          {s.ai.tips && analysis.tips.map((x) => <p key={x} className="mt-1">💡 {x}</p>)}
        </div>
      )}
      <Seg label="Meal" options={MEALS.map((m) => [m.id, m.label])} value={meal} onChange={setMeal} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold muted">Day<input type="date" className="input mt-1 w-full" value={day} max={addDays(todayStr(), 1)} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
        <label className="text-xs font-semibold muted">Time<input type="time" className="input mt-1 w-full" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} /></label>
      </div>
      {!entry && <div className="flex items-center justify-between gap-3 py-1"><span className="text-sm font-semibold">⭐ Also save as a favorite</span><Toggle on={fav} onChange={setFav} label="Save as a favorite" /></div>}
      <button className="btn-primary w-full !min-h-[52px] text-base" disabled={busy || !items.length} onClick={() => void save()}>{busy ? <span className="spinner" /> : entry ? 'Save changes' : 'Save'}</button>
      <p className="text-center text-[11px] muted">
        {analysis.by}{analysis.cached ? ' · remembered (free)' : ''}{analysis.note ? ` · ${analysis.note}` : ''}
        {onRetry && st.status?.keys[other] && <> · <button className="font-bold underline" onClick={() => onRetry(other)}>Ask {other === 'claude' ? 'Claude' : 'Gemini'} instead</button></>}
      </p>
    </div>
  );
}

/** ⭐ Favorites and meals from the last 2 weeks: one tap, no AI. */
function Favorites({ date, onPick }: { date: string; onPick: (r: Analysis) => void }) {
  const st = useStore();
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Entry[] = [];
    for (let i = 0; i < 14; i++) {
      for (const e of [...(st.days[addDays(date, -i)]?.entries ?? [])].reverse()) {
        const k = e.title.toLowerCase();
        if (!seen.has(k)) { seen.add(k); out.push(e); }
      }
    }
    return out.slice(0, 15);
  }, [st.days, date]);
  const pick = (title: string, items: Food[]) => onPick({ title, items, healthScore: 0, notes: '', tips: [], by: 'From your list (free)' });
  return (
    <div className="space-y-4">
      <div>
        <p className="label mb-1">⭐ Favorites</p>
        {st.favorites.length ? st.favorites.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <button className="tap -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left" onClick={() => pick(f.title, f.items)}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-xl" aria-hidden="true">⭐</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-bold">{f.title}</span><MacroLine t={sum(f.items)} /></span>
              <span className="num shrink-0 font-semibold">{Math.round(sum(f.items).calories)}</span>
            </button>
            <button className="btn-ghost" aria-label={`Remove ${f.title} from favorites`} onClick={() => void st.deleteFavorite(f.id).catch((e) => toast('err', errText(e)))}><Icon d={ICONS.trash} className="h-4 w-4" /></button>
          </div>
        )) : <p className="text-sm muted">None yet. Tick “Also save as a favorite” when you save a meal.</p>}
      </div>
      <div>
        <p className="label mb-1">🕘 Recent</p>
        {recent.length ? recent.map((e) => <EntryRow key={e.id} e={e} units={st.settings.units} onOpen={() => pick(e.title, e.items)} />) : <p className="text-sm muted">Meals from the last 2 weeks show here.</p>}
      </div>
    </div>
  );
}

/**
 * 🏷️ Barcode: read from a photo of it (on the phone, when the browser can) or typed, then looked up in
 * Open Food Facts (free, no AI).
 */
function Barcode({ onFound }: { onFound: (r: Analysis) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [grams, setGrams] = useState(100);
  const [product, setProduct] = useState<{ name: string; per100: Omit<Food, 'name' | 'portion' | 'grams' | 'confidence'>; serving?: number } | null>(null);
  const shot = useRef<HTMLInputElement>(null);
  const canDetect = canReadBarcodes();

  const fromPhoto = async (f?: File) => {
    if (!f) return;
    try {
      const found = await readBarcode(f);
      if (found) { setCode(found); void look(found); } else toast('err', 'No barcode found in that photo. Try closer, or type the number.');
    } catch { toast('err', 'This browser can’t read barcodes from photos: type the number instead.'); }
  };

  const look = async (c = code) => {
    const n = digits(c);
    if (n.length < 6) return;
    setBusy(true);
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${n}.json?fields=product_name,brands,nutriments,serving_quantity`);
      const j = (await r.json()) as { status?: number; product?: { product_name?: string; brands?: string; serving_quantity?: number; nutriments?: Record<string, number> } };
      const p = j.product;
      if (!p || j.status === 0) throw new Error('Not found in Open Food Facts. Take a photo of the food or its label instead.');
      const v = (k: string) => Number(p.nutriments?.[`${k}_100g`]) || 0;
      const kcal = v('energy-kcal') || Math.round(v('energy') / 4.184);
      const name = [p.brands?.split(',')[0], p.product_name].filter(Boolean).join(' ') || 'Product';
      const serving = Number(p.serving_quantity) || undefined;
      setProduct({ name, serving, per100: { calories: kcal, protein: v('proteins'), carbs: v('carbohydrates'), fat: v('fat'), fiber: v('fiber'), sugar: v('sugars') } });
      setGrams(serving ?? 100);
    } catch (e) { toast('err', errText(e)); }
    setBusy(false);
  };

  if (product) {
    const r = grams / 100;
    const k = (x: number) => Math.round(x * r * 10) / 10;
    const food: Food = { name: product.name, portion: product.serving && grams === product.serving ? '1 serving' : `${grams} g`, grams, calories: Math.round(product.per100.calories * r), protein: k(product.per100.protein), carbs: k(product.per100.carbs), fat: k(product.per100.fat), fiber: k(product.per100.fiber), sugar: k(product.per100.sugar), confidence: 95 };
    return (
      <div className="space-y-3">
        <p className="font-display text-lg font-semibold">{product.name}</p>
        <p className="text-sm muted">Per 100 g: {Math.round(product.per100.calories)} kcal</p>
        <div className="flex flex-wrap gap-2">
          {product.serving && <button className={`chip ${grams === product.serving ? '!border-lime-500' : ''}`} onClick={() => setGrams(product.serving!)}>1 serving ({product.serving} g)</button>}
          {[50, 100, 150, 200, 250].map((g) => <button key={g} className={`chip ${grams === g ? '!border-lime-500' : ''}`} onClick={() => setGrams(g)}>{g} g</button>)}
        </div>
        <label className="text-xs font-semibold muted">Grams<input className="input num mt-1 w-full" inputMode="numeric" value={grams} onChange={(e) => setGrams(Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))} /></label>
        <div className="rounded-2xl px-3 py-2.5" style={{ background: 'var(--trk)' }}><span className="num text-xl font-semibold">{food.calories} kcal</span> <MacroLine t={food} /></div>
        <button className="btn-primary w-full" disabled={!grams} onClick={() => onFound({ title: product.name, items: [food], healthScore: 0, notes: '', tips: [], by: 'Open Food Facts (free)' })}>Next</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <input ref={shot} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void fromPhoto(e.target.files?.[0])} />
      {canDetect && <button className="btn-primary w-full" onClick={() => shot.current?.click()}><Icon d={ICONS.camera} /> Photo of the barcode</button>}
      <label className="block text-sm font-semibold">{canDetect ? 'Or type the number' : 'Barcode number'}
        <input className="input num mt-1 w-full tracking-widest" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 5449000000996" onKeyDown={(e) => e.key === 'Enter' && void look()} />
      </label>
      <button className="btn w-full" disabled={busy || code.length < 6} onClick={() => void look()}>{busy ? <span className="spinner" /> : 'Look it up'}</button>
      <p className="text-xs muted">Packaged food is looked up in Open Food Facts, a free public database. No AI is used.</p>
    </div>
  );
}

/** A saved meal: change it, copy it to today, or delete it. */
export function EntrySheet({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const st = useStore();
  const [photo, setPhoto] = useState<string | undefined>();
  useEffect(() => { if (entry.photo) void st.photo(entry.photo).then((p) => setPhoto(p ?? undefined)); }, [entry.photo, st]);
  const copy = async () => {
    const time = nowTime();
    try { await st.saveEntry({ ...entry, id: newId(), date: todayStr(), time, meal: mealAt(time, st.settings.meals), photo: undefined, createdAt: new Date().toISOString() }); toast('ok', 'Added again for today.'); onClose(); } catch (e) { toast('err', errText(e)); }
  };
  const del = async () => {
    if (!confirm(`Delete “${entry.title}”?`)) return;
    try { await st.deleteEntry(entry); toast('ok', 'Deleted.'); onClose(); } catch (e) { toast('err', errText(e)); }
  };
  return (
    <Sheet title={entry.title} onClose={onClose}>
      <Review date={entry.date} entry={entry} source={entry.source} photo={photo} onDone={onClose}
        analysis={{ title: entry.title, items: entry.items, healthScore: entry.healthScore ?? 0, notes: entry.notes ?? '', tips: [], by: entry.by ?? (entry.source === 'manual' ? 'Added by you' : '') }} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => void copy()}><Icon d={ICONS.copy} className="h-4 w-4" /> Eat it again today</button>
        <button className="btn-danger" onClick={() => void del()}><Icon d={ICONS.trash} className="h-4 w-4" /> Delete</button>
      </div>
    </Sheet>
  );
}
