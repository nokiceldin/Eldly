> **Current account backend:** Neon Free via the private Vercel API. See [ACCOUNTS.md](ACCOUNTS.md) and [CLOUD-SETUP.md](CLOUD-SETUP.md); Supabase setup instructions below are historical.

# Eldinos

Personal Check, Track, Pack and Data, with private accounts and an optional
separate guest workspace. Login persists per device through Supabase Auth.

## Development

Use Node.js 22+ and `npm install`, `npm run dev`, `npm test`, `npm run build`.
Set the two public Supabase variables in an untracked `.env.local` to test
accounts. Without cloud configuration the app opens device-only guest mode.

## Features

- One-time tasks, weekly routines, occurrence-only dragging and due dates.
- Personal tracker labels, recording types, colors and optional goals.
- Date-filtered charts and activity history generated from each user's trackers.
- Weekly/monthly/yearly recaps; the original owner's goals and data are retained.
- Active packing lists, match bags and hidden completed trips with packing memory.
- Account-specific cloud records, device caches and pending offline edits.
- New accounts begin empty. Guest records never merge into a login implicitly.

See [ACCOUNTS.md](ACCOUNTS.md), [CLOUD-SETUP.md](CLOUD-SETUP.md) and
[DEPLOY.md](DEPLOY.md). The `schema.sql` file is historical, not the active schema.
