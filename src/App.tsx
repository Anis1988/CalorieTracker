import { useEffect, useState, type CSSProperties } from 'react';
import { StoreProvider, dayOf, useStore } from './lib/store';
import { api, getCode, setCode, errText } from './lib/api';
import { todayStr } from './lib/date';
import { ICONS, Icon, Seg, Toasts } from './components/ui';
import type { AddMode } from './components/Add';
import { Today } from './pages/Today';
import { History } from './pages/History';
import { Weight } from './pages/Weight';
import { Settings } from './pages/Settings';
import { Guide } from './pages/Guide';
import { BeautyGuide, BeautyHome, Shelf, Skin } from './pages/Beauty';
import { App as NativeApp } from '@capacitor/app';
import { AppUpdateCheck } from './components/AppUpdate';
import { pushWidget } from './lib/widget';
import { energyNum, energyUnit, macroGoals, sum, waterText } from './lib/nutrition';
import { DEFAULT_SERVER, getServer, isNative, setServer } from './lib/native';
import { CookHome, CookingGuide, Pantry, Recipes } from './pages/Cooking';

type Space = 'food' | 'beauty' | 'cooking';
type Tab = 'today' | 'history' | 'weight' | 'check' | 'shelf' | 'skin' | 'cook' | 'recipes' | 'pantry' | 'settings' | 'guide';
type Slot = { id: Tab; label: string; icon: string; slot: number };
// Each side has its own bottom bar: 4 tabs and the big camera button in the middle (slot 2). Settings is shared.
const TABS: Record<Space, Slot[]> = {
  food: [
    { id: 'today', label: 'Today', icon: ICONS.today, slot: 0 },
    { id: 'history', label: 'History', icon: ICONS.history, slot: 1 },
    { id: 'weight', label: 'Weight', icon: ICONS.weight, slot: 3 },
    { id: 'settings', label: 'Settings', icon: ICONS.settings, slot: 4 },
  ],
  beauty: [
    { id: 'check', label: 'Check', icon: ICONS.sparkle, slot: 0 },
    { id: 'shelf', label: 'My shelf', icon: ICONS.shelf, slot: 1 },
    { id: 'skin', label: 'Skin', icon: ICONS.face, slot: 3 },
    { id: 'settings', label: 'Settings', icon: ICONS.settings, slot: 4 },
  ],
  cooking: [
    { id: 'cook', label: 'Cook', icon: ICONS.pan, slot: 0 },
    { id: 'recipes', label: 'Recipes', icon: ICONS.book, slot: 1 },
    { id: 'pantry', label: 'Pantry', icon: ICONS.basket, slot: 3 },
    { id: 'settings', label: 'Settings', icon: ICONS.settings, slot: 4 },
  ],
};
const HOME: Record<Space, Tab> = { food: 'today', beauty: 'check', cooking: 'cook' };
const ALL: Tab[] = ['today', 'history', 'weight', 'check', 'shelf', 'skin', 'cook', 'recipes', 'pantry', 'settings', 'guide'];
const tabOf = (sp: Space): Tab => { const h = location.hash.replace('#/', '') as Tab; return ALL.includes(h) && (h === 'settings' || h === 'guide' || TABS[sp].some((t) => t.id === h)) ? h : HOME[sp]; };
const spaceNow = (): Space => { try { const v = localStorage.getItem('ct.space'); return v === 'beauty' || v === 'cooking' ? v : 'food'; } catch { return 'food'; } };

/**
 * The slow glow behind the glass: lime / amber / rose for Calories, pink / orchid / peach for Beauty, orange / red / honey
 * for Cooking, plus a faint dot grid at the top that breathes. Drawn again (fading in) when you switch sides.
 */
