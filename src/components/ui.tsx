import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../lib/store';

export function Icon({ d, className = 'h-5 w-5', stroke = 1.8 }: { d: string; className?: string; stroke?: number }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={d} /></svg>;
}
export const ICONS = {
  today: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 2M16 3h5v5M21 3l-6 6',
  history: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  weight: 'M5 7h14l2 13H3zM9 7a3 3 0 0 1 6 0M12 12l2-2',
  settings: 'M4 6h9M17 6h3M15 4v4M4 12h3M11 12h9M9 10v4M4 18h11M19 18h1M17 16v4',
  help: 'M12 17h.01M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  pen: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  barcode: 'M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  spark: 'M12 3l1.8 4.6 4.7 1.9-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.9z',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  pan: 'M3 12h13v1a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM16 12h5M7 8c0-1.5 1-1.5 1-3M11 8c0-1.5 1-1.5 1-3',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7M8 11h5',
  basket: 'M3 10h18l-2 10H5zM7 10l4-6M17 10l-4-6M9 14v3M15 14v3M12 14v3',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
  shelf: 'M4 4v16M20 4v16M4 10h16M4 20h16M7 10V7h3v3M13 10V6h3v4M8 20v-6h3v6M14 20v-4h3v4',
  face: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9 11h.01M15 11h.01M9.5 15a3.5 3.5 0 0 0 5 0M6 6c2-3 10-3 12 0',
};

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className="switch"><span /></button>;
}

