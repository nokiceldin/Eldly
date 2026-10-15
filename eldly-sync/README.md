# Eldly

A personal home for Checkly, Trackly, Progress and Packly. Checkly is the existing weekly checklist; Trackly is a monthly activity tracker. Progress shows interactive activity graphs and statistics; Packly is the complete imported packing application. React, TypeScript, Vite, Tailwind CSS, Lucide, and Motion. One shared Supabase dataset with no login or Supabase Auth. No paid APIs. **To enable sync, follow [CLOUD-SETUP.md](CLOUD-SETUP.md).** Without its two environment variables, the app continues in local-only mode.

## Public data access

**Public anonymous write access allows anyone with access to the app or public API to read, modify, or delete the shared checklist and other Eldly data.** There is no login, account, PIN, or sync code. RLS remains enabled and public policies apply only to the dedicated shared Eldly tables. Unrelated tables and the old private data are not exposed. Use the built-in JSON backup. See [CLOUD-SETUP.md](CLOUD-SETUP.md) for the SQL to execute and the optional, explicit private-to-public migration.

## Run locally

Requires Node.js 20.19+ (or 22.12+).

```sh
npm install
npm run dev
npm test
npm run build
```

Vite prints the local URL. Production assets are in `dist/`.

## GitHub and Vercel

Create a GitHub repository, commit this folder (excluding `node_modules` and `dist`), and push it. In Vercel choose **Add New → Project**, import the repository, select **Vite**, use `npm run build` and output directory `dist`. For shared cloud sync, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, run `supabase/schema.sql` and follow [CLOUD-SETUP.md](CLOUD-SETUP.md). Deploy at the root of the domain. `.openai/hosting.json` is metadata for the optional Sites deployment and is not required by Vercel.

## Eldly and Trackly

Trackly is the renamed Mapping page and uses a circular habit-wheel icon, distinct from Checkly’s checkmark. Existing `#mapping` links, activity IDs and saved records remain compatible; new links use `#trackly`.

Open the home screen to choose one of four large tiles. Checkly keeps its existing checklist and storage. Trackly opens a horizontally scrolling monthly grid with pinned colored activity labels and boxed day numbers. Month arrows navigate the calendar; tap the month name to return to the current month. The current date is highlighted and scrolled into view.

The original twelve activities plus screen time and their colors are defined in `src/mapping.ts`. Simple activities toggle with one tap. Tennis, fitness, recovery, reading and journaling prompt for hours and minutes. Prayer prompts for a count. Sleep captures night and daytime hours separately; decimals such as 8.5 are accepted. A marked square means an entry was recorded, including actual sleep below eight hours. Tap an existing timed entry to edit or clear it. Porn and Goyslop record occurrence, without assuming whether that is a goal or something to avoid.

Trackly is stored in the optional, versioned `mapping` field of the existing whole-app backup, keyed by local calendar date and stable activity ID. Old backups remain valid. Duration and sleep values are stored in minutes; prayer is an integer count. Checkly's export/import includes Trackly. `mappingProgress` provides dated activity flags, duration totals, prayer counts and separate night/day sleep series for Progress charts. Trackly reads the latest stored app data before each write and reports storage errors instead of claiming a save succeeded. With Supabase configured, these dated records sync across all devices opening this app.

A nonempty Checkly day that is fully completed automatically marks Finish all homework in Trackly on the actual finishing date. Automatic marks clear if a task is undone or new unfinished work is added. Manual Trackly marks are preserved. Late completions do not backdate a mark to a missed day, and future/empty days are not credited. Automatic squares explain their Checkly link; undo in Checkly to clear them. The link is reconciled when loading, saving or exporting data.

## Progress

Progress uses the same saved activity records as Trackly, with eight matching-color charts: tennis, fitness, recovery, praying, reading, journaling, sleep and Phone use. Phone use is purple and can be logged in either page, including an explicit zero. All durations are stored in minutes. Charts never erase or roll up the underlying daily data.

Progress opens with graphs and primary values only. Open Filters to choose Week, Month, Year, All time or a custom inclusive date range. Arrows navigate earlier periods; Today returns to the current one. Daily bars are used for short periods, weekly/monthly/yearly groups for longer periods. Grouped activity and prayer charts show totals; grouped sleep charts show average sleep per recorded day, split into night and daytime colors. Missing entries are gaps, not zeroes. Averages count only recorded days. Statistics show recorded days, total/average durations, prayer counts, combined tennis/fitness time and sleep logs reaching eight total hours.

Select a bar to open its date under Daily entries, or expand Daily entries and choose any date. Each graph’s info button reveals additional statistics; More contains the summary and backup export. Original entries remain editable a year later, including separate night/day sleep values. Phone use uses the date selected in Daily entries, initially today. Export backup includes every Trackly and checklist record. Records are saved locally and, when configured, synced to the shared Supabase dataset. Keep backups for long-term history.

- `src/progress.ts`: period ranges, accurate statistics and chart buckets
- `src/components/ProgressPage.tsx`: charts, filters and historical day inspection
- `src/useMappingData.ts`: shared persistence for Trackly and Progress
- `src/progress.test.ts`: missing/zero handling, aggregation, history and date boundaries

