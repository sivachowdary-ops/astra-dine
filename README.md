# Astra Dine

Table QR ordering, kitchen display, cashier and an owner dashboard for restaurants, on Supabase.
Four separate apps in one codebase, each with its own address and its own sign-in:

| App | Address | Who | Sign-in |
| --- | --- | --- | --- |
| Customer ordering | `/order/<table code>` (from the table's QR) | Guests | None |
| Kitchen display | `/kitchen` | Kitchen tablet or TV | Restaurant code, username, password |
| Cashier | `/pos` | Counter computer or tablet | Restaurant code, username, password |
| Admin dashboard | `/admin` | Owner and managers | Email and password; new restaurants sign up here |

After a domain is bought, each app can have its own subdomain (`order.`, `kitchen.`, `pos.`,
`admin.`) pointing at the same deployment.

## Set up

1. Create a Supabase project (region: Mumbai). Fill in `.env.local` from `.env.example`.
2. `npm install`
3. `npm run db:migrate` creates the tables, security rules, report functions and the photo bucket.
4. `npm run db:seed` creates the showcase restaurant, Kaaram Kitchen, with its menu, 32 tables,
   members and 60 days of past bills. Its logins are written to `demo-logins.local.txt`.
5. `npm run dev` (port 3106). Phones on the same Wi-Fi can scan the table QR codes; a public
   deployment makes them work anywhere.

Optional: set `SIGNUP_CODE` so only people with the code can create a restaurant.

## How it fits together

- Every change goes through the server (`src/app/api`), which checks who is asking: the table's
  QR code for guests, the staff login and role for everyone else. Prices always come from the
  menu in the database.
- Staff screens read their own restaurant directly from Supabase (row level security) and update
  live through Supabase Realtime.
- Guests never get database access. Their phone checks for updates every few seconds.
- A table's first QR order waits for the cashier to confirm it (switchable), so nobody can
  order from outside the restaurant.
- Guests pay by UPI straight to the restaurant's UPI ID (no payment gateway needed); the cashier
  confirms each payment arrived. Cash, card and gift cards are taken at the counter.
- Loyalty: one stamp per visit over a set amount; a full card unlocks a reward. Happy guests are
  asked, with no reward, to post a Google review; unhappy ones go to the manager.

## Still to connect for a live restaurant

- Hosting (Cloudflare Workers through OpenNext, like the website) and the domain.
- A WhatsApp Business provider, to send offers from the dashboard (today the dashboard downloads
  the list with personalised messages).
- Phone OTP for loyalty sign-in, if the restaurant wants numbers verified.
- A payment gateway, if the restaurant wants UPI payments confirmed automatically.
- Thermal printers for paper KOTs and bills, if wanted (bills print from the browser today).
