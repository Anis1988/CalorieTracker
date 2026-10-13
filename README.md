# Calorie Tracker

Snap a photo of your food: the AI lists every food and drink with its portion, calories, protein, carbs, fat, fiber and sugar. Check it, fix it, save it, and track your days, water and weight. Phone-first; add it to your Home Screen.

## Set up (once)

1. On [vercel.com](https://vercel.com): **Add New → Project**, import `Anis1988/CalorieTracker` (framework: Vite, settings are in `vercel.json`).
2. **Storage → Upstash for Redis** (free) → create it and connect it to this project (it adds its own keys).
3. **Settings → Environment Variables**:
   - `APP_ACCESS_TOKEN`: a long secret code you make up (you type it once on each device).
   - `GEMINI_API_KEY`: free from [Google AI Studio](https://aistudio.google.com/apikey).
   - `ANTHROPIC_API_KEY` (optional, paid backup): from [console.anthropic.com](https://console.anthropic.com).
4. **Deployments → Redeploy**. Open the site and type your access code.

## Run on your computer

```
cp .env.example .env.local   # put your keys in it
npm install
npm run dev
```

Without Upstash keys, `npm run dev` keeps data in `.local/store.json`.
