import { useEffect, useId, useRef, useState } from 'react';
import { api, errText, newId } from '../lib/api';
import { forAi, thumb } from '../lib/image';
import { addDays, daysBetween, shortDay, todayStr } from '../lib/date';
import { useStore } from '../lib/store';
import { AVOID_IDEAS, CONCERNS, SHELF_STATUS, SKIN_TYPES, TONES, UNDERTONES, type Beauty, type BeautyCheck, type Provider, type ShelfItem, type ShelfStatus, type Verdict } from '../lib/types';
import { ICONS, Icon, Sheet, Thumb, Toggle, toast } from './ui';
import { clashes, type Clash } from '../lib/clash';

/** 💄 Beauty pieces. Each is also drawn in the Beauty guide with made-up products. */

const VERDICT: Record<Verdict, { label: string; icon: string; cls: string }> = {
  good: { label: 'Good match', icon: '✅', cls: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  ok: { label: 'OK for you', icon: '🟡', cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  avoid: { label: 'Not for you', icon: '❌', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
};

export function VerdictBadge({ v, small }: { v: Verdict; small?: boolean }) {
  const x = VERDICT[v];
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full font-extrabold ${x.cls} ${small ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-sm'}`}><span aria-hidden="true">{x.icon}</span>{x.label}</span>;
}

/** The match score (1–10) as a small ring. */
export function ScoreRing({ score, verdict, size = 84 }: { score: number; verdict: Verdict; size?: number }) {
  const id = useId().replace(/:/g, '');
  const stroke = 8, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Match ${score} out of 10`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="overflow-visible">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f472b6" /><stop offset="1" stopColor="#a855f7" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'var(--trk)' }} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * score) / 10} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          stroke={verdict === 'avoid' ? undefined : `url(#${id})`} className={`ring-arc ${verdict === 'avoid' ? 'stroke-red-500 dark:stroke-red-400' : ''}`} style={verdict === 'avoid' ? undefined : { filter: 'drop-shadow(0 0 6px rgba(244,114,182,.5))' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="num text-2xl font-semibold leading-none">{score}</span><span className="text-[10px] muted">/ 10</span></div>
    </div>
  );
}

/** The full answer for one product. */
export function BeautyResult({ r, photo }: { r: Omit<BeautyCheck, 'id' | 'createdAt'>; photo?: string }) {
  const [all, setAll] = useState(false);
  const hits = r.avoidHits.map((h) => h.toLowerCase());
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {photo ? <img src={photo} alt="The product" className="h-20 w-20 shrink-0 rounded-2xl object-cover" /> : null}
        <div className="min-w-0 flex-1">
          <p className="label">{r.category}{r.brand ? ` · ${r.brand}` : ''}</p>
          <p className="font-display text-lg font-semibold leading-snug">{r.product || 'Unknown product'}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-3xl p-3" style={{ background: 'var(--trk)' }}>
        <ScoreRing score={r.score} verdict={r.verdict} />
        <div className="min-w-0 space-y-1.5"><VerdictBadge v={r.verdict} /><p className="text-sm">{r.summary}</p></div>
      </div>
      {r.avoidHits.length > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          <p className="font-bold">🚫 On your avoid list</p>
          <p className="mt-1">{r.avoidHits.join(', ')}</p>
        </div>
      )}
      {r.good.length > 0 && <List title="💗 Good for your skin" items={r.good} />}
      {r.watch.length > 0 && <List title="⚠️ Watch out for" items={r.watch} />}
      {r.shade && <p className="rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--bd)' }}><b>🎨 Shade:</b> {r.shade}</p>}
      {r.howToUse.length > 0 && (
        <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--bd)' }}>
          <p className="font-bold">💡 How to use it</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{r.howToUse.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      {r.ingredients.length > 0 && (
        <div className="text-sm">
          <button className="btn-ghost -ml-2 text-xs" onClick={() => setAll((o) => !o)} aria-expanded={all}>{all ? 'Hide' : 'Show'} the {r.ingredients.length} ingredients {r.ingredientsFrom === 'label' ? '(read from the label)' : '(the usual formula: check your label)'}</button>
          {all && <p className="rise mt-1 leading-relaxed muted">{r.ingredients.map((x, i) => <span key={i} className={hits.some((h) => h.startsWith(x.toLowerCase())) ? 'font-bold text-red-700 dark:text-red-300' : ''}>{x}{i < r.ingredients.length - 1 ? ', ' : ''}</span>)}</p>}
        </div>
      )}
      {r.ingredientsFrom === 'none' && <p className="text-xs muted">No ingredient list was visible: add a photo of the back of the product for a surer answer.</p>}
    </div>
  );
}

function List({ title, items }: { title: string; items: { name: string; why: string }[] }) {
  return (
    <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--bd)' }}>
      <p className="font-bold">{title}</p>
      <ul className="mt-1 space-y-1">{items.map((x) => <li key={x.name}><b>{x.name}</b>: {x.why}</li>)}</ul>
    </div>
  );
}

/** When an opened product is past its "12M" date. */
export function expiry(x: Pick<ShelfItem, 'openedOn' | 'paoMonths'>): { date: string; left: number } | null {
  if (!x.openedOn || !x.paoMonths) return null;
  const d = new Date(`${x.openedOn}T12:00:00`);
  d.setMonth(d.getMonth() + x.paoMonths);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { date, left: daysBetween(todayStr(), date) };
}

/** One product on My shelf. */
export function ShelfRow({ x, onOpen }: { x: ShelfItem; onOpen?: () => void }) {
  const st = SHELF_STATUS.find((s) => s.id === x.status)!;
  const ex = expiry(x);
  return (
    <button className="tap -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left" onClick={onOpen}>
      <Thumb id={x.photo} fallback="💄" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{x.product || 'Product'}</span>
        <span className="block truncate text-xs muted">{x.brand}{x.brand && x.category ? ' · ' : ''}{x.category}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs"><VerdictBadge v={x.verdict} small /><span className="muted">{st.icon} {st.label}</span>
          {ex && <span className={ex.left < 0 ? 'font-bold text-red-700 dark:text-red-300' : ex.left < 30 ? 'font-bold text-amber-700 dark:text-amber-300' : 'muted'}>{ex.left < 0 ? 'expired' : `use by ${shortDay(ex.date)}`}</span>}
        </span>
      </span>
      <span className="num shrink-0 text-lg font-semibold">{x.score}</span>
    </button>
  );
}

/** Status chips for a product. */
function StatusPick({ value, onChange }: { value: ShelfStatus; onChange: (s: ShelfStatus) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="On my shelf">
      {SHELF_STATUS.map((s) => <button key={s.id} role="radio" aria-checked={value === s.id} className={`chip !px-3 !py-1.5 ${value === s.id ? '!border-transparent bg-gradient-to-br from-pink-300 to-purple-400 text-[#2a0b22]' : ''}`} onClick={() => onChange(s.id)}>{s.icon} {s.label}</button>)}
    </div>
  );
}

/** Opened on + months after opening (the jar symbol). */
function OpenedPick({ openedOn, paoMonths, onChange }: { openedOn?: string; paoMonths?: number; onChange: (p: { openedOn?: string; paoMonths?: number }) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs font-semibold muted">Opened on<input type="date" className="input mt-1 w-full" value={openedOn ?? ''} max={todayStr()} onChange={(e) => onChange({ openedOn: e.target.value || undefined, paoMonths })} /></label>
      <label className="text-xs font-semibold muted">Good for (after opening)
        <select className="input mt-1 w-full" value={paoMonths ?? 0} onChange={(e) => onChange({ openedOn, paoMonths: Number(e.target.value) || undefined })}>
          <option value={0}>—</option>{[3, 6, 9, 12, 18, 24, 36].map((m) => <option key={m} value={m}>{m} months</option>)}
        </select>
      </label>
    </div>
  );
}

const paoOf = (s: string) => Number(s.match(/(\d+)\s*M/i)?.[1]) || undefined;

/** 📸 Check a product: up to 3 photos (front + ingredient list), then the verdict for your skin. */
export function CheckSheet({ onClose, start }: { onClose: () => void; start?: 'camera' | 'gallery' }) {
  const st = useStore();
  const [pics, setPics] = useState<{ ai: string; small: string }[]>([]);
  const [note, setNote] = useState('');
  const [stage, setStage] = useState<'photos' | 'reading' | 'result'>('photos');
  const [r, setR] = useState<Omit<BeautyCheck, 'id' | 'createdAt'> | null>(null);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState<ShelfStatus>('checked');
  const [opened, setOpened] = useState<{ openedOn?: string; paoMonths?: number }>({});
  const [busy, setBusy] = useState(false);
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  useEffect(() => { if (start) (start === 'camera' ? cam : gal).current?.click(); }, [start]);

  const add = async (files: FileList | null) => {
    const list = [...(files ?? [])].slice(0, 3 - pics.length);
    try { const out = await Promise.all(list.map(async (f) => ({ ai: await forAi(f), small: await thumb(f) }))); setPics((p) => [...p, ...out].slice(0, 3)); } catch (e) { toast('err', errText(e)); }
  };
  const check = async (model?: Provider) => {
    setStage('reading'); setErr('');
    try {
      const x = await api.checkProduct({ images: pics.map((p) => p.ai), note: note.trim() || undefined, model });
      setR(x); setOpened({ paoMonths: paoOf(x.pao) }); setStage('result');
    } catch (e) { setErr(errText(e)); setStage('photos'); }
  };
  const save = async () => {
    if (!r) return;
    setBusy(true);
    try {
      await st.saveShelf({ ...r, id: newId(), createdAt: new Date().toISOString(), status, ...opened }, pics[0]?.small);
      toast('ok', 'Saved to My shelf.');
      onClose();
    } catch (e) { toast('err', errText(e)); }
    setBusy(false);
  };
  const other: Provider = st.settings.ai.provider === 'gemini' ? 'claude' : 'gemini';

  return (
    <Sheet title={stage === 'result' ? 'For your skin' : stage === 'reading' ? 'Reading the label…' : 'Check a product'} onClose={onClose}>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      <input ref={gal} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      {stage === 'photos' && (
        <div className="space-y-3">
          <p className="text-sm muted">Take a photo of the front, then one of the <b>ingredient list</b> on the back if you can: the answer is much surer with it. Up to 3 photos.</p>
          <div className="grid grid-cols-3 gap-2">
            {pics.map((p, i) => (
              <div key={i} className="relative">
                <img src={p.small} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-2xl object-cover" />
                <button className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white" aria-label={`Remove photo ${i + 1}`} onClick={() => setPics((l) => l.filter((_, j) => j !== i))}><Icon d={ICONS.close} className="h-4 w-4" stroke={2.4} /></button>
              </div>
            ))}
            {pics.length < 3 && (
              <button className="btn aspect-square !h-auto flex-col !gap-1 !rounded-2xl text-xs" onClick={() => cam.current?.click()}><Icon d={ICONS.camera} className="h-6 w-6" />{pics.length ? (pics.length === 1 ? 'Ingredients' : 'Another') : 'Front'}</button>
            )}
          </div>
          {pics.length < 3 && <button className="btn-ghost text-xs" onClick={() => gal.current?.click()}><Icon d={ICONS.image} className="h-4 w-4" /> From gallery</button>}
          <label className="block text-sm font-semibold">Anything to add? (optional)
            <input className="input mt-1 w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. shade 220, for under my eyes, for my daughter" maxLength={300} />
          </label>
          {err && (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              <p>{err}</p>
              {st.status?.keys[other] && <button className="btn mt-2 !min-h-[38px] text-xs" onClick={() => void check(other)}>Try {other === 'claude' ? 'Claude' : 'Gemini'} this once</button>}
            </div>
          )}
          <button className="btn-primary w-full !min-h-[52px] text-base" disabled={!pics.length} onClick={() => void check()}>Is it good for me?</button>
        </div>
      )}
      {stage === 'reading' && (
        <div className="space-y-4 py-2 text-center">
          <div className="relative mx-auto w-fit overflow-hidden rounded-3xl">
            {pics[0] && <img src={pics[0].small} alt="The product" className="max-h-64 object-cover" />}
            <div className="scan pointer-events-none absolute inset-x-0 top-0 h-full" aria-hidden="true" />
          </div>
          <p className="text-sm muted"><span className="spinner" /> Reading the ingredients and matching them to your skin…</p>
        </div>
      )}
      {stage === 'result' && r && (
        <div className="space-y-4">
          <BeautyResult r={r} photo={pics[0]?.small} />
          <ShelfClash r={r} />
          <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--bd)' }}>
            <p className="text-sm font-bold">Save to My shelf as</p>
            <StatusPick value={status} onChange={setStatus} />
            {(status === 'using' || status === 'loved') && <OpenedPick {...opened} onChange={setOpened} />}
          </div>
          <button className="btn-primary w-full !min-h-[52px] text-base" disabled={busy} onClick={() => void save()}>{busy ? <span className="spinner" /> : 'Save'}</button>
          <p className="text-center text-[11px] muted">{r.by}{r.cached ? ' · remembered (free)' : ''}{r.note ? ` · ${r.note}` : ''}
            {st.status?.keys[other] && <> · <button className="font-bold underline" onClick={() => void check(other)}>Ask {other === 'claude' ? 'Claude' : 'Gemini'} instead</button></>}
          </p>
          <p className="text-center text-[11px] muted">Guidance, not medical advice. New product on sensitive skin? Try it on a small patch first.</p>
        </div>
      )}
    </Sheet>
  );
}

/** A saved product: see it again, change its status / opened date, or delete it. */
export function ShelfSheet({ x, onClose }: { x: ShelfItem; onClose: () => void }) {
  const st = useStore();
  const [y, setY] = useState<ShelfItem>(x);
  const [photo, setPhoto] = useState<string | undefined>();
  useEffect(() => { if (x.photo) void st.photo(x.photo).then((p) => setPhoto(p ?? undefined)); }, [x.photo]); // eslint-disable-line react-hooks/exhaustive-deps
  const ex = expiry(y);
  const save = async () => { try { await st.saveShelf(y); toast('ok', 'Saved.'); onClose(); } catch (e) { toast('err', errText(e)); } };
  const del = async () => { if (!confirm(`Remove “${x.product}” from My shelf?`)) return; try { await st.deleteShelf(x.id); onClose(); } catch (e) { toast('err', errText(e)); } };
  return (
    <Sheet title={x.product || 'Product'} onClose={onClose}>
      <div className="space-y-4">
        <BeautyResult r={x} photo={photo} />
        <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--bd)' }}>
          <StatusPick value={y.status} onChange={(status) => setY({ ...y, status })} />
          <OpenedPick openedOn={y.openedOn} paoMonths={y.paoMonths} onChange={(p) => setY({ ...y, ...p })} />
          {ex && <p className={`text-sm ${ex.left < 0 ? 'font-bold text-red-700 dark:text-red-300' : 'muted'}`}>{ex.left < 0 ? `Past its date since ${shortDay(ex.date)}: time for a new one.` : `Use by ${shortDay(ex.date)} (${ex.left} days left).`}</p>}
          <label className="block text-xs font-semibold muted">My notes<input className="input mt-1 w-full" value={y.myNotes ?? ''} onChange={(e) => setY({ ...y, myNotes: e.target.value })} placeholder="e.g. great under makeup, a bit sticky" maxLength={300} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary" onClick={() => void save()}>Save</button>
          <button className="btn-danger" onClick={() => void del()}><Icon d={ICONS.trash} className="h-4 w-4" /> Remove</button>
        </div>
        <p className="text-center text-[11px] muted">Checked {shortDay(x.createdAt.slice(0, 10))} · {x.by}</p>
      </div>
    </Sheet>
  );
}

/** 🌸 Your skin profile (Skin tab and Settings → Your skin). Saved at once. */
export function SkinProfile() {
  const st = useStore();
  const b = st.settings.beauty;
  const [extra, setExtra] = useState('');
  const set = (p: Partial<Beauty>) => void st.saveSettings({ ...st.settings, beauty: { ...b, ...p } }).catch((e) => toast('err', errText(e)));
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const chip = (on: boolean) => `chip !px-3 !py-1.5 ${on ? '!border-transparent bg-gradient-to-br from-pink-300 to-purple-400 text-[#2a0b22]' : ''}`;
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-bold">Skin type</p>
        <div className="grid grid-cols-2 gap-2">
          {SKIN_TYPES.map((t) => (
            <button key={t.id} className={`tap rounded-2xl border p-3 text-left ${b.skinType === t.id ? '!border-pink-400 bg-pink-500/10 shadow-[0_0_18px_-6px_#f472b6]' : ''}`} style={b.skinType === t.id ? undefined : { borderColor: 'var(--bd)' }} aria-pressed={b.skinType === t.id} onClick={() => set({ skinType: t.id })}>
              <span className="block font-bold">{t.label}</span><span className="block text-xs muted">{t.hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3"><span className="text-sm font-semibold">My skin is sensitive (reacts easily)</span><Toggle on={b.sensitive} onChange={(v) => set({ sensitive: v })} label="Sensitive skin" /></div>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-bold">What I’d like to help</p>
        <div className="flex flex-wrap gap-1.5">{CONCERNS.map((c) => <button key={c} className={chip(b.concerns.includes(c))} aria-pressed={b.concerns.includes(c)} onClick={() => set({ concerns: toggle(b.concerns, c) })}>{c}</button>)}</div>
      </div>
      <div>
        <p className="text-sm font-bold">Ingredients to avoid</p>
        <p className="mb-1.5 text-xs muted">Allergies, or things that don’t suit you. A product with one of these is always “Not for you”.</p>
        <div className="flex flex-wrap gap-1.5">
          {[...AVOID_IDEAS, ...b.avoid.filter((a) => !AVOID_IDEAS.includes(a))].map((c) => <button key={c} className={chip(b.avoid.includes(c))} aria-pressed={b.avoid.includes(c)} onClick={() => set({ avoid: toggle(b.avoid, c) })}>{b.avoid.includes(c) ? '🚫 ' : ''}{c}</button>)}
        </div>
        <div className="mt-2 flex gap-2">
          <label className="min-w-0 flex-1"><span className="sr-only">Another ingredient to avoid</span><input className="input w-full" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Another one, e.g. niacinamide" onKeyDown={(e) => { if (e.key === 'Enter' && extra.trim()) { set({ avoid: [...b.avoid, extra.trim()] }); setExtra(''); } }} /></label>
          <button className="btn" disabled={!extra.trim()} onClick={() => { set({ avoid: [...b.avoid, extra.trim()] }); setExtra(''); }} aria-label="Add to the avoid list"><Icon d={ICONS.plus} /></button>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-bold">Skin tone <span className="font-normal muted">(for foundation and concealer shades)</span></p>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button key={t.id} className={`tap flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-xs font-semibold ${b.tone === t.id ? '!border-pink-400 shadow-[0_0_18px_-6px_#f472b6]' : ''}`} style={b.tone === t.id ? undefined : { borderColor: 'var(--bd)' }} aria-pressed={b.tone === t.id} onClick={() => set({ tone: b.tone === t.id ? '' : t.id })}>
              <span className="h-8 w-8 rounded-full border border-black/10" style={{ background: t.color }} aria-hidden="true" />{t.label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {UNDERTONES.map((u) => (
            <button key={u.id} className={`tap rounded-2xl border p-2.5 text-left text-xs ${b.undertone === u.id ? '!border-pink-400 bg-pink-500/10' : ''}`} style={b.undertone === u.id ? undefined : { borderColor: 'var(--bd)' }} aria-pressed={b.undertone === u.id} onClick={() => set({ undertone: b.undertone === u.id ? '' : u.id })}>
              <span className="block text-sm font-bold">{u.label} undertone</span><span className="muted">{u.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold">I prefer</p>
        {([['fragranceFree', 'Fragrance-free'], ['vegan', 'Vegan'], ['pregnancy', 'Pregnancy-safe']] as const).map(([k, l]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-1"><span className="text-sm">{l}</span><Toggle on={b[k]} onChange={(v) => set({ [k]: v })} label={l} /></div>
        ))}
      </div>
    </div>
  );
}

/** "Dry · sensitive · avoiding fragrance" */
export function profileLine(b: Beauty): string {
  return [SKIN_TYPES.find((t) => t.id === b.skinType)?.label, b.sensitive && 'sensitive', b.concerns.slice(0, 2).join(', ').toLowerCase(), b.avoid.length && `avoiding ${b.avoid.slice(0, 2).join(', ').toLowerCase()}${b.avoid.length > 2 ? '…' : ''}`].filter(Boolean).join(' · ');
}

/** 🌗 My routine: what I use (or love), in morning and evening order. Free, from My shelf. */
const ORDER = ['Makeup remover', 'Cleanser', 'Toner', 'Exfoliant', 'Serum', 'Eye cream', 'Moisturizer', 'Oil', 'Sunscreen', 'Mask', 'Primer', 'Foundation', 'Concealer', 'Powder', 'Blush', 'Bronzer', 'Highlighter', 'Brow', 'Eyeshadow', 'Eyeliner', 'Mascara', 'Lipstick', 'Lip gloss', 'Lip balm'];
const MAKEUP = new Set(['Primer', 'Foundation', 'Concealer', 'Powder', 'Blush', 'Bronzer', 'Highlighter', 'Brow', 'Eyeshadow', 'Eyeliner', 'Mascara', 'Lipstick', 'Lip gloss']);
export function routine(items: ShelfItem[]) {
  const rank = (c: string) => { const i = ORDER.indexOf(c); return i < 0 ? 99 : i; };
  const mine = items.filter((x) => x.status === 'using' || x.status === 'loved').sort((a, b) => rank(a.category) - rank(b.category));
  const am = mine.filter((x) => !['Makeup remover', 'Mask', 'Exfoliant'].includes(x.category) && !/retin/i.test(x.ingredients.join(' ')));
  const pm = mine.filter((x) => !MAKEUP.has(x.category) && x.category !== 'Sunscreen' && !/ascorbic acid|ascorbyl/i.test(x.ingredients.join(' ')));
  return { am, pm };
}
export const soonExpiring = (items: ShelfItem[]) => items.map((x) => ({ x, e: expiry(x) })).filter((y): y is { x: ShelfItem; e: { date: string; left: number } } => !!y.e && y.e.left < 30).sort((a, b) => a.e.left - b.e.left);
export const recentChecks = (items: ShelfItem[], days = 60) => items.filter((x) => x.createdAt.slice(0, 10) >= addDays(todayStr(), -days));

/** 🧪 Products that shouldn't go on together (from My shelf), with what to do. */
export function ClashList({ list, empty }: { list: Clash[]; empty?: string }) {
  if (!list.length) return empty ? <p className="text-sm muted">{empty}</p> : null;
  const style = { high: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100', medium: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100', low: 'text-stone-700 dark:text-stone-200' };
  const icon = { high: '⛔', medium: '⚠️', low: 'ℹ️' };
  return (
    <ul className="space-y-2">
      {list.map((c, i) => (
        <li key={i} className={`rounded-2xl border p-3 text-sm ${style[c.level]}`} style={c.level === 'low' ? { borderColor: 'var(--bd)' } : undefined}>
          <p className="font-bold"><span aria-hidden="true">{icon[c.level]} </span>{c.title}</p>
          <p className="text-xs opacity-80">{c.a} + {c.b}</p>
          <p className="mt-1">{c.tip}</p>
        </li>
      ))}
    </ul>
  );
}

/** The product being checked against what you use now. */
function ShelfClash({ r }: { r: Pick<ShelfItem, 'product' | 'ingredients' | 'category'> }) {
  const st = useStore();
  const using = st.shelf.filter((x) => x.status === 'using' || x.status === 'loved');
  const list = clashes(using, { ...r, id: 'new' });
  if (!using.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">🧪 With what you use now</p>
      <ClashList list={list} empty="✅ No clashes with the products you use." />
    </div>
  );
}
