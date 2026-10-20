# Eldinos private cloud accounts

The app now uses Supabase Auth and private per-account data. Guest mode is local
only. See [ACCOUNTS.md](ACCOUNTS.md) for the ownership model, migration guarantees
and administrator account-creation procedure.

Production uses the existing Supabase project and these public Vite variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The browser never receives a secret/service-role key. Authentication provides
the access token; the server determines record ownership from `auth.uid()`.

The private schema is `supabase/accounts.sql`. The one-time owner migration is
`supabase/activate-accounts.sql`; it has already been applied in production.
Neither should be rerun casually. The original shared records remain as a
private recovery copy, and old anonymous RPC permissions have been revoked.
**Do not run the legacy `supabase/schema.sql` or `migrate-private.sql` on the
production project. Those files document the superseded public shared model.**

Local development uses the same public variables in `.env.local` (not committed).
Guest mode also works without cloud configuration. Use a separate test project
for destructive integration tests; production owner data is never test data.
