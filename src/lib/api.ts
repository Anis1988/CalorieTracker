import type { Analysis, DayData, Entry, Favorite, Provider, Settings, Status } from './types';

/** The access code is kept on this device only (Settings → This device). */
const KEY = 'ct.code';
export const getCode = () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };
export const setCode = (c: string) => { try { if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch { /* private mode */ } };

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', 'x-access-token': getCode(), ...init.headers } });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(j.error ?? `Something went wrong (${res.status})`, res.status);
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
  deleteFavorite: (id: string) => call<{ ok: true }>(`/api/body?favorite=${id}`, { method: 'DELETE' }),
};

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
