# Astra Dine: video brief

Facts for the Instagram service video and ads, taken only from this project's code, config, docs
and data (`demo-apps/dine`, 19 November 2026). Paths are relative to `demo-apps/dine/`.
`BUILT` = working in code, `PARTIAL` = exists but incomplete, `PLANNED` = mentioned only.
No passwords or keys are included.

## 1. Product summary

| | |
| --- | --- |
| Name in the app | **Astra Dine** (`src/app/layout.tsx`, page titles "… · Astra Dine") |
| One line | Table QR ordering, kitchen display, cashier and an owner dashboard for restaurants (`README.md` line 3) |
| For | Dine-in restaurants (`src/app/page.tsx`: "Astra Dine runs the floor for dine-in restaurants"). Cafés, food courts, hotels: `UNKNOWN`, not targeted anywhere in code. |
| Showcase restaurant | **Kaaram Kitchen**, Benz Circle, Vijayawada: fictional, Andhra food (`scripts/seed.mjs`) |
| Stack | Next.js 16 + React 19 + Tailwind CSS 4 on Supabase (Postgres, Auth, Realtime, Storage) (`package.json`, `src/lib/supabase/`) |

## 2. User roles

Roles: `owner`, `manager`, `cashier`, `kitchen` (`supabase/migrations/0001_schema.sql`, `staff.role`), plus guests with no login. Owners pass every role check (`src/lib/auth.ts`).

| Role | App and route | Can do | Status |
| --- | --- | --- | --- |
| Guest | `/order/<table code>` | Browse menu, order, call staff, ask for the bill, pay by UPI, split, join loyalty, use gift card, rate the meal | BUILT |
| Kitchen | `/kitchen` | See tickets by station, Start cooking, Ready at the pass, mark dishes sold out | BUILT |
| Cashier | `/pos` | Confirm or reject a table's first QR order, answer calls, seat tables, add orders for walk-ins, make the bill, apply rewards, take cash/card/UPI/gift card, confirm UPI arrived, print bill, close table, sell gift cards (`src/app/api/staff/route.ts` actions: confirmOrder, lines, resolveCall, seat, staffOrder, requestBill, applyReward, pay, reviewPayment, close, available, member, issueGift) | BUILT |
| Owner / manager | `/admin` | Everything in section 5 (`src/app/api/admin/route.ts`) | BUILT |

Kitchen and cashier sign in with restaurant code, username and password; the owner with email and password (`src/components/staff-login.tsx`, `src/components/admin/login.tsx`).

## 3. Customer flow

| Step | Screen / route | What's on screen | What the guest taps |
| --- | --- | --- | --- |
| 1. Scan | Phone camera → `/order/<qr_token>` | — | Scan the table's printed QR |
| 2. Menu | `/order/<token>`, Menu tab (`src/components/order/order-app.tsx`) | Restaurant cover photo, logo, tagline, table number; offer banner; loyalty strip; search; filters (Veg only, Bestsellers, Not too spicy); "Most loved here" carousel; sections with photos, prices, veg/non-veg marks, spice level, Telugu dish names; serving hours (e.g. Tiffins 7–11:30 am) | Add, or tap a dish |
| 3. Dish | Dish sheet | Large photo, description, "Usually ready in about N minutes", size, add-ons, "How hot?", note for the kitchen | Add, ₹ |
| 4. Order | "Your order" sheet | Items, quantities, total, "GST of 5% is added on the bill. No service charge." | Send to kitchen |
| 5. Track | Your table tab | Each dish with photo and progress: Waiting for staff to confirm → Sent to kitchen → Cooking → Ready, coming to you → Served | Order more / Get the bill |
| 6. Call staff | Call staff sheet | A waiter, Water, Cutlery, Something else | One tap |
| 7. Bill | Your table tab | Bill number, items, CGST and SGST, total; "Use your reward" if one is ready | Pay ₹… |
| 8. Pay | Pay sheet | Split the bill: one payment or 2–5 ways; "Pay with a UPI app" (opens GPay/PhonePe/Paytm with amount filled in); gift card code | UPI app → "I've paid ₹…" |
| 9. After paying | Your table tab | "Paid. Thank you!", loyalty stamp card, rating for food and service; happy guests get a Google review link with no reward, unhappy ones go to the manager | Stars, Send feedback |

