# Deploy Eldinos

The live repository is `nokiceldin/Eldly`, branch `main`. Vercel builds the
`eldly-sync` root using Vite, with `npm run build` and output `dist`.

Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the production
environment. Do not put an Auth admin key or account passwords into Vite envs.
The per-account database migration has already been applied; ordinary deploys
must not rerun the historical public/shared schema.

Before pushing, run tests and a production build. After deployment, check the
login page, persistent session, private account Data and guest separation.

See CLOUD-SETUP.md and ACCOUNTS.md for private storage and account provisioning.
