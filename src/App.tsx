import { useEffect, useState, type CSSProperties } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { api, getCode, setCode, errText } from './lib/api';
import { todayStr } from './lib/date';
import { ICONS, Icon, Toasts } from './components/ui';
import type { AddMode } from './components/Add';
import { Today } from './pages/Today';
import { History } from './pages/History';
import { Weight } from './pages/Weight';
import { Settings } from './pages/Settings';
import { Guide } from './pages/Guide';

type Tab = 'today' | 'history' | 'weight' | 'settings' | 'guide';
// Bottom bar: 4 tabs and the big camera button in the middle (slot 2).
const TABS: { id: Exclude<Tab, 'guide'>; label: string; icon: string; slot: number }[] = [
  { id: 'today', label: 'Today', icon: ICONS.today, slot: 0 },
  { id: 'history', label: 'History', icon: ICONS.history, slot: 1 },
  { id: 'weight', label: 'Weight', icon: ICONS.weight, slot: 3 },
  { id: 'settings', label: 'Settings', icon: ICONS.settings, slot: 4 },
];
const tabOf = (): Tab => { const h = location.hash.replace('#/', ''); return (['today', 'history', 'weight', 'settings', 'guide'] as Tab[]).includes(h as Tab) ? (h as Tab) : 'today'; };

/** The slow lime / amber / rose glow behind the glass (still when the phone asks for less motion). */
function Glow() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-32 -top-28 h-[380px] w-[420px] rounded-full bg-lime-300 opacity-45 blur-[70px] will-change-transform animate-[drift1_20s_ease-in-out_infinite] dark:bg-lime-600 dark:opacity-30" />
      <div className="absolute -right-40 top-48 h-[340px] w-[380px] rounded-full bg-amber-200 opacity-50 blur-[80px] will-change-transform animate-[drift2_24s_ease-in-out_infinite] dark:bg-amber-600 dark:opacity-25" />
      <div className="absolute -bottom-32 left-6 h-[260px] w-[320px] rounded-full bg-rose-200 opacity-40 blur-[90px] will-change-transform animate-[drift1_28s_ease-in-out_infinite] dark:bg-rose-700 dark:opacity-[0.22]" />
    </div>
  );
}

