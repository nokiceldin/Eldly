# Packly 2.0

A premium one-item-at-a-time packing app. React, TypeScript, Vite, local-first persistence, offline PWA support.

## Features

- Home screen and step-by-step Smart Trip Creator (normal 56 items, tennis 74, weekend, custom).
- Optional destination, dates, climate, laundry, departure time and reminder lead time.
- Adjustable quantities with context-aware starter rules and learning from similar trips after at least two feedback observations.
- Animated one-at-a-time pack / not packed buttons, swipe and keyboard controls, skipped items, repeat rounds, undo.
- Overview with statuses, quantities, critical (★) and last-minute (◷) flags and custom categories/items.
- Departure countdown, final essential-item verification, iCalendar (.ics) alarm export.
- Optional post-trip reflection, quantities feedback, wishes and recurring unused-item hints.
- Saved templates, independent trips, duplication, backup export and import, old localStorage compatibility.
- Light and dark themes, sounds off by default, PWA offline cache.

## Run locally

Install Node.js 20 or later and run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Before publishing, run `npm run build`.

## Publish on Vercel (free)

1. Create a GitHub repository and upload the extracted project's contents (not a wrapping folder).
2. At https://vercel.com/new import the repository.
3. Set framework to Vite, build command `npm run build` and output directory `dist`.
4. Deploy. Your project will receive a `.vercel.app` URL.

Netlify also supports Vite with build command `npm run build` and publish directory `dist`.

## iPhone

Open your HTTPS deployment in Safari. Share -> Add to Home Screen. The icon and web app manifest are included. Open the app online once to cache files for offline use.

## Departure reminders: important limitations

The generated `.ics` file is a calendar event with a reminder alarm. Download it, open/import it using a compatible calendar, and explicitly save the event. **Downloading alone does not schedule a notification.** Check calendar notification permissions on the phone. Background push is not implemented, because a reliable push service requires additional backend infrastructure and user consent. Departure Mode is an in-app countdown and manual re-verification checklist.

## Local data

Data is stored only in the same browser/device's `localStorage`. There is no account or cross-device synchronization. Safari private browsing or clearing website data can erase it. Export and save regular JSON backups using Settings -> Export. The new version continues to read existing `packly-v1` storage rather than overwriting it with a new empty key.

## Development verification

Source was syntax-checked using TypeScript's transpiler, and data logic was exercised with a Node test. This execution environment could not install npm dependencies, so **a full Vite production build and browser integration test have not been completed here**. Run `npm install && npm run build` and exercise the main journeys on your device before relying on the app for an important departure.
