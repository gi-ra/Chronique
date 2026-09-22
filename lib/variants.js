// Shared logic for deciding which size/colour combinations ("variants") a
// product should have, and for keeping the product_variants table in sync
// when a product's type, category or colour list changes in the admin panel.

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
// Kept for old data created before "product type" existed — categories in
// this list still default to apparel sizing even if their product_type
// column is missing/blank for some reason.
const APPAREL_CATEGORIES = ['Pants', 'Tees & Sweats', 'Knitwear', 'Outerwear'];

const PRODUCT_TYPES = ['garment', 'photo', 'accessory'];

// For photo-type products, the "colour" axis is repurposed as a delivery
// format: a digital file, or one of a few physical print materials. The
// admin picks any combination of these from checkboxes instead of typing a
// colour list.
const PHOTO_FORMATS = ['Digital', 'Canvas', 'Gloss Paper', 'Matte Paper'];

// Default size list for a product type, when the admin hasn't typed a
// custom "Sizes" list. Garments get the standard run; photos and
// accessories are one-off pieces unless the admin overrides it (e.g. print
// sizes like "A4, A3, A2").
function sizesForType(type, category) {
  if (type === 'garment') return APPAREL_SIZES;
  if (!type && APPAREL_CATEGORIES.includes(category)) return APPAREL_SIZES; // legacy fallback
  return ['ONE SIZE'];
}

// Makes sure product_variants for `productId` matches exactly the size x
// colour grid implied by `type`/`colors`. Existing variants that still
// match keep their stock untouched; missing ones are added with the given
// default stock; ones that no longer match anything (e.g. a colour was
// removed) are deleted, and their sales history stays in order_items since
// that table doesn't reference product_variants.id for display.
//
// `sizes` is optional: pass an explicit array (e.g. from an admin-entered
// "Sizes" field) to override the automatic type-based sizing. Leave it
// undefined/null/empty to fall back to sizesForType(type, category).
//
// Photo-type products don't have a real colour choice (photos aren't
// dyed) — the "colour" axis is repurposed as delivery format (Digital,
// Canvas, Gloss Paper, Matte Paper) instead. Anything the admin picks that
// isn't one of PHOTO_FORMATS is dropped; if nothing valid is left, it
// falls back to Digital so every photo product has at least one option.
function syncVariants(db, productId, type, category, colors, defaultStock = 0, sizes = null) {
  const sizeList = sizes && sizes.length ? sizes : sizesForType(type, category);
  let colorList;
  if (type === 'photo') {
    const picked = (colors || []).filter((c) => PHOTO_FORMATS.includes(c));
    colorList = picked.length ? picked : ['Digital'];
  } else {
    colorList = colors && colors.length ? colors : ['Ink'];
  }

  const existing = db
    .prepare('SELECT * FROM product_variants WHERE product_id = ?')
    .all(productId);
  const existingByKey = new Map(existing.map((v) => [`${v.size}__${v.color}`, v]));

  const wantedKeys = new Set();
  const insert = db.prepare(
    'INSERT INTO product_variants (product_id, size, color, stock) VALUES (?, ?, ?, ?)'
  );

  sizeList.forEach((size) => {
    colorList.forEach((color) => {
      const key = `${size}__${color}`;
      wantedKeys.add(key);
      if (!existingByKey.has(key)) {
        insert.run(productId, size, color, defaultStock);
      }
    });
  });

  const del = db.prepare('DELETE FROM product_variants WHERE id = ?');
  existing.forEach((v) => {
    const key = `${v.size}__${v.color}`;
    if (!wantedKeys.has(key)) del.run(v.id);
  });
}

module.exports = {
  APPAREL_SIZES,
  APPAREL_CATEGORIES,
  PRODUCT_TYPES,
  PHOTO_FORMATS,
  sizesForType,
  syncVariants,
};
