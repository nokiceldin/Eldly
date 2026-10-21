# Private MySpace accounts

Production uses the Neon **Free** database `myspace-private`, connected to the existing Vercel project. `VITE_ACCOUNT_BACKEND=private` selects the private server API. `DATABASE_URL` is server-only and must never have a `VITE_` prefix.

## Sign-in and ownership

- Usernames and bcrypt password hashes live in `myspace_users`. There is no public registration endpoint.
- Sign-in issues a random 256-bit session cookie, stored for one year per device. Cookies are Secure, HttpOnly, SameSite=Lax and host-only. Only a SHA-256 token hash is stored in the database.
- Mutating API calls require a same-origin request. Sign-in attempts are rate limited in the database.
- Every sync call derives the account UUID from its verified server session; client-supplied account IDs cannot select another account.
- Database credentials, password hashes and session tokens are never returned to browser JavaScript.
- API responses are not cached by the browser or service worker.
- Local caches, pending edits and sync cursors remain scoped to the original account UUID. Guest storage stays separate and never uploads.
- Logout revokes only that device session and does not delete saved records or pending local edits.

## October 2026 migration

Supabase restricted the shared organization for egress used by another project. The original project remains unchanged as a recovery copy. A fresh private backup of all account records, states, UUIDs and original bcrypt hashes was taken before migrating. The Neon import was verified record for record, including deleted records and revisions. Existing credentials and UUIDs are retained.

The original `VITE_SUPABASE_URL` is retained as the local sync namespace, preserving existing caches and unsent edits. It does not receive traffic in private-backend mode. The old SQL in `supabase/` and Supabase Auth integration are legacy recovery paths, not current provisioning instructions.

`server/schema.sql` defines private server tables and atomic account operations. `server/migrate.mjs` imports a complete administrator backup only into an empty target and refuses to overwrite existing accounts. It is a one-time tool, not part of deployment startup.

## Creating another account

On a trusted administrator machine, supply server-only `DATABASE_URL` and pipe JSON containing the explicitly requested `username` and `password`, plus optional `homeName` for the title inside the app into `node scripts/create-account.mjs`. Passwords must have at least eight characters. The transaction creates a fresh non-owner account; no tasks, tracking, packing history or other user's records are copied. Duplicate usernames fail without partially creating an account.

## Free usage

Saves synchronize immediately when service is healthy. Background polling runs only while visible and recently active. Failed requests back off. Idle tabs do not continuously keep the database awake. Both Vercel and Neon remain on free plans; reaching a provider limit can still interrupt service and must not trigger an automatic paid upgrade.

## Tracker XP

All accounts have their own derived XP counter and weekly history. Custom trackers store an optional `xp` rule (signed amount, per logged day / count / hour, optional absolute weekly cap) alongside the tracker in account-scoped cloud data. Blank logs award nothing; deleting or editing a log recalculates XP. Updating rules recalculates saved logs too. Archived trackers retain their historical XP. Existing owner rules remain the fallback for original tracker IDs until explicitly overridden.