- **QR to table:** each table has a random 18-character hex `qr_token` (`dining_tables.qr_token`, `encode(gen_random_bytes(9), 'hex')`, migration 0001); the URL is `/order/<qr_token>`; the server looks it up with `tableByToken` (`src/lib/server/ops.ts`). The owner can issue a new QR for a table ("newQr", `src/app/api/admin/route.ts`).
- **App or login for guests: No.** The order page and `src/app/api/order/[token]/route.ts` need only the table code. Loyalty asks for a phone number, without OTP (phone OTP is `PLANNED`, `README.md` "Still to connect").
- **First order safety:** a table's first QR order waits for the cashier to confirm it (setting "confirm_first_order", `src/lib/server/ops.ts` placeOrder). BUILT.
- **Languages:** the interface is English. Dish names also show in Telugu (`local_name`, Noto Sans Telugu font, `src/app/layout.tsx`). A Telugu or Hindi interface: `UNKNOWN`/not built.
- **Payments:** UPI deep link straight to the restaurant's own UPI ID (`upiLink`, `src/lib/rules.ts`), BUILT. The guest's "I've paid" is recorded as *claimed*; the bill closes only after the cashier taps Received (`addPayment`, `reviewPayment`, `src/lib/server/ops.ts`), BUILT. Cash and card are recorded at the counter, BUILT. Gift cards, BUILT. Payment gateway: `PLANNED` (`README.md`).

## 4. Cashier dashboard (`/pos`, `src/components/pos/pos-app.tsx`)

- **New orders arrive live** through Supabase Realtime (`src/lib/live.ts`), with a 30-second refresh as a fallback. BUILT.
- **Sound:** different chimes for a QR order to confirm, a table calling and a UPI payment to check, after the cashier taps "Turn sound on" (`src/lib/chime.ts`). The browser tab shows a count, e.g. "(2) Cashier · Astra Dine". BUILT.
- **Screen:** floor plan by area (Ground floor, AC hall, Terrace, `scripts/seed.mjs`) with each table's state: free, confirm order, cooking, bill, paid, calling, minutes seated. Side panel: QR orders to confirm, Tables calling (with minutes waiting), Ready to serve, UPI payments to check, Collected today by mode.
- **Actions:** confirm or reject a QR order; mark calls done; seat a table; add to order; make the bill; use a guest's reward; take payment (UPI, Cash, Card, gift card code); confirm a UPI payment arrived ("Received"); print the bill (browser print, `window.print()`); close the table; sell a gift card. BUILT.
- **Split bill:** the guest splits on their phone (2–5 ways, `order-app.tsx` PaySheet). Split at the counter: `UNKNOWN`/not built as a separate action.
- **Refunds:** not built (no refund action in `src/app/api/staff/route.ts`).
- **Thermal printers:** `PLANNED` (`README.md`); bills print from the browser today.

## 5. Owner / manager dashboard (`/admin`, `src/components/admin/admin-app.tsx`)

