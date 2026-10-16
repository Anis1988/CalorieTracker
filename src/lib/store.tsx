import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import { addDays, todayStr } from './date';
import type { DayData, Entry, Favorite, Recipe, Settings, ShelfItem, ShopItem, Status } from './types';
import { DEFAULT_SETTINGS } from './types';

/** Everything the screens share. Changes show at once and are saved in the background (one copy on the server). */
interface Store {
  ready: boolean;
  locked: boolean; // the access code is missing or wrong
  error: string | null;
  settings: Settings;
  status: Status | null;
  days: Record<string, DayData>;
  weights: Record<string, number>;
  favorites: Favorite[];
  shelf: ShelfItem[];
  recipes: Recipe[];
  pantry: string[];
  shopping: ShopItem[];
  saveRecipe: (r: Recipe) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  setPantry: (l: string[]) => Promise<void>;
  setShopping: (l: ShopItem[]) => Promise<void>;
  saveShelf: (x: ShelfItem, photo?: string) => Promise<ShelfItem>;
  deleteShelf: (id: string) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  loadRange: (from: string, to: string) => Promise<void>;
  saveEntry: (e: Entry, photo?: string, oldDate?: string) => Promise<Entry>;
  deleteEntry: (e: Entry) => Promise<void>;
  setWater: (date: string, ml: number) => Promise<void>;
  saveWeight: (date: string, kg: number) => Promise<void>;
  deleteWeight: (date: string) => Promise<void>;
  saveFavorite: (f: Favorite) => Promise<void>;
  deleteFavorite: (id: string) => Promise<void>;
  photo: (id: string) => Promise<string | null>;
  refresh: () => Promise<void>;
  unlock: () => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;
const day = (d: Record<string, DayData>, k: string): DayData => d[k] ?? { entries: [], water: 0 };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<Status | null>(null);
  const [days, setDays] = useState<Record<string, DayData>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [shelf, setShelf] = useState<ShelfItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantry, setPantryS] = useState<string[]>([]);
  const [shopping, setShoppingS] = useState<ShopItem[]>([]);
  const loaded = useRef<{ from: string; to: string } | null>(null);
  const photos = useRef(new Map<string, Promise<string | null>>());

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) setLocked(true);
    throw e;
  };

  const loadRange = useCallback(async (from: string, to: string) => {
    const l = loaded.current;
    if (l && from >= l.from && to <= l.to) return;
    const f = l && l.from < from ? l.from : from;
    const t = l && l.to > to ? l.to : to;
    const r = await api.days(f, t).catch(fail);
    setDays((d) => ({ ...d, ...r.days }));
    loaded.current = { from: f, to: t };
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [s, b, sh, ck] = await Promise.all([api.settings(), api.body(), api.shelf().catch(() => ({ shelf: [] as ShelfItem[] })), api.cooking().catch(() => ({ recipes: [] as Recipe[], pantry: [] as string[], shopping: [] as ShopItem[] }))]);
      setShelf(sh.shelf);
      setRecipes(ck.recipes);
      setPantryS(ck.pantry);
      setShoppingS(ck.shopping);
      setSettings(s.settings);
      setStatus(s.status);
      setWeights(b.weights);
      setFavorites(b.favorites);
      try { localStorage.setItem('ct.theme', s.settings.display.theme); } catch { /* private mode */ }
      // Your phone's time zone, so the server knows which day is "today" for you (the My apps summary).
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && s.settings.display.timeZone !== tz) void api.saveSettings({ ...s.settings, display: { ...s.settings.display, timeZone: tz } }).then((r) => setSettings(r.settings)).catch(() => undefined);
      loaded.current = null;
      const t = todayStr();
      const r = await api.days(addDays(t, -40), addDays(t, 1));
      setDays(r.days);
      loaded.current = { from: addDays(t, -40), to: addDays(t, 1) };
      setLocked(false);
      setReady(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setLocked(true);
      else setError(e instanceof Error ? e.message : String(e));
      setReady(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  // Back to the app after a while: pick up meals added on another device.
  useEffect(() => {
    let away = 0;
    const f = () => { if (document.hidden) away = Date.now(); else if (away && Date.now() - away > 5 * 60_000) void refresh(); };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [refresh]);

  const value = useMemo<Store>(() => ({
    ready, locked, error, settings, status, days, weights, favorites, shelf, recipes, pantry, shopping,
    refresh, loadRange,
    unlock: () => { setLocked(false); void refresh(); },
    saveSettings: async (s) => {
      setSettings(s);
      try { localStorage.setItem('ct.theme', s.display.theme); } catch { /* private mode */ }
      const r = await api.saveSettings(s).catch(fail);
      setSettings(r.settings);
      void api.settings().then((x) => setStatus(x.status)).catch(() => undefined);
    },
    saveEntry: async (e, photo, oldDate) => {
      const r = await api.saveEntry(e, photo, oldDate).catch(fail);
      setDays((d) => {
        const out = { ...d };
        if (oldDate && oldDate !== e.date) out[oldDate] = { ...day(d, oldDate), entries: day(d, oldDate).entries.filter((x) => x.id !== e.id) };
        const cur = day(out, e.date);
        out[e.date] = { ...cur, entries: [...cur.entries.filter((x) => x.id !== e.id), r.entry].sort((a, b) => a.time.localeCompare(b.time)) };
        return out;
      });
      if (photo && r.entry.photo) photos.current.set(r.entry.photo, thumbOf(photo));
      void api.settings().then((x) => setStatus(x.status)).catch(() => undefined);
      return r.entry;
    },
    deleteEntry: async (e) => {
      setDays((d) => ({ ...d, [e.date]: { ...day(d, e.date), entries: day(d, e.date).entries.filter((x) => x.id !== e.id) } }));
      await api.deleteEntry(e).catch(fail);
    },
    setWater: async (date, ml) => {
      setDays((d) => ({ ...d, [date]: { ...day(d, date), water: Math.max(0, ml) } }));
      await api.water(date, Math.max(0, ml)).catch(fail);
    },
    saveWeight: async (date, kg) => { setWeights((w) => ({ ...w, [date]: kg })); await api.weight(date, kg).catch(fail); },
    deleteWeight: async (date) => { setWeights((w) => { const n = { ...w }; delete n[date]; return n; }); await api.deleteWeight(date).catch(fail); },
    saveFavorite: async (f) => { setFavorites((l) => [...l.filter((x) => x.id !== f.id), f].sort((a, b) => a.title.localeCompare(b.title))); await api.favorite(f).catch(fail); },
    saveShelf: async (x, photo) => {
      const r = await api.saveShelf(x, photo).catch(fail);
      setShelf((l) => [r.item, ...l.filter((y) => y.id !== x.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      if (photo && r.item.photo) photos.current.set(r.item.photo, Promise.resolve(photo));
      return r.item;
    },
    saveRecipe: async (r) => {
      const x = { ...r, createdAt: r.createdAt || new Date().toISOString() };
      setRecipes((l) => [x, ...l.filter((y) => y.id !== r.id)]);
      await api.saveRecipe(x).catch(fail);
    },
    deleteRecipe: async (id) => { setRecipes((l) => l.filter((x) => x.id !== id)); await api.deleteRecipe(id).catch(fail); },
    setPantry: async (l) => { setPantryS(l); await api.savePantry(l).catch(fail); },
    setShopping: async (l) => { setShoppingS(l); await api.saveShopping(l).catch(fail); },
    deleteShelf: async (id) => { setShelf((l) => l.filter((x) => x.id !== id)); await api.deleteShelf(id).catch(fail); },
    deleteFavorite: async (id) => { setFavorites((l) => l.filter((x) => x.id !== id)); await api.deleteFavorite(id).catch(fail); },
    photo: (id) => {
      let p = photos.current.get(id);
      if (!p) { p = api.photo(id).then((r) => r.photo).catch(() => null); photos.current.set(id, p); }
      return p;
    },
  }), [ready, locked, error, settings, status, days, weights, favorites, shelf, recipes, pantry, shopping, refresh, loadRange]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const thumbOf = (dataUrl: string) => Promise.resolve(dataUrl);
export const dayOf = day;