## Packly

The full application from `packly-2.1-updated.zip` is included under `src/packly/`: trip wizard, all packing lists, quantities, one-item packing flow, undo, overview, categories/custom items, templates, duplication, departure verification, calendar export, reflections, themes, sounds and backup import/export. Open it through the Packly home tile and return with the same Home link as the other pages.

Packly is a native React page in Eldly's existing document. It uses the same Home navigation, dark page background and system fonts, with its own selectors and animation names scoped to `.packly-page`. There is no iframe, second app document or remote font request when opening Packly. Its trip controls, settings and local storage remain intact. `npm run build` produces one application bundle; Eldly's service worker caches it for offline use. Legacy `/packly.html` bookmarks redirect to `/#packly`.

Packly keeps its original `packly-v1` localStorage key, independently of Checkly/Trackly. Existing data at this same origin is read normally. A separate older Packly deployment has different browser storage: export its JSON, then use Packly → Settings & backup → Import trips inside Eldly. Imports add trips without replacing current ones. Packly's Export all trips backs up its trips, templates, feedback and preferences; the Checkly/Progress backup remains for the checklist and Trackly. Keep both backups. The Supabase sync layer includes both stores across all devices opening this app. It does not automatically import data from a separate older Packly website.

Imported source documentation is retained in `src/packly/ORIGINAL-README.md`; the combined app has now passed the production build, packing data tests, and browser integration checks.

## Start using Checkly

The app is one dark Notes-style page with Monday through Sunday. Opening or returning to the app scrolls to today automatically; tapping the week number also returns from another week. Today gets the screen’s main space, with larger text and check buttons. Other days stay above and below for scrolling. This focuses the view without opening the keyboard. Task titles are neutral white. Every-week tasks get a plain “(W)” suffix. Other routines show “(odd weeks)”, “(even weeks)” or their specific school weeks; daily routines have no suffix. Unfinished tasks stay on their scheduled day in normal text with a red X, and also appear bold in today’s carryover with no “From” date labels. Checking either appearance checks both: they share one record. Completed tasks remain visible on their scheduled day and their completion day. Unchecking either restores the original-day red X and today’s carryover. Weekly counts include each record once. Original dates are still preserved internally. Completed items are muted with a green checkbox. Tap the blank line under a day, type a task and press Enter. The input stays ready for the next item. Tap the right-hand check button to complete or undo a task. Each day shows a green completion percentage that eases smoothly to its new value on check or undo; reduced-motion preferences update it immediately. Empty days show 0%. A green check beside the day heading means everything for that day is done. Checking off the final task shows a brief celebration saying “Finished everything for the day.” It does not replay on refresh; reduced-motion settings disable the particle burst and spring animations.

Swipe a task left to reveal red Delete and release past the threshold to remove it. Short swipes spring back, and vertical scrolling remains native. Undo is available for six seconds. Deleting a recurring occurrence leaves its future schedule intact. The task editor also provides a keyboard-accessible Delete action.

Tap a task title for optional details. Tap the task text to edit; **More actions** inside its editor contains moving up/down and copying to next week. Deletion is also available in the editor. Swipe left/right on a day heading or empty page space to change weeks; task-row swipes still delete only that occurrence. The compact sticky header shows only the week number with accessible previous/next arrows. Tap the week number to return to the current week and today. Opening or resuming always returns to the current week. Current-week and current-day headings have a subtle gold accent.

A compact Important Dates list appears after Sunday in every week, ordered by original due date. Only incomplete deadlines appear; overdue ones remain until finished. Its check buttons complete the same task shown in the daily checklist, and undoing completion restores the reminder. Tap a reminder to edit it or the plus to add one.

The top-right **Options** menu keeps repeating tasks, important dates, backups, categories, and sound settings out of the main checklist. Starter routines load automatically once. Removing starter examples keeps user-created tasks and does not make the examples return after refreshing. Reload them explicitly through **Starter checklist → Load starter checklist**. The starter checklist follows the Week 8 Apple Notes screenshots and the confirmed rules in `CHECKLIST-SCHEDULE.md`. Existing installations: export a backup, then choose **Starter checklist → Update checklist from my notes** to replace the old starter guesses while keeping personal tasks and completed history. Updating files alone does not overwrite saved checklists. School weeks use October 12–18, 2026 as week 8; change the two SCHOOL_WEEK_REFERENCE constants in `src/engine.ts` for a new term. All odd/even and specific-week schedules use this school-week reference. Starter routines begin in week 8; earlier listed weeks stay in their configuration but are not backfilled as missed work. Change Starts on in the routine editor to view earlier occurrences. Edit specific school weeks and a due-date offset through Options → Repeating tasks. Due dates never change the chosen work weekday.

End any task title with **(W)** to repeat it every week on its scheduled weekday. The shortcut accepts lowercase and spaces, such as `(w)` and `( w )`. It works in the blank add line, in the editor, and for existing/imported saved titles. Markers are stripped from the stored title and displayed once. Converting a carried task uses its scheduled weekday, preserves the original task ID, notes, due date and completion history, and suppresses a generated duplicate of the first occurrence.

