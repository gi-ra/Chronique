const fs = require('fs');
const path = require('path');
const db = require('../db/database');

// The local delivery postcode list is precomputed (see
// config/local-postcodes.json and the note inside it) — this just loads it
// once and builds a fast lookup map of postcode -> distance in km. Edit
// that file by hand to add/remove a postcode; nothing here needs to change.
const LOCAL_POSTCODES_PATH = path.join(__dirname, '..', 'config', 'local-postcodes.json');
const localPostcodesData = JSON.parse(fs.readFileSync(LOCAL_POSTCODES_PATH, 'utf8'));
const LOCAL_POSTCODE_DISTANCE = new Map(
  localPostcodesData.postcodes.map((p) => [p.postcode, p.distanceKm])
);

// Inside this distance, you drive it over yourself; beyond it (but still
// inside the local zone), it's still free but gets booked with a courier
// instead, since it's too far to hand-deliver personally.
const HAND_DELIVERY_RADIUS_KM = 50;

const SETTING_KEYS = [
  'shipping_au_flat_rate_cents',
  'shipping_au_free_threshold_cents',
  'shipping_nz_rate_cents',
  'shipping_row_rate_cents',
  'low_stock_threshold',
];

function getShippingSettings() {
  const rows = db
    .prepare(`SELECT key, value FROM site_settings WHERE key IN (${SETTING_KEYS.map(() => '?').join(',')})`)
    .all(...SETTING_KEYS);
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return {
    auFlatRateCents: parseInt(map.shipping_au_flat_rate_cents || '1000', 10),
    auFreeThresholdCents: parseInt(map.shipping_au_free_threshold_cents || '15000', 10),
    nzRateCents: parseInt(map.shipping_nz_rate_cents || '2000', 10),
    rowRateCents: parseInt(map.shipping_row_rate_cents || '3000', 10),
    localRadiusKm: localPostcodesData.radiusKm,
  };
}

// Matches "PO Box", "P.O. Box", "GPO Box", "Locked Bag", "Parcel Locker"
// and similar in any casing/spacing — these can't be hand-delivered, so
// they fall back to the Rest of Australia rate even inside the local zone.
const PO_BOX_OR_LOCKER_RE =
  /\b(p\.?\s*o\.?\s*box|gpo\s*box|po\s*box|locked?\s*bag|parcel\s*locker|community\s*mail\s*bag|\bcmb\b)\b/i;

function isPoBoxOrParcelLocker(line1, line2) {
  const text = `${line1 || ''} ${line2 || ''}`;
  return PO_BOX_OR_LOCKER_RE.test(text);
}

function normalizeCountry(country) {
  const c = String(country || '').trim().toUpperCase();
  if (c === 'AU' || c === 'AUS' || c === 'AUSTRALIA') return 'AU';
  if (c === 'NZ' || c === 'NZL' || c === 'NEW ZEALAND') return 'NZ';
  return c || 'AU';
}

// The single source of truth for shipping cost — used by both the cart
// page's live quote (so the customer sees the real price before paying)
// and checkout itself (so it can't be tampered with client-side). Address
// fields are the customer's typed shipping address; subtotalCents is the
// product subtotal before shipping/discount.
function calculateShipping({ subtotalCents, country, postcode, line1, line2 }) {
  const settings = getShippingSettings();
  const normalizedCountry = normalizeCountry(country);
  const cleanPostcode = String(postcode || '').trim();

  if (normalizedCountry === 'AU') {
    const isPoBox = isPoBoxOrParcelLocker(line1, line2);
    const distanceKm = LOCAL_POSTCODE_DISTANCE.get(cleanPostcode);
    const isLocalPostcode = distanceKm !== undefined;

    if (isLocalPostcode && !isPoBox) {
      if (distanceKm <= HAND_DELIVERY_RADIUS_KM) {
        return {
          cents: 0,
          isLocalDelivery: true,
          deliveryMethod: 'hand',
          label: 'Free local delivery — hand-delivered by Chronique within 3 business days.',
          note: '',
        };
      }
      return {
        cents: 0,
        isLocalDelivery: true,
        deliveryMethod: 'courier',
        label: 'Local delivery — courier',
        note: '',
      };
    }

    if (subtotalCents >= settings.auFreeThresholdCents) {
      return { cents: 0, isLocalDelivery: false, label: 'Free shipping', note: '' };
    }
    return {
      cents: settings.auFlatRateCents,
      isLocalDelivery: false,
      label: 'Standard shipping',
      note: `Free shipping on orders over $${(settings.auFreeThresholdCents / 100).toFixed(2)}.`,
    };
  }

  if (normalizedCountry === 'NZ') {
    return { cents: settings.nzRateCents, isLocalDelivery: false, label: 'New Zealand shipping', note: '' };
  }

  return {
    cents: settings.rowRateCents,
    isLocalDelivery: false,
    label: 'International shipping',
    note: 'International orders may be charged import duties or taxes by your country. These are paid by the customer on delivery.',
  };
}

function getLowStockThreshold() {
  const row = db.prepare("SELECT value FROM site_settings WHERE key = 'low_stock_threshold'").get();
  return row ? parseInt(row.value, 10) : 3;
}

module.exports = {
  getShippingSettings,
  calculateShipping,
  isPoBoxOrParcelLocker,
  getLowStockThreshold,
};
