# Eldly: one private account, all your devices

This update adds Supabase cloud storage to Checkly, Trackly, Progress data, and Packly. Your existing browser data is retained until you choose a starting copy. Cloud sync is not active until you complete this setup.

## 1. Back up the phone first

Your phone and laptop currently have separate data. On each, export Checkly and Packly backups before changing anything. After updating, **Cloud sync → Export all device data** also downloads both together. Keep these files until you have verified both devices. Existing browser storage stays at the same keys and migrates without a reset.

## 2. Create the free Supabase project

1. Open https://supabase.com/dashboard and create a new project on the Free plan. Save your database password. Choose a region near you.
2. Open **SQL Editor → New query**, paste the entire file `supabase/schema.sql` from this repository, and run it.
3. Open **Authentication → Users → Add user → Create new user**. Enter your email and a strong password. Enable **Auto Confirm User**. This is your Eldly login; it is separate from your Supabase dashboard login.
4. Copy the new user's **User UID**. In SQL Editor, run this, replacing the placeholder with that exact UUID:

   ```sql
   insert into public.eldly_allowed_users(user_id)
   values ('YOUR-AUTH-USER-UUID') on conflict do nothing;
   ```

5. In **Authentication → Sign In / Providers → Email**, disable new user signups (the exact dashboard label may be “Allow new users to sign up”). Keep email/password sign-in enabled. No OAuth, SMTP, email confirmation flow, or redirect URL configuration is needed for this password-only app.
6. In the project **Connect** dialog or **Project Settings → API**, copy the **Project URL** and **publishable key** (starts `sb_publishable_`). The legacy `anon` key also works. **Never use the secret or service_role key.**

The SQL enables row-level security. Only the authenticated, explicitly allowlisted user can read or change their records. A public frontend key does not grant access to your data by itself. Do not disable RLS.

## 3. Update GitHub and Vercel

1. Unzip `eldly-sync.zip`. Replace the files in your existing GitHub repository with this version, keeping the files at the repository root (not inside an extra folder). Commit all changes, including `package.json`, `package-lock.json`, `src/`, `public/sw.js`, and `supabase/schema.sql`. Do not upload `node_modules`, `dist`, or a real `.env` file.
2. In **Vercel → your project → Settings → Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Your Supabase Project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Your publishable key |

   Enable Production and Preview as desired. These values are intentionally public; security comes from login and RLS.
3. **Deployments → latest deployment → Redeploy** after saving the variables. Vite embeds these variables at build time; changing them without a new build does not update the app. Vercel preset: Vite; build `npm run build`; output `dist`.
4. For local development, copy `.env.example` to `.env.local`, fill in the same two values, then run `npm install` and `npm run dev`. Restart Vite after changing variables.

## 4. Start with the newest device

1. Open the updated app **on the device with the best/latest data first**, probably your phone. Reload once if its installed PWA still shows the old version. Sign in with the email/password created under Authentication → Users.
2. Choose **Start with this device's data**. Wait until **Saved to cloud** appears. Leave the app open while the initial upload finishes.
3. Open the app on your laptop. Sign in with the **same** account. Choose **Use cloud data on this device**. This replaces the laptop copy; a pre-sync safety copy is kept locally. Export its data first if it has entries you need to keep.
4. Check one item on the phone with both devices online. It should appear on the laptop within a few seconds. Check a different item on the laptop and verify the phone.

Choosing **Replace cloud with this device** is an explicit overwrite, not a merge of your two old copies. Use it only if you really want that copy to become authoritative. It asks for confirmation. Do not choose it on an older laptop copy.

## Everyday behavior

- Edits are saved locally immediately, queued persistently, and uploaded automatically while the app is open and online. Incoming changes are checked about every three seconds, and on focus/reconnect. Safari may suspend background pages; returning to the app triggers sync.
- Offline edits remain on that device and upload on reconnect. Do not clear browser storage or sign out before uploading edits you need. Other devices cannot see edits that have not uploaded yet. Watch the small sync status; **Sync needs attention** means data has not necessarily uploaded.
- Unrelated task, habit, and packing-item changes merge independently. If two devices change the exact same field offline, the last write accepted by the cloud wins for that field. Deleting an item keeps it deleted when an older device edits one of its fields. This is a personal app, not collaborative editing.
- All dated history remains stored; there is no one-year cutoff. Backups are still useful. Cloud storage is not a guarantee against account loss, accidental deletion, or provider limits. Supabase Free projects can pause after inactivity; resume a paused project in its dashboard if syncing stops.
- The small sync status opens account settings, backup export/import, and sign out. The all-device backup format is separate from older Checkly-only / Packly-only backup formats. Those older imports remain in their existing sections.
- A pre-cloud safety copy is stored under `eldly-before-cloud:<user UUID>` in browser localStorage. To recover it without overwriting anything, use browser developer tools → Application/Storage → Local Storage, copy that value into a JSON file, then restore it through Cloud sync → Restore device backup.

## Troubleshooting

- **Set up sync** instead of login: the deployment was built without both environment variables. Add them and redeploy.
- **Invalid login credentials**: use the app user created in Authentication → Users, not your dashboard login or database password. Reset its password in the Supabase dashboard if necessary.
- **Invalid cloud response / account not enabled**: verify the SQL was run and the correct user UUID was inserted into `eldly_allowed_users`.
- **Function not found**: run the complete `supabase/schema.sql` in the project matching the Vercel URL.
- Network error: verify the Project URL/key, project is active, and device is online. Local changes remain queued. Retry by returning to the app or reloading it.

The source includes automated merge, queue, and scheduling tests. A live end-to-end connection must be verified after you create the Supabase project and deploy its credentials; no Supabase project is provisioned by downloading this ZIP.
