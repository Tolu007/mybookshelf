# Setup

Two accounts are required before the app can run: Supabase (database + auth)
and Google Cloud (Drive API + OAuth). Both have generous free tiers for a
personal library.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run the contents of [`supabase/schema.sql`](supabase/schema.sql)
   against your new project. Every statement is idempotent (`if not exists`,
   `create or replace`, etc.), so whenever this file changes later, just
   re-run the whole thing — no need to track down what's new.
3. Go to **Project Settings -> API** and copy the **Project URL** and the
   **anon public** key.

## 2. Google Cloud OAuth + Drive API

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services -> Library**: enable the **Google Drive API**.
3. **APIs & Services -> OAuth consent screen**: set it up for **External**
   users (you can keep it in "Testing" mode with your own Google account
   added as a test user — no Google review needed for personal use).
4. **APIs & Services -> Credentials -> Create Credentials -> OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (find `<your-project-ref>` in the Supabase project URL from step 1)
5. Copy the generated **Client ID** and **Client secret**.

## 3. Connect Google to Supabase Auth

In the Supabase dashboard: **Authentication -> Providers -> Google**.
Paste in the Client ID and Client secret from step 2, and enable the
provider.

## 4. Local environment

```bash
cp .env.example .env.local
```

Fill in the four values from steps 1 and 2:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and
grant Drive access when prompted. You should land on an empty library screen
— that confirms auth, the database, and the Drive connection are all wired
up correctly.

## Later: deploying

When you're ready to deploy (e.g. to Vercel):

1. Add the same four environment variables in the hosting provider's project
   settings.
2. Add your production URL's callback as an additional **Authorized redirect
   URI** — this still points at Supabase (`https://<your-project-ref>.supabase.co/auth/v1/callback`),
   not your app domain, so no change is needed there.
3. In Supabase **Authentication -> URL Configuration**, add your production
   URL to **Site URL** and **Redirect URLs** so `signInWithOAuth`'s
   `redirectTo` is allowed.
