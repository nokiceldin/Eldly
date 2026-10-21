# MySpace private cloud

Current production uses Neon Free and Vercel Hobby. See [ACCOUNTS.md](ACCOUNTS.md).

Required server variable: `DATABASE_URL`, supplied by the Neon integration.
Required browser flag: `VITE_ACCOUNT_BACKEND=private`.
Keep the original `VITE_SUPABASE_URL` as a stable local-cache namespace so existing device edits are preserved. Supabase is no longer contacted in this mode.

Database schema: `server/schema.sql`. Operator account creation: `scripts/create-account.mjs`. Do not rerun migration scripts or replace the live database when adding an account.

`supabase/` contains historical schemas and recovery material only. Original Supabase records were retained unchanged; a full private backup was verified before migration.
