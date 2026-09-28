# Chronique — self-hosted site

This is the Chronique storefront as a real, self-hosted application: a small
Node.js server, a SQLite database, a password-protected `/admin` panel where
you can manage all content, and genuine e-commerce built in — no Shopify, no
third-party storefront:

- **Payments** via [Stripe Checkout](https://stripe.com/au) — a hosted,
  secure payment page Stripe provides (so this app never touches or stores
  card numbers), including Apple Pay and Google Pay where the shopper's
  device supports them.
- **Shipping** — priced automatically from the customer's address: free
  local hand-delivery within 100km of Logan Central QLD 4114 (postcode list
  in `config/local-postcodes.json`), a flat Rest-of-Australia rate (waived
  over a threshold you set), and flat New Zealand / Rest-of-World rates.
- **Inventory** — real stock counts per size/colour combination, checked at
  checkout and decremented automatically once an order is paid.
- **Discount codes** — percent-off or fixed-amount codes you create, with an
  optional minimum order and usage limit.
- **Emails** — order confirmations, shipping updates, back-in-stock alerts,
  and low-stock/new-order alerts to you.
- **Orders** — a full order history in `/admin`, plus refunds (with
  automatic restocking) and recording a phone/in-person sale directly.

The public site (`/`) looks and behaves exactly like the version you saw as
a Claude artifact — same design, same pages — but every piece of content
comes from the database, and the shop actually sells things.

## What's inside

```
server.js           the app's entry point
db/                 database setup, schema, and starter content
config/local-postcodes.json  postcodes eligible for free local hand-delivery
lib/stripe.js        sets up the Stripe client from your API key
lib/shipping.js       region-based shipping calculation + low-stock threshold
lib/variants.js       keeps each product's size/colour stock rows in sync
lib/mailer.js         sends transactional emails via Resend
routes/api.js        the public JSON endpoints the site's JavaScript calls, incl. checkout
routes/admin.js      the login-protected admin panel
routes/webhooks.js    Stripe's payment-confirmation webhook
views/               the admin panel's pages (plain HTML forms)
public/              the public site: index.html, css, js, and uploaded images
extracted/           the starter content (from the current design) used to seed the database
```

## 1. Run it on your own computer first

You'll need [Node.js](https://nodejs.org) installed (version 18 or newer).
Open a terminal in this folder and run:

```
npm install
```

This downloads the small number of libraries the server needs. It only
needs to be done once (or again if you change `package.json`).

### Set your admin password

Copy the example environment file:

```
cp .env.example .env
```

Then generate a password hash — this turns the password you choose into
something safe to store (never put your plain password directly in `.env`):

```
npm run hash-password "choose-a-real-password-here"
```

It prints a line like:

```
ADMIN_PASSWORD_HASH=$2a$10$abcdefghijklmnopqrstuvwxyz...
```

Open `.env` in a text editor and paste that whole line in, replacing the
existing `ADMIN_PASSWORD_HASH=` line. While you're in there, also change
`SESSION_SECRET` to any long random string (this just keeps login sessions
secure — mash the keyboard or use a password generator).

### Set up Stripe (so checkout works)

1. Create a free account at [stripe.com](https://dashboard.stripe.com/register).
2. Make sure you're in **Test mode** (toggle in the top right of the Stripe
   dashboard) — this lets you run through a full checkout with fake card
   numbers before you ever take a real payment.
3. Go to **Developers → API keys** and copy the **Secret key** (starts with
   `sk_test_...`). Paste it into `.env` as `STRIPE_SECRET_KEY`.
4. You also need a **webhook** — this is how Stripe tells your app "this
   order was paid" so it can mark the order paid and reduce stock. The
   easiest way to test this locally is the
   [Stripe CLI](https://docs.stripe.com/stripe-cli):
   ```
   stripe listen --forward-to localhost:3000/webhooks/stripe
   ```
   It prints a `whsec_...` value — paste that into `.env` as
   `STRIPE_WEBHOOK_SECRET`. Leave this command running in its own terminal
   while you test checkout locally.
5. Test a purchase using [Stripe's test card numbers](https://docs.stripe.com/testing)
   — `4242 4242 4242 4242`, any future expiry date, any 3-digit CVC, any
   postcode. Real card numbers are declined in test mode.

When you're ready to take real payments, switch the Stripe dashboard out of
test mode, generate a **live** secret key and webhook (see the production
section below for the live webhook URL), and swap both values in your
production environment. Test and live keys are always kept separate by
Stripe, so there's no risk of accidentally mixing them up.

### Set up email (optional, but recommended)

Order confirmations, shipping updates, back-in-stock alerts, and "new
order"/"low stock" alerts to you all go through
[Resend](https://resend.com), which has a free tier (100 emails/day) and
needs no credit card to try.

1. Create a free account at [resend.com](https://resend.com/signup).
2. Go to **API Keys → Create API Key** and paste it into `.env` as
   `RESEND_API_KEY`.
3. Leave `MAIL_FROM` as the default shared address
   (`onboarding@resend.dev`) to start — it works immediately. To send from
   your own address (e.g. `orders@chronique.au`), verify that domain under
   **Domains** in the Resend dashboard first, then update `MAIL_FROM`.
4. Set `ADMIN_ALERT_EMAIL` to the address that should get "new order" and
   "low stock" emails — usually your own.

If you skip this section, the app still works — it just prints what it
would have emailed to the server log instead of sending it, which is fine
for trying things out locally.

### Set your shipping rates and low-stock threshold

Once the server's running, log into `/admin` → **Site images** and scroll to
**Shipping** to set:
- your **Rest of Australia rate** and the **free-shipping threshold** it's
  waived over,
- your **New Zealand** and **Rest of World** flat rates,
- your **low-stock threshold** — the units-remaining number that triggers a
  warning banner on the dashboard and (if `ADMIN_ALERT_EMAIL` is set) an
  email, once per dip below the line.

Free local hand-delivery (within 100km of Logan Central QLD 4114) doesn't
have a settable rate — it's always free, and always hand-delivered by you
rather than posted. It's driven by `config/local-postcodes.json`, a plain
list of postcodes you can add to or remove from by hand at any time — no
code changes needed. A PO Box or Parcel Locker address inside that zone
gets the Rest of Australia rate instead, since those can't be
hand-delivered.

These settings start at sensible defaults ($10 / $150 / $20 / $30) until
you change them — updates apply to every checkout from that point on.

### Load the starter content

```
npm run seed
```

This creates the database file (`chronique.db`) and fills it with the
products, news posts, videos and photos the site currently has (each
product seeded with 10 units of stock per size/colour), copying their
images into `public/uploads/`. You only need to run this once — run it
again later and it will skip anything already there rather than
duplicating it.

### Start the server

```
npm start
```

Visit **http://localhost:3000** to see the site, and
**http://localhost:3000/admin** to log in and manage content (use the
username from your `.env` — `admin` by default — and the password you chose
above, not the hash).

Press `Ctrl+C` in the terminal to stop the server.

## 2. What you can do from `/admin`

- **Products** — add, edit, delete, and reorder pieces; upload photos
  directly (the first photo becomes the main image); set price, category,
  colours, size-guide category, and the "New" badge. Apparel categories
  (`Pants`, `Tees & Sweats`, `Knitwear`, `Outerwear`) automatically get a
  size run (XS–XL); anything else is sold as one size. Every size/colour
  combination gets its own **stock** number, editable right on the product's
  edit page — the public product page automatically greys out and disables
  any size or colour that's sold out, and blocks checkout on it.
- **Orders** — every order (online, and any you record by phone/in-person),
  with customer details, shipping address, line items, and totals. From an
  order's page you can mark it shipped (with a carrier + tracking number,
  which emails the customer) or refund it — refunding an online order
  refunds the Stripe payment and puts the items back in stock; refunding a
  manual order just restocks. You can also export all orders, or all
  products with their stock, as a CSV file (handy for tax time or a
  spreadsheet).
- **Discount codes** — create a code, choose percent-off or a fixed amount,
  and optionally set a minimum order or a maximum number of uses. Disable
  or delete a code any time.
- **News** — write posts with a title, date, and body text, and upload the
  photo essay for each one.
- **Studio** — add Sound and Screen sessions: artist, location, date,
  a YouTube link or video ID, description, and a thumbnail photo.
- **Gathering** — upload and reorder the photos shown on the Gathering page.
- **Site images** — replace the big hero photos on Home, About, and
  Gathering, and set your shipping rates and low-stock threshold.

The dashboard (`/admin`) also shows revenue for today/this week/all time,
your best-selling products, and warnings for anything running low or sold
out.

Everything you save there is live on the public site immediately — no
rebuild step.

## How checkout actually works

- A shopper adds sizes/colours to their bag (stored in their browser, so it
  survives a page refresh but isn't tied to an account — there are no
  shopper accounts). If a size/colour is sold out, they can leave their
  email to be notified when it's back — that's the `stock_notifications`
  table, checked automatically whenever you top up a variant's stock in
  `/admin`.
- On the **bag** page, they enter their shipping address and see the real
  shipping cost calculated live from it (free local hand-delivery, Rest of
  Australia, New Zealand, or Rest of World — see "Shipping" above), and can
  enter a discount code, which is checked live against your discount codes
  (a wrong or expired code shows an error without blocking checkout).
- **Checkout** re-validates everything server-side (never trusts what the
  browser sent) — stock, the discount code, the shipping cost — creates a
  pending order in the database, and redirects to a Stripe-hosted payment
  page. Card details are entered on Stripe's own page and never pass
  through this server; Apple Pay/Google Pay show automatically on
  supported devices once your Stripe account has them enabled (they're on
  by default for new accounts — check **Settings → Payment methods** in
  the Stripe dashboard if they don't appear).
- Once Stripe confirms payment, it calls this app's webhook
  (`/webhooks/stripe`), which marks the order **paid**, decrements stock
  for exactly what was bought, counts the discount code as used, sends the
  customer a confirmation email, sends you a "new order" email (if
  `ADMIN_ALERT_EMAIL` is set), and — if any item's stock just dropped to or
  below your low-stock threshold — sends you that alert too. This webhook
  step is what actually reduces inventory, not the moment someone clicks
  "Checkout" — so it must be correctly configured (see below) for stock,
  order status and emails to update.
- The shopper is then shown an order confirmation page with their items and
  total.

One honest limitation worth knowing: stock is checked when a shopper starts
checkout, but only reserved (decremented) once they actually pay. On a
very popular, nearly-sold-out item, two shoppers could both pass that check
on the very last unit and both complete payment — a small race condition
that's standard for a store this size, but worth knowing about if you ever
sell something with extremely limited stock.

## 3. Deploying so it's live on the internet

You said you'd like a simple platform like **Render**, so here's that path.
(Railway and similar platforms work almost identically.)

### Put the code on GitHub

Render deploys from a GitHub repository. If you're new to this:

1. Create a free account at [github.com](https://github.com) if you don't
   have one.
2. Create a new, empty repository (any name, e.g. `chronique-site`).
3. From a terminal in this project folder, run:
   ```
   git init
   git add .
   git commit -m "Chronique self-hosted site"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/chronique-site.git
   git push -u origin main
   ```
   (`.env` and the database file are already excluded via `.gitignore`, so
   your password hash never gets uploaded.)

### Create the service on Render

1. Sign up at [render.com](https://render.com) and click **New +** →
   **Web Service**.
2. Connect your GitHub account and pick the repository you just pushed.
3. Fill in:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Under **Environment Variables**, add:
   - `SESSION_SECRET` — a long random string
   - `ADMIN_USERNAME` — your chosen username
   - `ADMIN_PASSWORD_HASH` — the hash `npm run hash-password` printed
     (generate a fresh one for production rather than reusing a local test
     password)
   - `DATA_DIR` — set this to `/data` (see next step — this is important)
   - `SITE_URL` — your Render URL once you have it, e.g.
     `https://chronique.onrender.com` (or your own domain) — no trailing
     slash. This is used to build the Stripe success/cancel links.
   - `STRIPE_SECRET_KEY` — your **live** secret key from Stripe once you're
     ready to take real payments (use a test key first to try the whole
     flow safely)
   - `STRIPE_WEBHOOK_SECRET` — see the next step
   - `RESEND_API_KEY`, `MAIL_FROM`, `ADMIN_ALERT_EMAIL` — for order/shipping
     emails and alerts (optional, but recommended — see the email setup
     section above)

### Add a persistent disk (important!)

Render's normal filesystem is wiped every time you redeploy. Since your
database (`chronique.db`) and uploaded photos live on disk, you need a
**persistent disk** so they survive:

1. On your new service's page, go to **Disks** → **Add Disk**.
2. Mount path: `/data`
3. Size: 1 GB is plenty to start.

With `DATA_DIR=/data` set above, both the database file and every photo you
upload through `/admin` are written there, so they survive redeploys.
Without a persistent disk (or without setting `DATA_DIR`), Render wipes
everything you've added on every redeploy — the disk is what makes this
permanent.

### First run in production

After the first deploy, open a **Shell** from your Render service's
dashboard and run:

```
npm run seed
```

This populates the fresh database on the persistent disk with the starter
content. From then on, everything you add through `/admin` is permanent.

### Add your production Stripe webhook

Once your site is live at its real URL:

1. In the Stripe dashboard (in **Live mode**, once you're ready for real
   payments — or Test mode to keep testing on the live URL first), go to
   **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://your-domain-here/webhooks/stripe`
3. Select the event **`checkout.session.completed`**.
4. Stripe shows you a **Signing secret** (`whsec_...`) — set that as
   `STRIPE_WEBHOOK_SECRET` in Render's environment variables.

Without this step, Stripe will still take payment, but this app will never
find out — orders will stay "pending" and stock won't be reduced. If that
ever happens, the **Orders** page in `/admin` and the **Events** list in
your Stripe dashboard are the first places to check.

## Limitations, honestly

- Stock is checked at the start of checkout but only reserved once payment
  completes, which leaves a small race-condition window on the very last
  unit of something (explained above under "How checkout actually works").
  Fine for a store this size; worth knowing if you ever run extremely
  limited drops.
- There's no sales tax/GST calculation — prices are treated as final. If you
  need to charge GST, either build it into your listed prices or extend
  `routes/api.js`'s checkout-session creation to add a Stripe tax line.
- The admin login is a single shared username/password, not individual
  staff accounts.
- No customer accounts or order-tracking lookups for shoppers — a shopper
  who wants a status update needs to contact you (or you email them when
  you mark an order shipped). This mirrors a simple checkout flow, not a
  full account system.
- Discount codes apply to the whole order, not specific products, and don't
  stack (only one code per order).
- Refunding an order refunds the full amount — there's no partial refund
  from `/admin` (do that from your Stripe dashboard if you need it, and
  adjust stock by hand afterwards since the automatic restock assumes a
  full refund).
