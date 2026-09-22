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
// 'garment' | 'photo' | 'accessory' — chosen in admin when a product is
// created. Drives sensible defaults (sizing, whether a colour picker makes
// sense) without hardcoding behaviour to specific category names.
ensureColumn('products', 'product_type', "TEXT NOT NULL DEFAULT 'garment'");

module.exports = db;
