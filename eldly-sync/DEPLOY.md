# Deploy Eldly

1. Replace your existing GitHub repository files with the contents of this ZIP. Keep `package.json`, `src`, `public`, and `supabase` directly at the repository root.
2. Follow **CLOUD-SETUP.md** to create your free Supabase project, run the SQL, and create your private login.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to your Vercel project's Environment Variables, then redeploy.
4. Vercel: framework **Vite**, build **npm run build**, output **dist**. No custom server is needed.
5. Sign in on your phone first and choose **Start with this device's data**. Wait for **Saved to cloud**. Then sign in on your laptop and choose **Use cloud data on this device**.

Do not upload `.env.local`, `node_modules`, or `dist` to GitHub. Never use a Supabase secret/service_role key as a Vite environment variable. Keep your existing device backups until both devices match.

For local development: copy `.env.example` to `.env.local`, set its public values, then run `npm install`, `npm test`, and `npm run dev`. A production build is `npm run build`.