Routine edits apply from today. Earlier occurrences and completion history stay saved. Pause stops occurrences until resumed without backfilling paused days. Deleting a routine stops future generation and retains history. Important dates use the same linked records in the day checklist.

## Data and backups

Checklist and activity data are stored under `checkly-data-v1`; Packly uses `packly-v1`. The cloud layer queues local changes, polls Supabase every three seconds while open, and merges individual record fields. See [CLOUD-SETUP.md](CLOUD-SETUP.md) for configuration, privacy, first-device migration, and conflict behavior. Without configuration, storage is local only. Browser storage can be cleared or evicted, including on iOS. Use **Options → Backup & settings → Export backup** regularly. Import validates a schema version 1 JSON backup and asks before replacing existing data. Invalid or newer versions are rejected; an unreadable existing store is preserved instead of silently reset. Future schema changes should add an explicit migration before incrementing the supported version.

The original date and current scheduled date are separate. Unfinished eligible tasks appear on the actual local calendar day, not every future day you browse. Deadlines retain their due dates when carried over. Generated recurring occurrences have the stable ID `routineId:local-date`; an occurrence converted from a one-time task retains its original ID. Overrides preserve individual edits and completion history. Late completions are recorded on the actual local day. Checking a future task keeps it in its planned day. The scheduling engine also retains historical weekly-report utilities.

Dates are local calendar strings with noon-based parsing and calendar arithmetic. ISO weeks start on Monday. Tests cover calendar and year boundaries, DST, intervals, carryover, overlapping recurring occurrences, completion reversal, overrides, pause/delete boundaries, deadline integrity and backup validation.

## Install and use offline

Deploy over HTTPS. On iPhone, open in Safari → Share → **Add to Home Screen**. On supported desktop browsers choose Install. The manifest includes standalone display and 192/512px icons, plus an Apple touch icon. After one successful load, the service worker caches the shell and same-origin assets for offline use; task data remains in localStorage. No push notifications are used. The interface uses system fonts. To update the cache strategy in a future release, increment the cache name in `public/sw.js`.

## Structure

- `src/checklist.ts`: editable starter checklist rules and important dates
- `src/engine.ts`: local dates, ISO weeks, recurrence, stable occurrences, carryover, starter data
- `src/mapping.ts`: activity definitions, validated mapping records and chart-ready selectors
- `src/components/MappingPage.tsx`: monthly grid and accessible entry dialogs
- `src/mapping.test.ts`: mapping persistence, validation, chart data and calendar tests
- `src/storage.ts`: local persistence, backup validation and export
- `src/main.tsx`: reusable task rows, navigation, editing, routines, dates, settings
- `src/style.css`: responsive styles, safe-area spacing and reduced motion
- `src/engine.test.ts`: automated scheduling and reliability tests
- `public/`: manifest, offline service worker and app icons

## Verification limits

Automated Chromium checks cover 390px, 430px and desktop layouts, persistence and common editing flows. Native Safari keyboard behavior and installation on a physical iPhone still need device testing. Browser storage is not a substitute for backups.

## Eldly brand

The transparent headphone-student logo at `public/eldly-logo.png` is an original logo inspired by the supplied studying reference. Its PNG app-icon derivatives are used for iOS installation, the web manifest and favicon. It uses a simplified profile rather than a full illustrated scene.

## Feedback sounds

Checkly uses a quick two-tone check sound and a richer ascending day-completion chime. Trackly uses a soft descending cue for red activities, a calm chime and brief thumbs-up for green activities, and its original soft pop for the other colors, after successfully saving a new mark or timed entry. The thumbs-up still appears when sound is muted and stays static with reduced motion. Edits, undo, page loads and automatic homework synchronization stay silent. The Web Audio sounds are synthesized locally and reuse one audio context; they need no files or network access.

This requested sound update enables the new profile once, marked by `soundDesignVersion: 1`; subsequent mute choices are preserved in backups and after refresh. Mute or enable both Checkly and Trackly using Trackly's speaker button or Checkly → Options → Backup & settings → Checkly & Trackly sounds. Packly retains its own sound preference.

## Phone use

Phone use replaces the Screen time label while retaining the stable `screen-time` activity ID and every older duration record. The entry sheet accepts screen-time hours/minutes, pickup count, or both. Blank fields stay unknown; entering 0 records a true zero. Both values belong to the selected local date and are editable in Trackly or Progress.

Progress overlays screen-time bars (hours, left axis) and a pickup line (count, right axis), with separate averages based on days that actually recorded each value. Both series use the same date buckets and filters. Longer periods sum each series independently; original daily records remain available. Pickup counts never contribute to duration totals, and missing counts are not zero-filled.

Backups include the new `{ kind: "phone", minutes?: number, pickups?: number }` records. Existing `{ kind: "duration", minutes }` screen-time records remain valid and are updated to the combined shape only when edited.
