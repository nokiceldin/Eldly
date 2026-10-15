# Eldly: one shared checklist, no login

This version uses your existing Supabase project with **no Supabase Auth, accounts, passwords, anonymous-user creation, PINs, or sync codes**. All browsers use the one `eldly` shared dataset. Checkly, Trackly/Progress history and Packly remain included.

**Public anonymous write access means anyone who can access the app or public API can read, modify, or delete the shared data.** The publishable key is visible in the browser. An unlisted URL is not access control. This is intentional. RLS limits access to the new shared Eldly tables; it does not make this shared data private. Keep JSON backups.

## Update your existing Supabase project

1. Export current device backups before updating. If you already synced with the previous private version, decide whether that cloud copy or your phone's local copy has the newest data.
2. In **Supabase → SQL Editor → New query**, paste and run **`supabase/schema.sql`** in full. It creates `eldly_shared_state` and `eldly_shared_records`, enables RLS, grants public `anon` access only to that shared dataset, and adds the atomic sync functions. It is safe to re-run; it does not reset data.
3. **If you want to keep the previous private CLOUD copy:** before opening the updated app, open **`supabase/migrate-private.sql`**, replace its UUID placeholder with your previous user's UID from **Authentication → Users**, review its warning that the data becomes public, and run it. This is an explicit, one-time copy. It keeps all previous records untouched and refuses to overwrite an already initialized shared dataset. Skip this step if you want to initialize from your phone instead.
4. No Auth settings or Auth user are needed by this version. Previously created Auth users and private tables may remain; this app never signs in or reads their tables. Do not delete the old private data until you verify the migration and have backups.

## GitHub and Vercel

1. Unzip `eldly-shared.zip` and replace your repository files with its contents. Keep `package.json`, `package-lock.json`, `src/`, `public/`, and `supabase/` at the repository root. Include the updated package files: the Auth SDK dependency was removed. Do not upload `.env.local`, `node_modules`, or `dist`.
2. Keep these Vercel environment variables:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Your existing Supabase Project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Your existing public publishable key (`sb_publishable_…`) |

   Never use a secret or `service_role` key. The legacy public `anon` API key also works as the value of `VITE_SUPABASE_PUBLISHABLE_KEY`. The old variable alias `VITE_SUPABASE_ANON_KEY` is no longer used.
3. Vercel settings: **Root Directory empty**, provided `package.json` is at repository root; **Framework Vite**, **Install Command `npm install`**, **Build Command `npm run build`**, **Output Directory `dist`**. Redeploy after saving environment variables; Vite embeds them at build time.
4. Reload the app. An installed iPhone PWA may need to be closed and reopened once to receive the updated shell. No login page should appear.

## First opening and local data preservation

- A new browser opens an existing shared checklist immediately after the initial cloud load.
- If the shared database is empty and this device has old saved data, it offers **Import this device's saved data** or **Start empty**. Both require explicit confirmation. Open the device with your newest data first, usually your phone.
- Initialization is guarded by a database lock and a persistent initialized flag. If two devices try to initialize, only the first wins; the other reads the shared copy. There is no repeat import or whole-dataset overwrite from the second device.
- When shared data already exists and an older device has local data, it offers **Keep a backup and open shared checklist**. Its local data is copied to `eldly-before-shared-v2` before the working copy changes. It is not automatically uploaded or merged into the shared checklist. Export it first if you need a separate file.
- You can download that saved copy through **Cloud sync settings → Export pre-migration backup**. Your previous private sync metadata is also left untouched. If the backup cannot be saved (for example storage is full), the switch fails instead of discarding local data.
- Check that phone and laptop show the same tasks, check one task on each, and wait for **Saved to cloud** before closing. Open pages poll about every three seconds and refresh on focus/reconnect. There is no Supabase Realtime configuration step.

## Reliability and conflict behavior

Stable task/routine/occurrence IDs are preserved. Rollover stays a computed view of the same task, not a second inserted task. Completing a carried task updates the shared task and its history without duplicating it. Weekly routines still generate separate deterministic occurrences.

Changes are diffed into individual record fields, queued durably, and committed as one transaction per edit batch. Different tasks and different fields merge; if both devices edit the exact same field, the last cloud-accepted write wins for that field. Entity deletion uses tombstones, preventing stale field edits from resurrecting deleted items. Direct REST deletes also create tombstones, so incremental readers learn of them. A revision counter and database lock prevent missed updates from out-of-order commits.

Offline changes stay in the device's durable outbox, survive reload, and upload after reconnection while the app is open. Safari can suspend background pages: an offline edit cannot appear elsewhere before it uploads. API/network/schema errors are shown in the sync status, with Retry and Export available. Failed uploads retain their queued changes. Invalid cloud data does not overwrite a valid local copy. Very large batches (over 8 MiB / 50,000 fields) are rejected visibly rather than partially saved.

All task properties, routines, dates, completion history, categories, preferences, Trackly records and Packly data are represented in the shared records. No backend table or app-side record is keyed by a user ID or device account. Browser cache/outbox metadata is local and scoped to the configured project URL.

## Backup

**Cloud sync settings → Export JSON backup** downloads both local app stores. Checkly's existing backup export remains available for checklist/Trackly data alone. Backups work even if syncing fails. **Restore backup** validates the all-device JSON format, asks for confirmation before changing shared data, and queues the resulting changes. Restoring an older backup can remove newer shared entries: export the current copy first. Existing section-specific imports still work in their sections.

A fresh browser without the two environment variables continues in local-only mode with a visible **Set up sync** status. It does not claim to be synced. If Supabase is configured but unreachable and this browser has no cached shared data, it shows a loading/error/retry view rather than silently starting another dataset.

## Troubleshooting

- Function not found / permission denied: run the full new `supabase/schema.sql` in the project matching the Vercel URL. The old private schema alone is insufficient.
- Set up sync: add both environment variables and redeploy.
- Old login screen: verify GitHub contains the new `src/sync/CloudBoundary.tsx` and `src/sync/client.ts`, then redeploy and reopen the PWA.
- Project paused or network error: resume the Supabase Free project in its dashboard, reconnect and retry. Local edits remain queued.
- Shared data already exists during private migration: the script intentionally refused to overwrite it. Export both copies and decide what to keep; do not truncate the tables to force the script.

## Verification

Run `npm install`, `npm test`, `npm run build`. The suite covers scheduling, rollover, stable recurring IDs, field merges, offline recovery, one-time initialization, stale-device migration, and PostgreSQL RLS/CRUD/transactional rollback using PGlite. Browser tests use a mock PostgREST transport; the live Supabase project connection still needs checking after you execute the SQL and deploy.
