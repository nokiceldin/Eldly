# Checkly

A friendly, local-first weekly checklist. React, TypeScript, Vite, Tailwind CSS, Lucide, and Motion. No account, backend, paid API, or cloud sync.

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

Create a GitHub repository, commit this folder (excluding `node_modules` and `dist`), and push it. In Vercel choose **Add New → Project**, import the repository, select **Vite**, use `npm run build` and output directory `dist`. No environment variables are needed. Deploy at the root of the domain. `.openai/hosting.json` is metadata for the optional Sites deployment and is not required by Vercel.

## Start using Checkly

The app is one dark Notes-style page with Monday through Sunday. Opening or returning to the app scrolls to today automatically; tapping the week number also returns from another week. Today gets the screen’s main space, with larger text and check buttons. Other days stay above and below for scrolling. This focuses the view without opening the keyboard. Task titles are neutral white. Weekly recurring occurrences (including odd/even weeks and custom weekly intervals) get a plain “(W)” suffix; daily routines do not. Unfinished tasks carried from earlier days are bold, with no “From” date labels. Original dates are still preserved internally. Completed items are muted with a green checkbox. Tap the blank line under a day, type a task and press Enter. The input stays ready for the next item. Tap the right-hand circular checkbox to complete or undo a task. A green check beside the day heading means everything for that day is done. Checking off the final task shows a brief celebration saying “Finished everything for the day.” It does not replay on refresh; reduced-motion settings disable the particle burst and spring animations.

Swipe a task left to reveal red Delete and release past the threshold to remove it. Short swipes spring back, and vertical scrolling remains native. Undo is available for six seconds. Deleting a recurring occurrence leaves its future schedule intact. The task editor also provides a keyboard-accessible Delete action.

Tap a task title for optional details. Tap the task text to edit; **More actions** inside its editor contains moving up/down and copying to next week. Deletion is also available in the editor. Swipe left/right on a day heading or empty page space to change weeks; task-row swipes still delete only that occurrence. The compact sticky header shows only the week number with accessible previous/next arrows. Tap the week number to return to the current week and today. Opening or resuming always returns to the current week. Current-week and current-day headings have a subtle gold accent.

The top-right **Options** menu keeps repeating tasks, important dates, backups, categories, and sound settings out of the main checklist. Starter examples are optional: choose **Starter checklist → Load starter checklist**. Removing starter examples keeps user-created tasks. Ambiguous starter schedules are editable suggestions. Quiz preparation samples for ISO weeks 4, 7 and 10 use the next calendar year; inspect dates before use.

Routine edits apply from today. Earlier occurrences and completion history stay saved. Pause stops occurrences until resumed without backfilling paused days. Deleting a routine stops future generation and retains history. Important dates use the same linked records in the day checklist.

## Data and backups

All data is stored under `checkly-data-v1` in the current browser's localStorage. There is **no automatic device sync**. Browser storage can be cleared or evicted, including on iOS. Use **Options → Backup & settings → Export backup** regularly. Import validates a schema version 1 JSON backup and asks before replacing existing data. Invalid or newer versions are rejected; an unreadable existing store is preserved instead of silently reset. Future schema changes should add an explicit migration before incrementing the supported version.

The original date and current scheduled date are separate. Unfinished eligible tasks appear on the actual local calendar day, not every future day you browse. Deadlines retain their due dates when carried over. Each recurring occurrence has the stable ID `routineId:local-date`; overrides preserve individual edits and completion history. Late completions are recorded on the actual local day. Checking a future task keeps it in its planned day. The scheduling engine also retains historical weekly-report utilities.

Dates are local calendar strings with noon-based parsing and calendar arithmetic. ISO weeks start on Monday. Tests cover calendar and year boundaries, DST, intervals, carryover, overlapping recurring occurrences, completion reversal, overrides, pause/delete boundaries, deadline integrity and backup validation.

## Install and use offline

Deploy over HTTPS. On iPhone, open in Safari → Share → **Add to Home Screen**. On supported desktop browsers choose Install. The manifest includes standalone display and 192/512px icons, plus an Apple touch icon. After one successful load, the service worker caches the shell and same-origin assets for offline use; task data remains in localStorage. No push notifications are used. The interface uses system fonts. To update the cache strategy in a future release, increment the cache name in `public/sw.js`.

## Structure

- `src/engine.ts`: local dates, ISO weeks, recurrence, stable occurrences, carryover, starter data
- `src/storage.ts`: local persistence, backup validation and export
- `src/main.tsx`: reusable task rows, navigation, editing, routines, dates, settings
- `src/style.css`: responsive styles, safe-area spacing and reduced motion
- `src/engine.test.ts`: automated scheduling and reliability tests
- `public/`: manifest, offline service worker and app icons

## Verification limits

Automated Chromium checks cover 390px, 430px and desktop layouts, persistence and common editing flows. Native Safari keyboard behavior and installation on a physical iPhone still need device testing. Browser storage is not a substitute for backups.
