CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  icon TEXT NOT NULL DEFAULT 'icon-tee',
  colors TEXT NOT NULL DEFAULT '[]',   -- JSON array of colour names
  is_new INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  photos TEXT NOT NULL DEFAULT '[]',   -- JSON array of image URLs
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS news_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '[]',     -- JSON array of paragraph strings
  photos TEXT NOT NULL DEFAULT '[]',   -- JSON array of image URLs
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS studio_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('sound','screen')),
  artist TEXT NOT NULL,
  location TEXT NOT NULL,
  date TEXT NOT NULL,
  video_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gathering_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Events shown on the client-facing Events page and manageable from
-- Admin > Events. event_date is stored as an ISO date (YYYY-MM-DD) so it
-- sorts correctly and the site can split events into upcoming/past.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Each row is one buyable size/colour combination of a product, with its
-- own stock count. size is 'ONE SIZE' for products that don't have sizes
-- (e.g. leather goods, accessories).
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL DEFAULT 'ONE SIZE',
  color TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  low_stock_alerted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(product_id, size, color)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_session_id TEXT UNIQUE,
  payment_intent_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | shipped | refunded | cancelled
  channel TEXT NOT NULL DEFAULT 'online', -- online | manual (phone/in-person, entered by admin)
  customer_email TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  shipping_address TEXT NOT NULL DEFAULT '{}', -- JSON: {line1,line2,city,state,postcode,country}
  shipping_method TEXT NOT NULL DEFAULT 'standard', -- standard | express
  discount_code TEXT NOT NULL DEFAULT '',
  discount_cents INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  tracking_number TEXT NOT NULL DEFAULT '',
  tracking_carrier TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id INTEGER,
  product_name TEXT NOT NULL,   -- snapshot, in case the product changes later
  size TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0
);

-- A code a shopper can enter at checkout for a discount. value is either a
-- whole percent (1-100) or a fixed amount in cents, depending on type.
CREATE TABLE IF NOT EXISTS discount_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('percent','fixed')),
  value INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER, -- NULL = unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- An email address left at one of the site's "subscribe"/"reserve a seat"
-- forms (nav drawer, homepage, Gathering RSVP). source records which one,
-- purely for your own context — all three go into the same mailing list.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A shopper's request to be emailed when a sold-out size/colour is back.
CREATE TABLE IF NOT EXISTS stock_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  email TEXT NOT NULL,
  notified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
