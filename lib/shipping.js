const db = require('../db/database');

const SETTING_KEYS = [
  'shipping_flat_rate_cents',
  'shipping_free_threshold_cents',
  'shipping_express_rate_cents',
  'low_stock_threshold',
];

function getShippingSettings() {
  const rows = db
    .prepare(`SELECT key, value FROM site_settings WHERE key IN (${SETTING_KEYS.map(() => '?').join(',')})`)
    .all(...SETTING_KEYS);
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return {
    flatRateCents: parseInt(map.shipping_flat_rate_cents || '1200', 10),
    freeThresholdCents: parseInt(map.shipping_free_threshold_cents || '25000', 10),
    expressRateCents: parseInt(map.shipping_express_rate_cents || '2500', 10),
  };
}

// method is 'standard' (flat rate, waived over the free threshold) or
// 'express' (always charged — no free-shipping waiver).
function calculateShippingCents(subtotalCents, method = 'standard') {
  const { flatRateCents, freeThresholdCents, expressRateCents } = getShippingSettings();
  if (method === 'express') return expressRateCents;
  if (subtotalCents >= freeThresholdCents) return 0;
  return flatRateCents;
}

function getLowStockThreshold() {
  const row = db.prepare("SELECT value FROM site_settings WHERE key = 'low_stock_threshold'").get();
  return row ? parseInt(row.value, 10) : 3;
}

module.exports = { getShippingSettings, calculateShippingCents, getLowStockThreshold };