| Section | Shows / controls | Status |
| --- | --- | --- |
| Today | Collected, average bill, % ordered by QR, kitchen time; tables seated, waiting on staff, bills asked; latest orders and payments; best sellers today; "Ready to open" setup checklist (`today.tsx`) | BUILT |
| Menu | Categories with serving hours; dishes with photo upload, price, sizes, add-ons, veg/egg/non-veg, spice, station, prep time, tags, on/off (`menu.tsx`, `/api/admin/photo`) | BUILT |
| Tables and QR codes | Add tables in bulk by area, seats, print all QR cards, new QR for a table (`tables.tsx`) | BUILT |
| Staff and devices | Kitchen, cashier and manager logins, roles, switch off, reset password (`staff.tsx`) | BUILT |
| Loyalty | Members, stamps, rewards, visits and spend (`loyalty.tsx`) | BUILT |
| WhatsApp offers | Choose a segment, write the message, download the list as CSV (only members who opted in). Sending from the dashboard needs a WhatsApp Business provider. | PARTIAL |
| Feedback | Ratings and comments; low ratings flagged to handle (`feedback.tsx`) | BUILT |
| Reports | 7/30/90 days: sales, bills, average bill, % by QR, sales by day, busy hours heatmap by weekday, dish sales and slowest sellers (`reports.tsx`, `supabase/migrations/0002_reports.sql`) | BUILT |
| Settings | Name, area, GSTIN, GST %, UPI ID, pay at table on/off, confirm first order on/off, loyalty rules, Google review link, cover photo, logo, tagline, offer with a live phone preview (`settings.tsx`) | BUILT |

- **Live orders and table status** for the owner: Today section, live (`today.tsx` uses `useLive`). BUILT.
- **Menu changes reach guests:** the guest page checks for changes every 4 seconds (`order-app.tsx`, `setInterval(…, 4000)`). BUILT.
- **Multi-outlet:** each account is one restaurant (`staff.restaurant_id`); several outlets under one login: `UNKNOWN`/not built.

## 6. Kitchen view (`/kitchen`, `src/components/kitchen/kitchen-app.tsx`)

Dark display for a TV or tablet. Tickets per table with KOT number, age timer and lines; notes such as "Less spicy" in red. Timer colour by the dish's prep time: green, then amber, then red (`kitchen-app.tsx`). Station tabs: All, Drinks, Desserts, Kitchen, Tandoor. "To make now" totals every open dish. Buttons: Start cooking → Ready at the pass. Sold out dialog switches a dish off for every table. New-ticket chime. Status flow: pending → queued → cooking → ready → served (`LineStatus`, `src/lib/types.ts`). BUILT.

## 7. Integrations

