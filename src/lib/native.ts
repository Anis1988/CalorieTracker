import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** True inside the Android app, false on the website. */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * The app has no server of its own: it talks to the live website's server functions (Vercel). The address is asked
 * once on the first screen (pre-filled from VITE_API_BASE, the Actions variable CALORIE_URL) and can be changed in
 * Settings → This device. On the website the paths stay relative ("/api/…").
 */
const SERVER_KEY = 'ct.server';
export const DEFAULT_SERVER = (import.meta.env.VITE_API_BASE as string | undefined)?.trim().replace(/\/+$/, '') ?? '';
export const getServer = (): string => {
  try { return localStorage.getItem(SERVER_KEY) || DEFAULT_SERVER; } catch { return DEFAULT_SERVER; }
};
export function setServer(url: string): void {
  let clean = url.trim().replace(/\/+$/, '');
  if (clean && !/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
  try { if (clean) localStorage.setItem(SERVER_KEY, clean); else localStorage.removeItem(SERVER_KEY); } catch { /* private mode */ }
}
export const apiUrl = (path: string): string => (isNative() && path.startsWith('/') ? getServer() + path : path);

/** The phone's clock and battery icons follow the app's look (dark icons on light, light icons on dark). */
export function followThemeInBars(): void {
  if (!isNative()) return;
  const sync = () => void SystemBars.setStyle({ style: document.documentElement.classList.contains('dark') ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
  sync();
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

/** Android app: a file is written to the phone's cache, then the Share menu opens (Save to Files, Drive, Gmail…). */
export async function shareText(name: string, text: string): Promise<void> {
  await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
  await Share.share({ title: name, files: [uri], dialogTitle: 'Save or send it' });
}
