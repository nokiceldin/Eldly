# Deploy the shared, no-login Eldly

1. Run `supabase/schema.sql` in your existing Supabase SQL Editor.
2. If keeping the old private cloud data, follow `supabase/migrate-private.sql` **before opening the new app**. It needs your old user's UUID and refuses to overwrite existing shared data. Otherwise initialize from your newest device when prompted.
3. Replace your GitHub repository files with this ZIP's contents, with `package.json` at repository root.
4. Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel. Never use a secret/service-role key.
5. Vercel: Root Directory empty; Vite; install `npm install`; build `npm run build`; output `dist`. Redeploy.
6. Open the app: no login. Existing local data gets a one-time, confirmed migration; all devices then share the same checklist.

Anyone with access to the app or public API can read, modify or delete the shared data. Export JSON backups regularly. Full instructions and migration choices: **CLOUD-SETUP.md**.