/** Segmented switch: a glass thumb slides to the picked option. */
export function Seg<T extends string | number>({ options, value, onChange, label, className = '' }: { options: [T, string][]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  const i = Math.max(0, options.findIndex(([v]) => v === value));
  return (
    <div className={`seg ${className}`} role="tablist" aria-label={label} style={{ '--i': i, '--n': options.length } as CSSProperties}>
      <span className="thumb" aria-hidden="true" />
      {options.map(([v, l]) => <button key={String(v)} type="button" role="tab" aria-selected={v === value} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

/** A Settings row: words on the left, the control on the right (wraps on narrow phones). */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
      <div className="min-w-0 flex-1 basis-44">
        <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{label}</p>
        {hint && <p className="text-xs muted">{hint}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** A number box that only saves when you leave it (so typing "1" on the way to "150" isn't saved). */
export function NumberBox({ value, onChange, min = 0, max = 100000, step = 1, label, unit, width = 'w-24', blankZero }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; label: string; unit?: string; width?: string; blankZero?: boolean }) {
  const show = (n: number) => (blankZero && !n ? '' : String(n));
  const [text, setText] = useState(show(value));
  useEffect(() => setText(show(value)), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = () => {
    if (blankZero && text.trim() === '') { if (value) onChange(0); return; }
    const n = Number(text.replace(',', '.'));
    if (!Number.isFinite(n) || text.trim() === '') return setText(show(value));
    const v = Math.min(max, Math.max(min, Math.round(n / step) * step));
    setText(String(+v.toFixed(2)));
    if (v !== value) onChange(+v.toFixed(2));
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <input className={`input num ${width} text-right`} inputMode="decimal" value={text} placeholder={blankZero ? 'none' : undefined} aria-label={label} onChange={(e) => setText(e.target.value)} onBlur={done} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      {unit && <span className="text-sm muted">{unit}</span>}
    </span>
  );
}

/** A section that opens and closes. */
export function Fold({ title, subtitle, icon, open: start = false, children }: { title: string; subtitle?: string; icon?: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(start);
  return (
    <section className="card !p-0">
      <button className="tap flex w-full items-center gap-3 rounded-[26px] px-4 py-3.5 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: 'var(--trk)', boxShadow: 'inset 0 1px 0 var(--hi)' }} aria-hidden="true">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] font-semibold text-stone-900 dark:text-stone-50">{title}</span>
          {subtitle && <span className="block truncate text-xs muted">{subtitle}</span>}
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-stone-400 transition-transform duration-500 [transition-timing-function:var(--spring)] ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div className="rise space-y-1 border-t border-stone-900/[0.07] px-4 pb-4 pt-2 dark:border-white/[0.08]">{children}</div>}
    </section>
  );
}

/** A panel that slides up from the bottom on phones (centred on big screens). */
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  // Drawn at the top of the page (a portal), so a panel opened from another panel still covers the whole screen.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-stone-950/40 backdrop-blur-md animate-[fade_.25s_ease-out] sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ background: 'linear-gradient(90deg, transparent 15%, var(--edge) 50%, transparent 85%) top / 100% 1px no-repeat, color-mix(in srgb, var(--bg) 94%, transparent)' }}
        className={`max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-[30px] border border-white/70 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl animate-[sheetup_.5s_cubic-bezier(.2,.9,.25,1.04)] dark:border-white/10 sm:animate-[pop_.45s_cubic-bezier(.34,1.3,.64,1)] dark:shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)] sm:rounded-[30px] sm:pb-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <div className="mx-auto -mt-1 mb-3 h-1.5 w-10 rounded-full bg-stone-900/15 dark:bg-white/20 sm:hidden" aria-hidden="true" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button className="btn h-11 w-11 !rounded-full !p-0" aria-label="Close" onClick={onClose}><Icon d={ICONS.close} className="h-4 w-4" stroke={2.4} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ---------- messages ----------
type Toast = { id: number; kind: 'ok' | 'err' | 'info'; text: string };
let toasts: Toast[] = [];
const subs = new Set<(t: Toast[]) => void>();
export function toast(kind: Toast['kind'], text: string) {
  const t = { id: Date.now() + Math.random(), kind, text };
  toasts = [...toasts, t];
  subs.forEach((f) => f(toasts));
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); subs.forEach((f) => f(toasts)); }, kind === 'err' ? 7000 : 3200);
}
export function Toasts() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => { subs.add(setList); return () => void subs.delete(setList); }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`pointer-events-auto max-w-md rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-[popin_.45s_cubic-bezier(.34,1.56,.64,1)] ${t.kind === 'err' ? 'bg-red-700/90' : t.kind === 'ok' ? 'bg-[var(--okbg)]' : 'bg-stone-800/90'}`}>{t.text}</div>
      ))}
    </div>
  );
}

/** A meal's small photo, fetched when shown (kept on the server for Settings → Photos days). */
export function Thumb({ id, src, className = 'h-14 w-14', fallback = '🍽️' }: { id?: string; src?: string; className?: string; fallback?: string }) {
  const st = useStore();
  const [url, setUrl] = useState<string | null>(src ?? null);
  useEffect(() => { if (!src && id) void st.photo(id).then(setUrl); }, [id, src, st]);
  return url
    ? <img src={url} alt="" className={`${className} shrink-0 rounded-2xl object-cover`} />
    : <span className={`${className} flex shrink-0 items-center justify-center rounded-2xl text-2xl`} style={{ background: 'var(--trk)' }} aria-hidden="true">{fallback}</span>;
}

/**
 * 🖼️ A photo full screen in high quality: the small copy shows at once, the big one fades in when it has loaded.
 * Tap the photo to zoom in (then drag to look around), tap again to zoom out. Escape / ✕ / back closes it.
 */
export function PhotoViewer({ thumb, full, alt, credit, onClose }: { thumb: string; full: string; alt: string; credit?: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[60] flex flex-col bg-black/95 animate-[fade_.2s_ease-out]">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <p className="min-w-0 truncate text-sm font-semibold text-white/90">{alt}</p>
        <button className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Close" onClick={onClose}><Icon d={ICONS.close} className="h-5 w-5" stroke={2.4} /></button>
      </div>
      <div className={`relative flex-1 ${zoom ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden'}`} onClick={() => setZoom((z) => !z)}>
        <img src={thumb} alt="" aria-hidden="true" className={`absolute inset-0 m-auto max-h-full max-w-full object-contain blur-sm transition-opacity duration-500 ${loaded || zoom ? 'opacity-0' : 'opacity-100'}`} />
        <img src={full} alt={alt} onLoad={() => setLoaded(true)}
          className={`relative transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${zoom ? 'max-w-none w-[220%] cursor-zoom-out' : 'max-h-full max-w-full object-contain cursor-zoom-in'}`} />
        {!loaded && <span className="spinner absolute left-1/2 top-1/2 -ml-2 -mt-2 text-white" aria-label="Loading the big photo" />}
      </div>
      <p className="px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 text-center text-[11px] text-white/60">{zoom ? 'Tap to zoom out' : 'Tap the photo to zoom in'}{credit ? ` · ${credit}` : ''}</p>
    </div>,
    document.body,
  );
}

/** 🌱 A friendly empty state: a glowing icon, a line of words, and maybe a button. */
export function Empty({ icon, children, action }: { icon: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
      <span className="pop-in flex h-14 w-14 items-center justify-center rounded-[20px] text-2xl" aria-hidden="true"
        style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--a) 35%, transparent), color-mix(in srgb, var(--a2) 25%, transparent))', boxShadow: 'inset 0 1px 0 var(--hi), 0 10px 28px -12px var(--a2)' }}>{icon}</span>
      <p className="max-w-xs text-sm muted">{children}</p>
      {action}
    </div>
  );
}

/** ⏳ Shimmering placeholders while the AI reads: rows shaped like the answer that is coming. */
export function Skeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="space-y-2.5 text-left" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--bd)', background: 'var(--gl2)', animation: `rise .5s var(--soft) ${i * 0.08}s backwards` }}>
          <span className="skel h-11 w-11 shrink-0 !rounded-xl" />
          <span className="min-w-0 flex-1 space-y-2"><span className="skel block h-3" style={{ width: `${70 - i * 12}%` }} /><span className="skel block h-2.5 w-1/3" /></span>
          <span className="skel h-5 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}
