const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { DATA_DIR } = require('./paths');

// The SQLite database lives in a single file on disk. On most hosts
// (including Render) you need a "persistent disk" mounted at DATA_DIR,
// otherwise the file is wiped every time the app restarts/redeploys.
// See the README for exact setup steps.
const DB_PATH = path.join(DATA_DIR, 'chronique.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// CREATE TABLE IF NOT EXISTS (above) only helps brand-new tables — a
// database created before a column existed needs it added by hand. This
// runs every startup and is a no-op once a column is already there, so it's
// safe to leave in permanently rather than writing one-off migration files.
function ensureColumn(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = existing.some((c) => c.name === column);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('product_variants', 'low_stock_alerted', "INTEGER NOT NULL DEFAULT 0");
ensureColumn('orders', 'payment_intent_id', "TEXT NOT NULL DEFAULT ''");
ensureColumn('orders', 'channel', "TEXT NOT NULL DEFAULT 'online'");
ensureColumn('orders', 'shipping_method', "TEXT NOT NULL DEFAULT 'standard'");
ensureColumn('orders', 'discount_code', "TEXT NOT NULL DEFAULT ''");
ensureColumn('orders', 'discount_cents', "INTEGER NOT NULL DEFAULT 0");
ensureColumn('orders', 'tracking_number', "TEXT NOT NULL DEFAULT ''");
ensureColumn('orders', 'tracking_carrier', "TEXT NOT NULL DEFAULT ''");
// Internal-only notes (e.g. "customer requested gift wrap") — never shown
// to the customer, just visible to whoever's looking at the order in
// admin.
ensureColumn('orders', 'admin_notes', "TEXT NOT NULL DEFAULT ''");
// Set at checkout time when the shipping address falls inside the local
// hand-delivery zone (see config/local-postcodes.json) and isn't a PO Box
// or Parcel Locker. Flagged in /admin and the new-order alert email so you
// know which orders to hand-deliver yourself instead of posting.
ensureColumn('orders', 'is_local_delivery', 'INTEGER NOT NULL DEFAULT 0');
// 'garment' | 'photo' | 'accessory' — chosen in admin when a product is
// created. Drives sensible defaults (sizing, whether a colour picker makes
// sense) without hardcoding behaviour to specific category names.
ensureColumn('products', 'product_type', "TEXT NOT NULL DEFAULT 'garment'");
// JSON array of { title, body } shown as expandable sections on the product
// page (e.g. "Composition & care", "Shipping & returns") — editable per
// product in admin, since not every piece is cut/cared for the same way.
// Empty ('[]', the default for every existing product) falls back to the
// same two generic sections that used to be hardcoded on every page.
ensureColumn('products', 'info_sections', "TEXT NOT NULL DEFAULT '[]'");
// Size guide (the measurements table behind the "Size guide" link next to
// the Size picker). '' (the default) means "work it out from the category"
// like every product used to — 'tops' or 'bottoms' pins this product to
// that measurement chart's shape with its OWN numbers (size_guide_data),
// since two products in the same category can still be cut differently.
// 'none' hides the size guide link entirely for a product that doesn't
// need one.
ensureColumn('products', 'size_guide_type', "TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'size_guide_data', "TEXT NOT NULL DEFAULT '{}'");
// JSON array of collection ids this product belongs to (see the
// `collections` table) — independent of `category`, which only drives the
// shop's filter menu. A product can be in several collections, or none.
ensureColumn('products', 'collections', "TEXT NOT NULL DEFAULT '[]'");
// An event can be showcased with a photo OR a short looping video (like the
// home hero) instead of just a plain photo row. media_type picks which one
// shows; the other stays stored so switching back doesn't lose it.
ensureColumn('events', 'media_type', "TEXT NOT NULL DEFAULT 'photo'");
ensureColumn('events', 'video', "TEXT NOT NULL DEFAULT ''");
// Only one event is featured at a time — the one shown in the big showcase
// panel at the top of the Gathering page, picked explicitly in admin rather
// than just "whichever is soonest".
ensureColumn('events', 'is_featured', 'INTEGER NOT NULL DEFAULT 0');
// Drives the nav's "Curated" filter (/shop?curated=1) — a separate,
// admin-picked set from "New", since a piece can be curated without being
// a brand-new arrival (or vice versa).
ensureColumn('products', 'is_curated', 'INTEGER NOT NULL DEFAULT 0');
// True once a paying customer ticks "Keep me updated" at checkout — the
// webhook adds them to newsletter_subscribers (source 'checkout') only
// after payment actually succeeds, not just because they started checkout.
ensureColumn('orders', 'newsletter_optin', 'INTEGER NOT NULL DEFAULT 0');

// Seed the canonical category list once, the first time this table is
// empty — matches the site's original fixed categories, so the nav's Shop
// menu and the shop page's filter chips start populated (in sync) instead
// of empty. Only runs while the table is empty, so an admin who later
// deletes/renames one doesn't have it silently reappear on next boot.
if (db.prepare('SELECT COUNT(*) AS c FROM categories').get().c === 0) {
  const insertCategory = db.prepare(
    'INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)'
  );
  const startingCategories = [
    'Outerwear',
    'Knitwear',
    'Tees & Sweats',
    'Pants',
    'Leather Goods',
    'Accessories',
  ];
  startingCategories.forEach((name, i) => insertCategory.run(name, i));
  // Also carry over any category already in use by an existing product
  // that isn't in the starting list above, so nothing already live in the
  // shop goes missing from the menu once it switches to this table.
  db.prepare('SELECT DISTINCT category FROM products').all().forEach((r, i) => {
    insertCategory.run(r.category, startingCategories.length + i);
  });
}

module.exports = db;
