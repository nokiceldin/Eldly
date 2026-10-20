# Private Eldinos accounts

Supabase Auth handles passwords and persistent per-device sessions. Accounts are
provisioned manually; the app has no public signup form. The username is mapped
to an internal, non-deliverable `@accounts.eldinos.invalid` Auth email identifier.
No password, service key, or account allowlist is shipped in the browser bundle.

## Storage boundaries

- `eldinos_accounts` is the administrator-managed membership list.
- Each record, revision cursor, and initialization flag belongs to an Auth UUID.
- RLS grants read access only to the calling user's rows. Writes use narrowly
  scoped RPCs that derive their UUID from `auth.uid()`, never a client argument.
- Unapproved Auth users cannot initialize or access an account.
- Device caches, pending edits, sync mirrors and backups use account-specific keys.
- Guest mode uses a separate device-only namespace. It never uploads to accounts.
- Logout removes this device's session; it does not delete cloud data or pending
  offline edits. Login resumes only the selected user's cache.
- In-flight work is stopped when the account changes, including another tab.

## Existing owner's migration

`accounts.sql` creates private tables and authenticated RPCs. The one-time
`activate-accounts.sql` locks the former shared data, copies every record to the
administrator-designated owner, checks the count, then revokes all old anonymous
access. The legacy tables remain intact as an administrator-only recovery copy.
A local JSON cloud backup was also saved before migration. Only the legacy owner
may recover unsent edits from an older device cache. Friends and guests cannot
import that cache implicitly.

## Creating another account

Use `scripts/create-account.mjs` on a trusted administrator machine. Supply the
existing Supabase project URL and secret/service-role key through server-only
environment variables, and pass the explicitly requested username/password as
JSON on stdin. The script creates the Supabase Auth user and private membership
row. A duplicate username fails rather than taking over an existing Auth user.
Never add the service key to `VITE_*`, a browser settings page or Git.

New accounts start with no tasks, routines, categories, trackers, goals, entries,
or visible packing trips. They choose their own tracker labels, colors and
recording types. Check supports weekly routines and conversion of an unfinished
one-time task to a weekly routine. Hiding a tracker keeps its history for restore.
Guest data is deliberately not merged when someone signs in.

The original `schema.sql` is legacy history only: do not rerun it in production,
as it would reopen the former public dataset.
