import { apiUrl, getServer, isNative } from './native';
import type { Analysis, BeautyCheck, DayData, Entry, Favorite, Provider, Settings, ShelfItem, Status } from './types';

/** The access code is kept on this device only (Settings → This device). */
const KEY = 'ct.code';
export const getCode = () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };
export const setCode = (c: string) => { try { if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch { /* private mode */ } };

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (isNative() && !getServer()) throw new ApiError('Type your site’s address first (the one you open in the browser).', 401);
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...init, headers: { 'Content-Type': 'application/json', 'x-access-token': getCode(), ...init.headers } });
  } catch {
    throw new ApiError(isNative() ? `Couldn’t reach ${getServer()}. Check your internet, and that this is your site’s address (Settings → This device).` : 'Couldn’t reach the server. Check your internet connection.', 0);
  }
  const j = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !j) throw new ApiError(j?.error ?? (isNative() && res.status === 404 ? `Your site wasn’t found at ${getServer()}. Use the address you open the app at in the browser.` : `Something went wrong (${res.status})`), res.status);
  return j;
}
const send = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const api = {
  settings: () => call<{ settings: Settings; status: Status }>('/api/settings'),
  saveSettings: (settings: Settings) => call<{ settings: Settings }>('/api/settings', send('PUT', { settings })),
  wipe: () => call<{ deleted: number }>('/api/settings', send('POST', { wipe: true })),
  analyze: (b: { image?: string; text?: string; note?: string; model?: Provider }) => call<Analysis>('/api/analyze', send('POST', b)),
  days: (from: string, to: string) => call<{ days: Record<string, DayData> }>(`/api/entries?from=${from}&to=${to}`),
  photo: (id: string) => call<{ photo: string | null }>(`/api/entries?photo=${encodeURIComponent(id)}`),
  saveEntry: (entry: Entry, photo?: string, oldDate?: string) => call<{ entry: Entry }>('/api/entries', send('POST', { entry, photo, oldDate })),
  deleteEntry: (e: Entry) => call<{ ok: true }>(`/api/entries?id=${e.id}&date=${e.date}`, { method: 'DELETE' }),
  water: (date: string, ml: number) => call<{ ok: true }>('/api/entries', send('POST', { water: { date, ml } })),
  body: () => call<{ weights: Record<string, number>; favorites: Favorite[] }>('/api/body'),
  weight: (date: string, kg: number) => call<{ ok: true }>('/api/body', send('POST', { weight: { date, kg } })),
  deleteWeight: (date: string) => call<{ ok: true }>(`/api/body?weight=${date}`, { method: 'DELETE' }),
  favorite: (favorite: Favorite) => call<{ ok: true }>('/api/body', send('POST', { favorite })),
  shelf: () => call<{ shelf: ShelfItem[] }>('/api/beauty'),
  checkProduct: (b: { images: string[]; note?: string; model?: Provider }) => call<Omit<BeautyCheck, 'id' | 'createdAt'>>('/api/beauty', send('POST', { check: b })),
  saveShelf: (item: ShelfItem, photo?: string) => call<{ item: ShelfItem }>('/api/beauty', send('POST', { item, photo })),
  deleteShelf: (id: string) => call<{ ok: true }>(`/api/beauty?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  deleteFavorite: (id: string) => call<{ ok: true }>(`/api/body?favorite=${id}`, { method: 'DELETE' }),
};

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