| Integration | Status | Evidence |
| --- | --- | --- |
| Supabase (database, logins, live updates, photos) | BUILT | `src/lib/supabase/`, migrations |
| UPI (deep link to the restaurant's UPI ID) | BUILT | `upiLink`, `src/lib/rules.ts` |
| Payment gateway | PLANNED | `README.md` |
| WhatsApp sending | PLANNED (CSV export BUILT) | `loyalty.tsx`, `README.md` |
| SMS / phone OTP | PLANNED | `README.md` |
| Thermal printer | PLANNED (browser print BUILT) | `README.md`, `pos-app.tsx` |
| Google reviews (link shown to happy guests) | BUILT | `order-app.tsx` AfterPayment, settings `google_review_url` |
| Other POS systems | Not built | no code |
| Hosting (Cloudflare) | PLANNED | `README.md` |

## 8. What makes it different (provable)

- **No app for guests.** Browser page from a QR (section 3).
- **Money never passes through Astra.** UPI goes to the restaurant's own UPI ID (`src/lib/rules.ts`).
- **No fake "I've paid".** The bill closes only after the cashier confirms (`ops.ts` reviewPayment).
- **No commission per order.** There is no fee or commission logic anywhere in the code (searched `src/`). Whether Astra charges per order is a business decision: see section 13.
- **Live across screens.** Supabase Realtime for kitchen, cashier and owner (`src/lib/live.ts`).
- **Separate login per screen.** A kitchen login can't open the cashier (checked in `tests/e2e.mjs`).
- **Prank-proof QR.** A table's first order waits for staff (`ops.ts` placeOrder).
- **Built for Andhra restaurants.** Telugu dish names, veg/non-veg marks, spice levels, GST split into CGST/SGST.
- **Loyalty without an app.** A stamp card on the guest's number, with rewards on the bill (`ops.ts` settleIfPaid, applyReward).
- **Reviews done properly.** A Google review is asked for only from happy guests and with no reward (order route, `route: "google-ask"`).
- **Try before buying.** "Try every screen yourself" makes a private 24-hour copy with all screens (`src/lib/server/trial.ts`).
- **Works without a POS.** It is the cashier screen itself.
- **Setup time:** `UNKNOWN`, never measured.

## 9. Numbers the code can prove

| Number | Source |
| --- | --- |
| Showcase: 43 dishes, 32 tables in 3 areas | `src/lib/sample-menu.ts`, `scripts/seed.mjs` |
| Up to 100 tables added at once; table numbers up to 500 | `addTables` limits, `src/app/api/admin/route.ts` |
| 1–20 of a dish per line | `lineInput`, `src/lib/server/ops.ts` |
| Loyalty card: 2–20 stamps | `stamps_for_reward`, admin route |
| Guest page refreshes every 4 seconds | `order-app.tsx` |
| 40 guest actions per table per minute (spam limit) | `src/app/api/order/[token]/route.ts` |
| Split bill up to 5 ways | `order-app.tsx` PaySheet |
| Kitchen ticket appeared 20–45 ms after the cashier confirmed, in automated tests on a development laptop | output of `tests/e2e.mjs` (a test measurement, not a field result) |

No real-customer results exist yet: `UNKNOWN`.

## 10. Brand

- **Product name:** Astra Dine (`src/app/layout.tsx`).
- **App icon:** `src/app/icon.svg`.
- **Showcase restaurant logo:** `scripts/showcase-photos/_logo.svg`. Food photos (Unsplash licence): `scripts/showcase-photos/*.webp`, credits in `CREDITS.md`. Sales-page screens: `public/showcase/*.webp`.
- **Colours** (`src/app/globals.css`), a Kalamkari-inspired palette:

| Name | Hex | Use |
| --- | --- | --- |
| Indigo | `#27326f` | Primary buttons |
| Indigo deep | `#1b2452` | Dark sections |
| Turmeric | `#e2a01e` | Highlights, main call to action |
| Madder | `#a3301f` | Warnings, "less spicy", late |
| Leaf | `#2c6a3a` | Paid, fresh, on time |
| Ground | `#f5f5f2` | Page background |
| Ink | `#1d1a17` | Text |
| Kitchen dark | `#131416` | Kitchen display |

- **Fonts** (`src/app/layout.tsx`): **Petrona** (serif: dish names, prices, headings), **Atkinson Hyperlegible** (interface text), **Noto Sans Telugu** (Telugu dish names).

## 11. Demo setup for recording

Nothing here touches production; there is no production yet.

1. In `demo-apps/dine`: `npm install`. `.env.local` is already filled; see `.env.example` for the names.
2. If the sample restaurant was never created: `npm run db:migrate`, then `npm run db:seed`. Kitchen, cashier and owner logins are written to `demo-logins.local.txt`, which is never committed.
3. Before recording: `npm run db:fill`, so "Today" and the reports include today's bills.
4. Start the app: `npm run dev` (port 3106).
5. **Open it on the laptop by its Wi-Fi address**, for example `http://<laptop-ip>:3106/`, not `localhost`. The QR codes use the address the laptop is on, and phones on the same Wi-Fi must reach it. Find the IP with `ipconfig`.
6. **Easiest for recording:** on the home page, tap **"Open my copy of the restaurant"** (`src/components/sales/try-restaurant.tsx`). You get a private copy of Kaaram Kitchen, signed in as the owner, with no passwords. The panel at the top of the dashboard has **Kitchen screen**, **Cashier** and **Guest at table 5**, each with "Open here" or a QR code for another device. Pretend guests order every few minutes; the copy is deleted after 24 hours.
7. **To film UPI paying on the phone:** in the copy's Settings, enter a UPI ID you control. The guest's "Pay ₹…" button opens the UPI app with the amount. **Cancel in the UPI app**, then tap "I've paid" to continue the flow.

The demo data is already realistic: the full menu with photos and prices, 32 tables in 3 areas, 366 loyalty members and three weeks of bills. No new seed script is needed.

## 12. Screen-recording checklist

Record phones at 1080×1920 (or the phone's native resolution) and the laptop at 1920×1080. Do a slow, clean run first and keep the best takes. Start every shot 2 seconds before the action.

| # | Device | Route | Start state | Actions (seconds) | Must be visible |
| --- | --- | --- | --- | --- | --- |
| 1 | Phone | Camera → table QR | Printed QR for table 5 (Tables and QR codes → Print all), on a real table | Point camera (2), tap link (1) | QR on a table, the menu opening with the cover photo |
| 2 | Phone | `/order/<token>` | Menu top | Scroll slowly (4), tap a "Most loved" dish photo (2) | Food photos, prices, veg marks, Telugu names |
| 3 | Phone | Dish sheet | Chicken dum biryani | Choose "Less spicy" (2), Add (1), add Chicken 65 (2) | Spice choice, price updating |
| 4 | Phone | Order sheet | 2–3 items in order | View order (1), Send to kitchen (2) | Total, "Send to kitchen" |
| 5 | Laptop + phone together | `/pos` | Cashier open, sound on | Order appears (live), tap "Confirm, send to kitchen" (2) | Table 5 card appearing live, the chime (record audio) |
| 6 | Tablet or laptop | `/kitchen` | Kitchen open, sound on | Ticket appears (live), Start cooking (2), Ready at the pass (2) | "Less spicy" in red, timer, "To make now" |
| 7 | Phone | Your table tab | After step 6 | Watch status change (4) | Cooking → Ready, coming to you |
| 8 | Phone | Call staff | Any time | Call staff → Water (2) | Laptop: "Tables calling: Water" appears |
| 9 | Phone | Your table → Get the bill | Dishes served (cashier taps Served) | Get the bill (2), Pay (2), UPI app opens, cancel, "I've paid" (4) | GST split, Pay ₹…, UPI app with the amount |
| 10 | Laptop | `/pos` | UPI claimed | Tap "Received" (2) | "Check these UPI payments" panel |
| 11 | Phone | Your table | After step 10 | Wait (2), tap stars (3) | "Paid. Thank you!", stamp card, Google review ask |
| 12 | Laptop | `/admin` Today | Owner copy | Scroll slowly (5) | Collected today, live latest orders, best sellers |
| 13 | Laptop | `/admin` Reports | 30 days | Switch 7 → 30 days (2), hover chart (3) | Sales by day, busy hours heatmap, dishes |
| 14 | Laptop + phone | `/admin` Menu, then `/order/<token>` | Guest menu open on the phone | Change a dish's price, or switch it off (4); phone updates within about 4 seconds (5) | Price or "Sold out" changing on the phone |
| 15 | Laptop | `/admin` Settings | — | Change the offer text (3) | Live phone preview updating |

## 13. Open questions for the owner (Siva)

1. **Price and plans.** No price is set anywhere in the code. Setup fee and monthly fee? Prices must end in 999.
2. **Launch offer** for the first restaurants?
3. **Target city or area** for the ads (Vijayawada, Guntur, Vizag…)?
4. **Call to action:** WhatsApp +91 92512 83730 (used on the sales page, `src/app/page.tsx`), or a demo link? A demo link works only after the app is online (domain and Cloudflare pending).
5. **Real customers or results:** none yet. The video must not show or imply clients or results.
6. **Language of the ads:** Telugu, English or both?
7. **Showcase disclaimer:** Kaaram Kitchen is fictional. Should the video say "sample restaurant" on screen?
8. **Commission:** confirm Astra charges no per-order commission, before saying it in an ad.
9. **Setup time** to promise (for example "live in 2 days")? It has never been measured.

## UNKNOWN

- Target segments beyond dine-in restaurants (cafés, food courts, hotels).
- Telugu or Hindi interface (only dish names are in Telugu).
- Split bill at the counter (guests split on their phones).
- Several outlets under one login.
- Setup time.
- Real customer results.
- Price, plans and launch offer.
- Commission policy (business decision).
