# Out & About: the web app

The working website for Out & About: accounts, gatherings, the map, RSVPs with
private addresses, weather and rain plans, access details, Circles, the Moms and
Dads hubs, profiles, and safety tools (reporting, blocking, verified hosts).

- **Frontend:** React (Vite). Static files, so it runs on GitHub Pages like the waitlist.
- **Backend:** Supabase (accounts, database, security rules). Free tier is enough for the beta.
- **Map:** OpenStreetMap through Leaflet. No key needed.
- **Weather:** Open-Meteo. No key needed.

Plan to put the app at **app.outandaboutsocial.net** so the waitlist page at the main
domain keeps working. When the app is ready for everyone, point the waitlist's
"Join" button at the app.

---

## 1. Create the database (about 10 minutes)

1. Go to [supabase.com](https://supabase.com), sign up (the project email
   outandaboutsocialnet@gmail.com works well), and click **New project**.
   Name it `out-and-about`, choose a strong database password, and pick a US region.
2. When it's ready, open **SQL Editor → New query**. Open `supabase/schema.sql`
   from this folder, copy all of it, paste it in, and click **Run**.
   You should see "Success. No rows returned."
3. Open **Authentication → URL Configuration**:
   - **Site URL:** `https://app.outandaboutsocial.net`
   - **Redirect URLs:** add `https://app.outandaboutsocial.net/**` and `http://localhost:5173/**`
4. Open **Project Settings → API** and keep that tab open. You'll need the
   **Project URL** and the **anon public** key.

> The anon key is safe to put in a website: the security rules in `schema.sql`
> decide what each person can see. **Never** put the `service_role` key in the app.

## 2. Run it on your computer (optional, good for testing)

1. Install [Node.js](https://nodejs.org) version 20 or newer.
2. In this folder, run `npm install`.
3. Copy `.env.example` to a new file named `.env.local` and paste in the two values from step 1.4.
4. Run `npm run dev` and open http://localhost:5173.

## 3. Put it online with GitHub Pages

1. In GitHub (account **Tipsy2nite**), create a new repository named `out-and-about-app`
   and upload everything in this folder **except** `node_modules`, `dist`, and `.env.local`.
2. In the repo, open **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
3. Open **Settings → Pages**. Under **Source**, choose **GitHub Actions**.
4. Open the **Actions** tab. The "Deploy to GitHub Pages" workflow runs on every
   push to `main`; run it once by hand with **Run workflow** if it hasn't started.
5. Custom domain: in **Settings → Pages → Custom domain**, enter
   `app.outandaboutsocial.net`. Then, where you bought the domain, add a DNS record:
   - Type **CNAME**, name/host **app**, value **tipsy2nite.github.io**
6. Once GitHub shows the domain as verified, tick **Enforce HTTPS**.

## 4. Run the community

These are done in the Supabase dashboard under **Table Editor** for now.

- **Verify a person:** table `profiles` → find them → set `verified` to `true`.
  Verified people get a badge and can host gatherings at home.
- **Review reports:** table `reports`. Change `status` to `reviewing` or `closed`
  as you work through them. Urgent safety reports should be handled within an hour.
- **Remove a gathering or post:** delete the row in `events` or `circle_posts`.
- **Ban someone:** **Authentication → Users** → the person → **Ban user**.

## Before inviting the public

- **Sign-in emails:** Supabase's built-in email sender is rate-limited and meant for
  testing. Connect a real sender (Resend, Postmark, or SendGrid) under
  **Authentication → Emails → SMTP Settings**.
- **Weather:** Open-Meteo's free plan is for non-commercial use. Switch to their paid
  plan once the business earns money.
- **Map tiles:** OpenStreetMap's free tiles are fine for a beta. At real traffic, move
  to a tile provider such as MapTiler or Stadia Maps (one-line change in `MapView.jsx`).
- **Legal:** publish the attorney-reviewed Terms of Service and Privacy Policy and
  link them from the footer and sign-up screen (see the Safety & Legal Playbook).

## What's built

| Area | What works |
| --- | --- |
| Accounts | Email sign-in link (no passwords), 18+ birthdate check enforced by the database, profile setup |
| Explore | Upcoming gatherings, search, category filters, verified-host / step-free / quiet filters, map beside the list |
| Map | All gatherings on a real map; home gatherings show a general-area circle only |
| Gatherings | Full event page, RSVP, guest list for people going, first-timer count, familiar faces from your circles |
| Private addresses | Exact address visible only to the host and RSVP'd guests (enforced in the database) |
| Weather | Live forecast for the gathering's time and place, weather watch at 50%+ rain, host rain plan |
| Hosting | Create gatherings with map pin, rain plan, access details, tags, audience; host can move, postpone, cancel, or delete |
| Circles | Create, join, leave; members-only board; Sprout / Grove / Forest levels |
| Moms & Dads | Hub pages, opt-in parent finder by kids' age range, "Say hi" waves, dad hang templates that pre-fill the host form |
| Safety | Report gatherings, people, posts, and circles; block people; hide yourself from guest lists; "tell a friend where you'll be" email to a trusted contact; only verified hosts can host at home |

## Next to build

1. Email or text notifications when a host moves, postpones, or cancels (Supabase Edge Function + Resend).
2. Automated selfie verification (Persona or Stripe Identity) instead of manual review.
3. A simple admin page for reports and verification.
4. Photos on events and profiles (Supabase Storage), with the no-kids'-photos rule.
5. Direct messages after a wave is returned.
6. Host Pro, local partner listings, and paid tickets (Stripe Connect).
7. Phone apps from the same code (Capacitor or React Native).