export function App() {
  // "Follow my phone": switch when the phone switches.
  useEffect(() => {
    const m = matchMedia('(prefers-color-scheme: dark)');
    const f = () => { let t = 'auto'; try { t = localStorage.getItem('ct.theme') || 'auto'; } catch { /* private mode */ } if (t === 'auto') document.documentElement.classList.toggle('dark', m.matches); };
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return <StoreProvider><Main /></StoreProvider>;
}

function Main() {
  const st = useStore();
  const [tab, setTab] = useState<Tab>(tabOf());
  const [date, setDate] = useState(todayStr());
  const [add, setAdd] = useState<AddMode | null>(null);
  useEffect(() => {
    const f = () => setTab(tabOf());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  const go = (t: Tab) => { location.hash = `#/${t}`; window.scrollTo(0, 0); };

  if (!st.ready) return <Shell><p className="mt-20 text-center text-sm muted"><span className="spinner" /> Loading…</p></Shell>;
  if (st.locked || !getCode()) return <Shell><Lock /></Shell>;

  const slot = TABS.find((t) => t.id === tab)?.slot ?? 0;
  return (
    <div className="min-h-screen pb-32">
      <Glow />
      <header className="sticky top-0 z-30 border-b border-stone-900/5 bg-[#f3f5ef]/70 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#07090c]/70" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-xl items-center gap-2.5 px-4 py-2.5">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-xl font-semibold tracking-tight">Calories</span>
          <button onClick={() => go('guide')} aria-label="Guide" className={`btn ml-auto h-11 w-11 !p-0 ${tab === 'guide' ? '!border-lime-500 text-lime-700 shadow-[0_0_18px_-4px_#bef264] dark:!border-lime-300 dark:text-lime-200' : 'text-stone-600 dark:text-stone-300'}`}><Icon d={ICONS.help} /></button>
        </div>
      </header>
      {st.error && <p className="mx-auto mt-3 max-w-xl px-4"><span className="card block border-red-300 !py-3 text-sm text-red-800 dark:text-red-200">{st.error} <button className="font-bold underline" onClick={() => void st.refresh()}>Try again</button></span></p>}
      <main key={tab} className="rise mx-auto max-w-xl px-4 py-4">
        {tab === 'today' ? <Today date={date} setDate={setDate} add={add} setAdd={setAdd} />
          : tab === 'history' ? <History openDay={(d) => { setDate(d); go('today'); }} />
          : tab === 'weight' ? <Weight /> : tab === 'settings' ? <Settings /> : <Guide />}
      </main>
      <nav aria-label="Tabs" className="glass fixed inset-x-3 z-30 mx-auto flex max-w-xl rounded-[28px] p-1.5" style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <span aria-hidden="true" className="tabpill" style={{ '--i': slot, opacity: tab === 'guide' ? 0 : 1 } as CSSProperties} />
        {[0, 1, 2, 3, 4].map((i) => {
          const t = TABS.find((x) => x.slot === i);
          if (!t) return (
            <div key="add" className="z-[1] flex flex-1 basis-0 items-center justify-center">
              <button aria-label="Add food: take a photo" onClick={() => { if (tab !== 'today') go('today'); setAdd('pick'); }}
                className="btn-primary -mt-7 h-[62px] w-[62px] !rounded-full !p-0 shadow-[0_10px_30px_-8px_#f59e0b,0_0_0_5px_rgba(243,245,239,0.9)] dark:shadow-[0_10px_30px_-8px_#f59e0b,0_0_0_5px_rgba(7,9,12,0.9)]">
                <Icon d={ICONS.camera} className="h-7 w-7" stroke={2} />
              </button>
            </div>
          );
          return (
            <button key={t.id} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined} className={`tap tabbtn z-[1] flex h-[54px] flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[10.5px] font-bold ${tab === t.id ? 'text-stone-900 dark:text-white' : 'text-stone-500 dark:text-stone-400'}`}>
              <Icon d={t.icon} className="h-[22px] w-[22px]" />{t.label}
            </button>
          );
        })}
      </nav>
      <Toasts />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Glow />
      <div className="mb-6 flex items-center gap-2"><img src="/icon.svg" alt="" className="h-10 w-10" /><span className="font-display text-2xl font-semibold">Calories</span></div>
      {children}
      <Toasts />
    </div>
  );
}

/** 🔑 The access code (APP_ACCESS_TOKEN in Vercel), typed once on each device. */
function Lock() {
  const st = useStore();
  const [code, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true);
    setErr('');
    setCode(code.trim());
    try { await api.settings(); st.unlock(); } catch (e) { setCode(''); setErr(errText(e)); }
    setBusy(false);
  };
  return (
    <div className="card rise space-y-3">
      <h1 className="text-xl font-semibold">Welcome 👋</h1>
      <p className="text-sm muted">Snap a photo of your food: the AI lists everything on the plate with its calories, protein, carbs and fat, and keeps track for you.</p>
      <label className="block text-sm font-semibold">Access code
        <input className="input mt-1 w-full" type="password" autoComplete="current-password" value={code} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && code.trim() && void go()} />
      </label>
      {err && <p className="text-sm text-red-700 dark:text-red-300">{err}</p>}
      <button className="btn-primary w-full" disabled={busy || !code.trim()} onClick={() => void go()}>{busy ? <span className="spinner" /> : 'Open'}</button>
      <p className="text-xs muted">It’s the APP_ACCESS_TOKEN you set in Vercel. It’s kept on this device only.</p>
    </div>
  );
}
