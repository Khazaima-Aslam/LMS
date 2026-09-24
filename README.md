# LeadFlow — Apify → Google Sheets lead generator for Vercel

This project is a private dashboard for extracting public business listings with Apify's Google Maps Scraper and writing the results directly to Google Sheets.

## Features

- Password-protected dashboard
- Master administrator plus admin-managed user accounts
- Admin-only User Accounts dashboard for creating, disabling, promoting, and resetting accounts
- Multiple business keywords
- Location lookup with latitude/longitude
- Radius selection: 1–50 km
- Up to 100 leads per run
- Optional public website contact enrichment through Apify
- Google Sheets output with these columns:
  - Business Name
  - Category
  - Full Address
  - City
  - Country
  - Mobile
  - Landline
  - Email
  - Phone
- Deduplication by normalized business name + address/location
- Existing rows are preserved; only blank cells are filled
- Setup page with connection tests
- Designed for Vercel / Next.js

## 1. Apify setup

1. Create/sign in to your Apify account.
2. Open **Settings → Integrations / API tokens** and create/copy your API token.
3. The default Actor in this project is:

   `compass/crawler-google-places`

4. You do **not** need to copy your friend's run ID. Your own app starts new runs under your own Apify account.

> Apify scraping and enrichment may have usage charges. Email/contact enrichment usually costs more and takes longer.

## 2. Google Cloud + Google Sheets setup

1. Open Google Cloud Console.
2. Create a project, or select your own project.
3. Go to **APIs & Services → Library**.
4. Enable **Google Sheets API**.
5. Go to **IAM & Admin → Service Accounts**.
6. Click **Create Service Account**.
7. Open the new service account → **Keys → Add key → Create new key → JSON**.
8. Download the JSON key file and keep it private.
9. Create a new blank Google Sheet.
10. Share the Sheet as **Editor** with the `client_email` shown inside the service-account JSON.

The app automatically creates the `Leads` tab and headers if they do not exist.

For managed portal accounts, LeadFlow also creates a hidden `_LeadFlowUsers` tab in the same spreadsheet. Passwords are stored only as salted scrypt hashes; plain passwords are never written to Google Sheets.

## 3. Convert the Google JSON key to Base64

### Windows PowerShell

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\service-account.json"))
```

### macOS / Linux

```bash
base64 < service-account.json | tr -d '\n'
```

Copy the resulting single-line Base64 value.

## 4. Vercel environment variables

In Vercel:

**Project → Settings → Environment Variables**

Add:

```text
NEXT_PUBLIC_APP_NAME=LeadFlow

ADMIN_USERNAME=your-admin-name
ADMIN_PASSWORD=use-a-strong-password
AUTH_SECRET=use-a-long-random-secret

APIFY_TOKEN=your-apify-token
APIFY_ACTOR_ID=compass/crawler-google-places

GOOGLE_SPREADSHEET_ID=YOUR_GOOGLE_SHEET_URL_OR_ID
GOOGLE_SHEET_TAB=Leads
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=YOUR_BASE64_JSON
```

Generate `AUTH_SECRET` locally with:

```bash
openssl rand -hex 32
```

On PowerShell, you can use:

```powershell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
```

**Important:** Keep `APIFY_TOKEN`, `ADMIN_PASSWORD`, `AUTH_SECRET`, and the Google service-account JSON server-side. Never rename them with `NEXT_PUBLIC_`.

After adding/changing environment variables, redeploy the Vercel project.

The `ADMIN_USERNAME` / `ADMIN_PASSWORD` account is the permanent **master administrator**. After signing in as the master admin, open **User Accounts** in the sidebar to create separate logins for other staff. Managed accounts can be assigned either **User** or **Admin** role, disabled/enabled, and have their passwords reset without changing Vercel environment variables.

## 5. Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows, create `.env.local` manually instead of using `cp`.

Open:

`http://localhost:3000`

## 6. Deploy to Vercel

### Option A — GitHub (recommended)

1. Unzip this project.
2. Create a GitHub repository.
3. Upload/push the project files.
4. In Vercel choose **Add New → Project**.
5. Import the GitHub repository.
6. Add the environment variables listed above.
7. Deploy.

### Option B — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
vercel --prod
```

Then add the environment variables in the Vercel dashboard and redeploy.

## User account management

- The Vercel environment-variable login remains the master administrator.
- Admin users see **User Accounts** in the left sidebar.
- Managed accounts are stored in the hidden `_LeadFlowUsers` Google Sheet tab.
- Usernames are normalized to lowercase and allow letters, numbers, dot, underscore, and hyphen.
- Managed passwords must be at least 8 characters and are stored using a per-user random salt plus Node.js scrypt hashing.
- Managed admins cannot deactivate themselves or remove their own admin role.
- Normal users cannot access `/admin/users` or the admin user-management API.

## Search behavior

- If valid latitude/longitude are present, the app sends a point-based custom geolocation plus `radiusKm` to Apify.
- If coordinates are absent, the app uses the text location.
- With multiple keywords, the requested result limit is divided across keywords and the final result is trimmed to your total `Maximum leads`.
- Contact enrichment uses Apify's `scrapeContacts` option.
- `Phone` contains the main Google Maps phone and, when available, additional unclassified website phones (deduplicated, up to 3 values).
- `Mobile` and `Landline` are only populated when the returned data explicitly identifies the phone type. The app deliberately does not guess mobile vs. fixed-line numbers.
- The app starts Apify runs asynchronously and polls them. This avoids holding a single Vercel function open for the entire scrape.

## Troubleshooting

### "Google Sheets permission denied"
Share the Google Sheet with the service account's `client_email` as **Editor** and confirm the correct Sheet ID/URL is in Vercel.

### "Apify token test failed"
Create a new Apify API token and update `APIFY_TOKEN`.

### "Portal login is not configured"
Add `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `AUTH_SECRET` in **Vercel → Project → Settings → Environment Variables**, apply them to Production, then redeploy.

### Managed account sign-in is unavailable
Confirm that the Google service-account credentials are configured, the spreadsheet ID is correct, and the spreadsheet is shared with the service-account email as **Editor**. Managed accounts depend on the same Google Sheet connection used for lead storage.

### Extraction is taking a long time
This version starts the Apify run asynchronously and polls its status, so it is not tied to one long Vercel request. Keep the Search Leads page open until the app reports **Import completed**. Contact enrichment can still make Apify runs slower, so use a smaller batch if you need faster results.

### Location cannot be found
Use a simpler value such as `Jubail, Saudi Arabia`, then click **Find**. You may also enter latitude/longitude manually.

## Security notes

- This app uses a signed, HTTP-only session cookie with role information.
- User-management endpoints enforce admin authorization on the server.
- Managed user passwords are stored only as salted scrypt hashes in the hidden `_LeadFlowUsers` tab.
- Credentials never need to be stored in browser localStorage.
- The Setup page shows configuration status, not secret values.
- Rotate any API key or JSON key that is accidentally committed to GitHub or exposed publicly.
- Use lead data in accordance with applicable privacy, anti-spam, website, and platform terms.

## Files to edit for branding

- `NEXT_PUBLIC_APP_NAME` — app name
- `components/Sidebar.tsx` — logo/brand text
- `app/globals.css` — colors and layout

