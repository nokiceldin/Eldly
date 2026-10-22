# Private MySpace accounts

Production uses the Neon **Free** database `myspace-private`, connected to the existing Vercel project. `VITE_ACCOUNT_BACKEND=private` selects the private server API. `DATABASE_URL` is server-only and must never have a `VITE_` prefix.

## Sign-in and ownership

- Usernames and bcrypt password hashes live in `myspace_users`. Public registration accepts only a username and password; new accounts are never owners.
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

Choose **New here? Create account** on the sign-in screen. Supply only a username (3–32 letters, numbers or underscores, saved in lowercase) and a password (at least eight characters, up to 72 UTF-8 bytes). No email, verification, approval or two-factor step is needed. Registration atomically saves the bcrypt password hash, non-owner account, empty workspace state and device session, then signs in immediately. Each account uses the existing private cloud sync and starts without anyone else's data. Taken usernames show an error without changing the existing account. Registration attempts are limited per IP without extra user steps.

On a trusted administrator machine, supply server-only `DATABASE_URL` and pipe JSON containing the explicitly requested `username` and `password`, plus optional `homeName` for the title inside the app into `node scripts/create-account.mjs`. Passwords must have at least eight characters. The transaction creates a fresh non-owner account; no tasks, tracking, packing history or other user's records are copied. Duplicate usernames fail without partially creating an account.

## Task recovery

Deleting a task by swiping or from its editor shows an Undo button at the top for three seconds. The prompt includes the task name; Undo restores that occurrence with its saved dates and details. Stopping a repeating task also offers the brief Undo action. Check → Options → Deleted tasks lists saved deleted tasks with their scheduled dates and a Restore button, including deletions made before this feature. Recovery uses the existing account-scoped storage and cloud sync; it does not import another account's or guest data.

## Free usage

Saves synchronize immediately when service is healthy. Background polling runs only while visible and recently active. Failed requests back off. Idle tabs do not continuously keep the database awake. Both Vercel and Neon remain on free plans; reaching a provider limit can still interrupt service and must not trigger an automatic paid upgrade.

## Tracker XP

All accounts have their own derived XP counter and weekly history. Custom trackers store an optional `xp` rule (signed amount, per logged day / count / hour, optional absolute weekly cap) alongside the tracker in account-scoped cloud data. Blank logs award nothing; deleting or editing a log recalculates XP. Updating rules recalculates saved logs too. Archived trackers retain their historical XP. Existing owner rules remain the fallback for original tracker IDs until explicitly overridden.

## Coins, rewards and weekly bonuses

The XP UI is now Coins; existing `xp` tracker rule keys and historical earned values are preserved. `rewards` and immutable-price `rewardPurchases` live inside each account’s existing synced Check data. Buying reduces the available wallet, not earned weekly history. Undo marks a receipt refunded. Archived rewards do not refund purchases. Purchases check the latest local wallet and block duplicate/insufficient purchases; this is a personal motivation feature, not a payment service. Offline edits merge through the existing sync engine.

Only completed full weeks earn bonuses: +3 per goal met using the plan effective that week, and +20 for a strictly higher positive base-coin week than a previous completed full week. The first full week establishes a baseline; ties, incomplete weeks and zero/negative earning weeks do not earn record bonuses. Blank days still count as zero for maximum goals. Bonuses are derived, not minted on recap views, so reopening cannot duplicate them. Retroactive tracking/rule edits recalculate earnings and bonuses; purchases keep their receipt prices, and a negative available balance blocks further purchases. Monday’s existing weekly recap shows the goal chips, coin totals and record celebration for all accounts.

## Direct tracker settings

Click a tracker name in Track to edit its coins, weekly cap, daily repetition cap, time conditions, goal targets, name and color. Original owner rules have editable equivalents, including prayer’s five rewarded counts per day, sleep >8 hours, and the two phone-time rewards. Weekly owner targets are updated as a plan from this Monday; completed weeks retain their original plans. Personal goal history is similarly preserved. Existing logs are retained, and changing coin rules recalculates their values. The Customize list’s edit buttons open the same focused editor. Coin collection now uses a CC0 recorded money/coin jingle (credits in public/audio/CREDITS.txt), cached for offline use and reversed for losses; the shared embossed SVG game coin respects red loss effects and muted sound preferences. Rewards feature a next-unlock illustration, milestone track and unlocked state.

## Bounded coin feedback and adjustable weekly bonuses

Coin effects now represent bundles: ceil(sqrt(abs(delta))) visual coins, capped at 12, with exact accounting preserved. Gains finish in about 1.5 seconds and losses within about one second. Collection sounds use at most six short arcade coin samples distributed across arrivals; losses use a distinct, more audible descending non-coin debit sound, and spending uses a softer confirmation. New interactions cancel queued sounds and replace the old visual burst; the displayed balance always converges to the latest saved balance.

Customize trackers includes Weekly bonuses with per-goal and record-week amounts (zero disables either). Rates are stored in account-scoped `coinBonusPlans`, effective from the current Monday. Completed weeks keep their original rates; old data defaults to 3 per goal / 20 per record. Recap chips and coin history display the actual rates rather than fixed labels. Independent edits merge; stale conflicting bonus changes are rejected.