function Glow({ space }: { space: Space }) {
  const c = space === 'beauty'
    ? ['bg-pink-300 dark:bg-pink-600 dark:opacity-30', 'bg-purple-300 dark:bg-purple-700 dark:opacity-30', 'bg-orange-200 dark:bg-rose-700 dark:opacity-[0.22]']
    : space === 'cooking'
    ? ['bg-orange-300 dark:bg-orange-600 dark:opacity-30', 'bg-red-200 dark:bg-red-700 dark:opacity-25', 'bg-yellow-200 dark:bg-amber-600 dark:opacity-[0.22]']
    : ['bg-lime-300 dark:bg-lime-600 dark:opacity-30', 'bg-amber-200 dark:bg-amber-600 dark:opacity-25', 'bg-rose-200 dark:bg-rose-700 dark:opacity-[0.22]'];
  return (
    <div key={space} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden animate-[fade_.9s_ease-out]" aria-hidden="true">
      <div className="dotgrid breathe absolute inset-0" />
      <div className={`absolute -left-32 -top-28 h-[380px] w-[420px] rounded-full opacity-45 blur-[70px] transition-colors duration-700 will-change-transform animate-[drift1_20s_ease-in-out_infinite] ${c[0]}`} />
      <div className={`absolute -right-40 top-48 h-[340px] w-[380px] rounded-full opacity-50 blur-[80px] transition-colors duration-700 will-change-transform animate-[drift2_24s_ease-in-out_infinite] ${c[1]}`} />
      <div className={`absolute -bottom-32 left-6 h-[260px] w-[320px] rounded-full opacity-40 blur-[90px] transition-colors duration-700 will-change-transform animate-[drift1_28s_ease-in-out_infinite] ${c[2]}`} />
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
  const beautyOn = st.settings.beauty.on;
  const cookingOn = st.settings.cooking.on;
  const spaces: Space[] = ['food', ...(beautyOn ? ['beauty' as const] : []), ...(cookingOn ? ['cooking' as const] : [])];
  const [space, setSpace] = useState<Space>(spaceNow());
  const sp: Space = spaces.includes(space) ? space : 'food';
  const [tab, setTab] = useState<Tab>(tabOf(sp));
  const [date, setDate] = useState(todayStr());
  const [add, setAdd] = useState<AddMode | null>(null);
  const [check, setCheck] = useState<'pick' | 'camera' | 'gallery' | null>(null);
  const [snap, setSnap] = useState(false);
  const [swapped, setSwapped] = useState(false); // just switched side: the page settles in like another app
  useEffect(() => {
    const f = () => setTab(tabOf(sp));
    f();
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, [sp]);
  useEffect(() => { document.documentElement.classList.toggle('beauty', sp === 'beauty'); document.documentElement.classList.toggle('cooking', sp === 'cooking'); }, [sp]);
  const go = (t: Tab) => { location.hash = `#/${t}`; window.scrollTo(0, 0); };
  // Android back button: close an open panel, else go back to this side's home, else leave the app (it stays open in the background).
  useEffect(() => {
    if (!isNative()) return;
    const h = NativeApp.addListener('backButton', () => {
      if (document.querySelector('[role=dialog]')) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      else if (tabOf(sp) !== HOME[sp]) { location.hash = `#/${HOME[sp]}`; window.scrollTo(0, 0); }
      else void NativeApp.minimizeApp();
    });
    return () => void h.then((x) => x.remove());
  }, [sp]);
  // 📱 Home-screen widget: today's calories left and water, sent whenever they change.
  useEffect(() => {
    if (!st.ready || st.locked) return;
    const s = st.settings;
    const t = todayStr();
    const d = dayOf(st.days, t);
    const goal = macroGoals(s).calories;
    const eaten = sum(d.entries.flatMap((e) => e.items)).calories;
    const left = goal - eaten;
    const n = (x: number) => energyNum(Math.abs(x), s.units).toLocaleString();
    const water = s.water.on ? `💧 ${waterText(d.water, s.units)} of ${waterText(s.goals.waterMl, s.units)}` : '';
    pushWidget({
      date: t, big: n(left), label: left < 0 ? `${energyUnit(s.units)} over` : `${energyUnit(s.units)} left`, over: left < 0,
      sub: `${n(eaten)} of ${n(goal)} ${energyUnit(s.units)} eaten`, water, pct: goal ? Math.round((eaten / goal) * 100) : 0,
      newBig: n(goal), newSub: `0 of ${n(goal)} ${energyUnit(s.units)} eaten`, newWater: s.water.on ? `💧 0 of ${waterText(s.goals.waterMl, s.units)}` : '',
    });
  }, [st.ready, st.locked, st.days, st.settings]);
  const switchTo = (s: Space) => {
    if (s === sp) return;
    try { localStorage.setItem('ct.space', s); } catch { /* private mode */ }
    setSpace(s);
    setSwapped(true);
    location.hash = `#/${HOME[s]}`;
    window.scrollTo(0, 0);
  };

  if (!st.ready) return <Shell><p className="mt-20 text-center text-sm muted"><span className="spinner" /> Loading…</p></Shell>;
  if (st.locked || !getCode()) return <Shell><Lock /></Shell>;

  const tabs = TABS[sp];
  const slot = tabs.find((t) => t.id === tab)?.slot ?? 0;
  const pink = sp === 'beauty';
  const orange = sp === 'cooking';
  const multi = spaces.length > 1;
  return (
    <div className="min-h-screen pb-[calc(9rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))]">
      <Glow space={sp} />
      <header className="sticky top-0 z-30 border-b border-stone-900/5 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.06]" style={{ paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top, 0px))', background: 'color-mix(in srgb, var(--bg) 78%, transparent)' }}>
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-2.5">
          <img src={pink ? '/beauty.svg' : orange ? '/cooking.svg' : '/icon.svg'} alt="" className="h-8 w-8 shrink-0" />
          {!multi && <span className="font-display text-xl font-semibold tracking-tight">Calories</span>}
          {multi && <Seg label="Calories, beauty or cooking" className={`ml-auto min-w-0 flex-1 ${spaces.length > 2 ? 'max-w-[270px] [&>button]:!px-1 [&>button]:!text-[12px]' : 'max-w-[200px]'}`}
            options={spaces.map((x) => [x, x === 'food' ? '🥗 Calories' : x === 'beauty' ? '💄 Beauty' : '🍳 Cooking'] as [Space, string])} value={sp} onChange={switchTo} />}
          <button onClick={() => go('guide')} aria-label="Guide" className={`btn h-11 w-11 shrink-0 !p-0 ${multi ? '' : 'ml-auto'} ${tab === 'guide' ? (pink ? '!border-pink-400 text-pink-700 shadow-[0_0_18px_-4px_#f9a8d4] dark:!border-pink-300 dark:text-pink-200' : orange ? '!border-orange-400 text-orange-700 shadow-[0_0_18px_-4px_#fdba74] dark:!border-orange-300 dark:text-orange-200' : '!border-lime-500 text-lime-700 shadow-[0_0_18px_-4px_#bef264] dark:!border-lime-300 dark:text-lime-200') : 'text-stone-600 dark:text-stone-300'}`}><Icon d={ICONS.help} /></button>
        </div>
      </header>
      {st.error && <p className="mx-auto mt-3 max-w-xl px-4"><span className="card block border-red-300 !py-3 text-sm text-red-800 dark:text-red-200">{st.error} <button className="tap rounded-lg px-1 font-bold underline" onClick={() => void st.refresh()}>Try again</button></span></p>}
      <main key={`${sp}-${tab}`} className={`page mx-auto max-w-xl px-4 pb-4 pt-5 ${swapped ? 'space-in' : ''}`} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setSwapped(false); }}>
        <AppUpdateCheck />
        {tab === 'today' ? <Today date={date} setDate={setDate} add={add} setAdd={setAdd} />
          : tab === 'history' ? <History openDay={(d) => { setDate(d); go('today'); }} />
          : tab === 'weight' ? <Weight />
          : tab === 'check' ? <BeautyHome check={check} setCheck={setCheck} go={(t) => go(t as Tab)} />
          : tab === 'shelf' ? <Shelf />
          : tab === 'skin' ? <Skin />
          : tab === 'cook' ? <CookHome snap={snap} setSnap={setSnap} />
          : tab === 'recipes' ? <Recipes />
          : tab === 'pantry' ? <Pantry />
          : tab === 'settings' ? <Settings space={sp} />
          : pink ? <BeautyGuide /> : orange ? <CookingGuide /> : <Guide />}
      </main>
      {/* The page fades out under the bottom bar, so nothing is hidden behind it or the big camera button. */}
      <div aria-hidden="true" className="scrim pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(7rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))]" />
      <nav aria-label="Tabs" className="tabbar fixed inset-x-3 z-30 mx-auto flex max-w-xl rounded-[28px] p-1.5" style={{ bottom: 'calc(12px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))' }}>
        <span aria-hidden="true" className="tabpill" style={{ '--i': slot, opacity: tab === 'guide' ? 0 : 1 } as CSSProperties} />
        {[0, 1, 2, 3, 4].map((i) => {
          const t = tabs.find((x) => x.slot === i);
          if (!t) return (
            <div key="add" className="z-[1] flex flex-1 basis-0 items-center justify-center">
              <button aria-label={pink ? 'Check a product: take a photo' : orange ? 'Snap your ingredients' : 'Add food: take a photo'}
                onClick={() => { if (pink) { if (tab !== 'check') go('check'); setCheck('camera'); } else if (orange) { if (tab !== 'cook') go('cook'); setSnap(true); } else { if (tab !== 'today') go('today'); setAdd('pick'); } }}
                className={`btn-primary -mt-7 h-[62px] w-[62px] !rounded-full !p-0 ${pink ? 'shadow-[0_10px_30px_-8px_#c084fc,0_0_0_5px_rgba(251,241,245,0.9)] dark:shadow-[0_10px_30px_-8px_#c084fc,0_0_0_5px_rgba(14,7,12,0.9)]' : orange ? 'shadow-[0_10px_30px_-8px_#f97316,0_0_0_5px_rgba(251,245,239,0.9)] dark:shadow-[0_10px_30px_-8px_#f97316,0_0_0_5px_rgba(15,9,5,0.9)]' : 'shadow-[0_10px_30px_-8px_#f59e0b,0_0_0_5px_rgba(243,245,239,0.9)] dark:shadow-[0_10px_30px_-8px_#f59e0b,0_0_0_5px_rgba(7,9,12,0.9)]'}`}>
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
      <Glow space={spaceNow()} />
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
  const [site, setSite] = useState(getServer() || DEFAULT_SERVER);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true);
    setErr('');
    if (isNative()) setServer(site);
    setCode(code.trim());
    try { await api.settings(); st.unlock(); } catch (e) { setCode(''); setErr(errText(e)); }
    setBusy(false);
  };
  return (
    <div className="card rise space-y-3">
      <h1 className="text-xl font-semibold">Welcome 👋</h1>
      <p className="text-sm muted">Snap a photo of your food: the AI lists everything on the plate with its calories, protein, carbs and fat, and keeps track for you.</p>
      {isNative() && (
        <label className="block text-sm font-semibold">Your site’s address
          <input className="input mt-1 w-full" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="e.g. calorietracker-you.vercel.app" value={site} onChange={(e) => setSite(e.target.value)} />
          <span className="mt-1 block text-xs font-normal muted">The address you open the app at in the browser (Vercel → your project → Domains).</span>
        </label>
      )}
      <label className="block text-sm font-semibold">Access code
        <input className="input mt-1 w-full" type="password" autoComplete="current-password" value={code} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && code.trim() && (!isNative() || site.trim()) && void go()} />
      </label>
      {err && <p className="text-sm text-red-700 dark:text-red-300">{err}</p>}
      <button className="btn-primary w-full" disabled={busy || !code.trim() || (isNative() && !site.trim())} onClick={() => void go()}>{busy ? <span className="spinner" /> : 'Open'}</button>
      <p className="text-xs muted">It’s the APP_ACCESS_TOKEN you set in Vercel. It’s kept on this device only.</p>
    </div>
  );
}
