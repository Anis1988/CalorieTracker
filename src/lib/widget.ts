import { registerPlugin } from '@capacitor/core';
import { isNative } from './native';

/** The Android home-screen widget (native code in android/…/CaloriesWidget.java): the app sends today's numbers. */
interface WidgetData { date: string; big: string; label: string; sub: string; water: string; pct: number; over: boolean; newBig: string; newSub: string; newWater: string }
const Widget = registerPlugin<{ update: (d: WidgetData) => Promise<void> }>('Widget');

let last = '';
export function pushWidget(d: WidgetData): void {
  if (!isNative()) return;
  const key = JSON.stringify(d);
  if (key === last) return;
  last = key;
  void Widget.update(d).catch(() => undefined);
}
