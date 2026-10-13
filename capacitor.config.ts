import type { CapacitorConfig } from '@capacitor/cli';

/** The Android app (branch "android"): the same screens as the website, talking to the live site's server. */
const config: CapacitorConfig = {
  appId: 'app.calorietracker',
  appName: 'Calories',
  webDir: 'build',
  backgroundColor: '#07090c',
  plugins: {
    // Requests go through Android itself (not the web view), so the live server answers without CORS limits.
    CapacitorHttp: { enabled: true },
    // The screens draw under the clock/battery bar; its icons follow the app's light/dark look (native.ts).
    SystemBars: { style: 'DEFAULT', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
