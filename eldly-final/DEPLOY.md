# Deploy Eldly

1. Extract this ZIP. Upload its contents to a GitHub repository. `package.json` must be at the repository root, alongside `src`, `public`, and `index.html`. If updating an old repository, replace its app files with this complete release; keep the folder paths.
2. In Vercel, choose Add New → Project and import that GitHub repository.
3. Framework: Vite. Install: npm install. Build: npm run build. Output directory: dist. Root directory: the repository root. No environment variables, backend or paid API are required.
4. Deploy. On iPhone, open your Vercel URL in Safari → Share → Add to Home Screen.

## Transfer your saved data

The source ZIP does not contain browser data. Before leaving the preview, export your checklist/Trackly history through Progress → More → Export backup (or Checkly → Options → Backup & settings). Also export Packly → Settings & backup → Export all trips.

On the new Vercel site, import the checklist/Trackly backup in Checkly → Options → Backup & settings → Import backup, and import Packly’s backup in Packly → Settings & backup → Import trips. Phone-use records, including pickups, travel with your checklist/Trackly backup. Packly imports add trips to the starter trip already there.

Data stays in the browser on that site; it does not transfer automatically or sync across devices. Keep both backup files.

## Local setup

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Production verification:

```sh
npm test
npm run build
```

This release contains the full Eldly app: Checkly, Trackly, Progress and native Packly. It excludes node_modules, build output, old update ZIPs, Git history and preview-hosting metadata.
