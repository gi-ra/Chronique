const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { UPLOADS_DIR } = require('../db/paths');
const { requireAdmin } = require('../middleware/auth');
const { syncVariants, PHOTO_FORMATS, sizesForType } = require('../lib/variants');
const { getLowStockThreshold } = require('../lib/shipping');
const { sendBackInStockEmail, sendShippingUpdateEmail } = require('../lib/mailer');
const { getStripe } = require('../lib/stripe');
const { parseShopifyCsv, downloadProductImages, stripDangerousTags, slugify: csvSlugify } = require('../lib/shopifyImport');
const { DEFAULT_GUIDES, defaultGuideTypeForCategory } = require('../lib/sizeGuide');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage });
// Home hero can be a video, so this upload instance allows larger files
// (photos above use the default multer instance with no special limit).
const heroUpload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

function toUrl(filename) {
  return `/uploads/${filename}`;
}

/* ---------------- LOGIN / LOGOUT ---------------- */
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedHash = process.env.ADMIN_PASSWORD_HASH || '';

  if (!expectedHash) {
    return res.render('login', {
      error: 'No admin password is set up yet. Run "npm run hash-password" and add the result to your .env file.',
    });
  }

  const ok = username === expectedUser && bcrypt.compareSync(password || '', expectedHash);
  if (!ok) {
    return res.render('login', { error: 'Wrong username or password.' });
  }
  req.session.isAdmin = true;
  res.redirect('/admin');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// Everything below this line requires being logged in.
router.use(requireAdmin);

/* ---------------- DASHBOARD ---------------- */
router.get('/', (req, res) => {
  const counts = {
    products: db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
    news: db.prepare('SELECT COUNT(*) AS n FROM news_posts').get().n,
    sound: db.prepare("SELECT COUNT(*) AS n FROM studio_sessions WHERE type='sound'").get().n,
    screen: db.prepare("SELECT COUNT(*) AS n FROM studio_sessions WHERE type='screen'").get().n,
    gathering: db.prepare('SELECT COUNT(*) AS n FROM gathering_photos').get().n,
    orders: db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,
    paidOrders: db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('paid','shipped')").get().n,
    leads: db.prepare('SELECT COUNT(*) AS n FROM newsletter_subscribers').get().n
      + db.prepare('SELECT COUNT(*) AS n FROM stock_notifications').get().n,
  };

  const revenue = {
    today: db
      .prepare(
        "SELECT COALESCE(SUM(total_cents),0) AS n FROM orders WHERE status IN ('paid','shipped') AND date(created_at) = date('now')"
      )
      .get().n,
    week: db
      .prepare(
        "SELECT COALESCE(SUM(total_cents),0) AS n FROM orders WHERE status IN ('paid','shipped') AND created_at >= datetime('now', '-7 days')"
      )
      .get().n,
    allTime: db
      .prepare("SELECT COALESCE(SUM(total_cents),0) AS n FROM orders WHERE status IN ('paid','shipped')")
      .get().n,
  };

  const bestSellers = db
    .prepare(`
      SELECT oi.product_name AS name, SUM(oi.quantity) AS units, SUM(oi.quantity * oi.unit_price_cents) AS revenueCents
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN ('paid','shipped')
      GROUP BY oi.product_name
      ORDER BY units DESC
      LIMIT 5
    `)
    .all();

  const lowStockThreshold = getLowStockThreshold();
  const lowStock = db
    .prepare(`
      SELECT pv.*, p.name AS productName
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.stock > 0 AND pv.stock <= ?
      ORDER BY pv.stock ASC
      LIMIT 10
    `)
    .all(lowStockThreshold);
  const outOfStock = db
    .prepare(`
      SELECT pv.*, p.name AS productName
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.stock = 0
      LIMIT 10
    `)
    .all();

  res.render('dashboard', { counts, revenue, bestSellers, lowStock, outOfStock });
});

/* ================= PRODUCTS ================= */
// Distinct category names already in use, so the admin form can offer them
// as suggestions — this is also exactly the list that becomes the shop's
// category menu (see GET /api/categories), so picking from it (or typing a
// new one) is literally editing that menu.
// Composition & care / Shipping & returns / any other custom section shown
// on a product's page. Submitted as parallel arrays (one <input>/<textarea>
// pair per section, added/removed in the browser) — zipped back together
// here and blank ones dropped, so an admin who clears a row just removes it.
function parseInfoSections(req) {
  const titles = [].concat(req.body.infoTitle || []);
  const bodies = [].concat(req.body.infoBody || []);
  const sections = [];
  titles.forEach((title, i) => {
    const t = (title || '').trim();
    const b = (bodies[i] || '').trim();
    if (t && b) sections.push({ title: t, body: b });
  });
  return sections;
}

// The size guide editor posts one input per (size, column) cell, named
// "sizeGuideValue_<SIZE>_<columnIndex>" — multer doesn't do the nested
// bracket-notation parsing express.urlencoded does, so this is the plainest
// naming that survives a multipart form untouched.
function parseSizeGuide(req, sizeList) {
  const type = ['tops', 'bottoms', 'none'].includes(req.body.sizeGuideType) ? req.body.sizeGuideType : '';
  if (type !== 'tops' && type !== 'bottoms') {
    return { type, data: {} };
  }
  const columns = DEFAULT_GUIDES[type].columns;
  const rows = {};
  (sizeList.length ? sizeList : []).forEach((size) => {
    const values = columns.map((_, i) => {
      const raw = req.body[`sizeGuideValue_${size}_${i}`];
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : 0;
    });
    rows[size] = values;
  });
  return { type, data: { columns, rows } };
}

// Builds the rows the size-guide editor should show for `type` (tops or
// bottoms) and `sizes`: the product's own saved numbers where it has them,
// falling back to the shared default guide's numbers for a size it shares
// with that default, and 0 for a size neither has (e.g. a custom run).
function buildSizeGuideRows(type, sizes, storedData) {
  if (!type) return { columns: [], rows: {} };
  const columns = DEFAULT_GUIDES[type].columns;
  const defaultRows = DEFAULT_GUIDES[type].rows;
  const storedRows = (storedData && storedData.rows) || {};
  const rows = {};
  sizes.forEach((size) => {
    rows[size] = storedRows[size] || defaultRows[size] || columns.map(() => 0);
  });
  return { columns, rows };
}

const DEFAULT_INFO_SECTIONS = [
  {
    title: 'Composition & care',
    body: 'Made from responsibly sourced natural fibres. Machine wash cold, inside out, and lay flat to dry to preserve the shape.',
  },
  {
    title: 'Shipping & returns',
    body: 'Standard and express shipping available across Australia, with free standard shipping over $250. Unworn pieces can be returned within 30 days for a full refund.',
  },
];

function existingCategories() {
  return db
    .prepare('SELECT name FROM categories ORDER BY sort_order ASC')
    .all()
    .map((r) => r.name);
}

// Registers a category typed into "+ Add new category…" on the product
// form, so it sticks in the canonical list (and therefore both the nav and
// shop menus) even after this product is edited again or deleted.
function ensureCategoryExists(name) {
  if (!name) return;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories').get().m;
  db.prepare('INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?, ?)').run(name, maxOrder + 1);
}

// All collections, in display order, for the product form's checklist.
function allCollections() {
  return db.prepare('SELECT * FROM collections ORDER BY sort_order ASC').all();
}

// How many products currently sit in each collection — for the admin
// collections list, purely informational.
function collectionProductCounts() {
  const counts = {};
  db.prepare('SELECT collections FROM products').all().forEach((row) => {
    JSON.parse(row.collections || '[]').forEach((cid) => {
      counts[cid] = (counts[cid] || 0) + 1;
    });
  });
  return counts;
}

// The product form posts checkboxes for existing collections ("collections")
// plus a free-text field ("newCollections", comma separated) for brand new
// ones typed on the spot — any name typed there is created here (if it
// doesn't already exist) and included in the returned list, exactly like
// typing "+ Add new category" does for category.
function parseCollections(req) {
  const checked = [].concat(req.body.collections || []);
  const newNames = (req.body.newCollections || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const newIds = newNames.map((name) => {
    let id = slugify(name);
    if (!id) return null;
    let uniqueId = id;
    let n = 2;
    while (db.prepare('SELECT 1 FROM collections WHERE id = ? AND name != ?').get(uniqueId, name)) {
      uniqueId = `${id}-${n}`;
      n += 1;
    }
    const exists = db.prepare('SELECT 1 FROM collections WHERE id = ?').get(uniqueId);
    if (!exists) {
      const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM collections').get().m;
      db.prepare('INSERT INTO collections (id, name, sort_order) VALUES (?, ?, ?)').run(uniqueId, name, maxOrder + 1);
    }
    return uniqueId;
  }).filter(Boolean);

  return [...new Set([...checked, ...newIds])];
}

router.get('/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY sort_order ASC').all();
  const threshold = getLowStockThreshold();
  const stockRow = db.prepare(
    'SELECT COALESCE(SUM(stock),0) AS total, COALESCE(MIN(stock),0) AS lowest FROM product_variants WHERE product_id = ?'
  );
  res.render('products/list', {
    products: products.map((p) => {
      const s = stockRow.get(p.id);
      let stockState = 'ok';
      if (s.total === 0) stockState = 'out';
      else if (s.lowest <= threshold) stockState = 'low';
      return { ...p, photos: JSON.parse(p.photos || '[]'), totalStock: s.total, stockState };
    }),
  });
});

router.post('/products/:id/duplicate', (req, res) => {
  const original = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!original) return res.status(404).send('Product not found');

  let newId = `${original.id}-copy`;
  let n = 2;
  while (db.prepare('SELECT 1 FROM products WHERE id = ?').get(newId)) {
    newId = `${original.id}-copy-${n}`;
    n += 1;
  }
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM products').get().m;

  db.prepare(`
    INSERT INTO products (id, name, category, price, icon, colors, is_new, description, photos, sort_order, product_type, info_sections, size_guide_type, size_guide_data, collections)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    `${original.name} (copy)`,
    original.category,
    original.price,
    original.icon,
    original.colors,
    0,
    original.description,
    original.photos,
    maxOrder + 1,
    original.product_type,
    original.info_sections,
    original.size_guide_type,
    original.size_guide_data,
    original.collections || '[]'
  );

  const colorList = JSON.parse(original.colors || '[]');
  const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(original.id);
  const sizeList = [...new Set(variants.map((v) => v.size))];
  syncVariants(db, newId, original.product_type, original.category, colorList, 0, sizeList);

  res.redirect(`/admin/products/${newId}/edit`);
});

router.get('/products/new', (req, res) => {
  res.render('products/form', {
    product: null,
    categories: existingCategories(),
    collections: allCollections(),
    photoFormats: PHOTO_FORMATS,
    defaultInfoSections: DEFAULT_INFO_SECTIONS,
    sizeGuideEditorTops: buildSizeGuideRows('tops', ['XS', 'S', 'M', 'L', 'XL'], {}),
    sizeGuideEditorBottoms: buildSizeGuideRows('bottoms', ['XS', 'S', 'M', 'L', 'XL'], {}),
  });
});

/* ---- Bulk import from a Shopify "Export products" CSV ---- */
const csvUpload = multer({ storage: multer.memoryStorage() });

router.get('/products/import', (req, res) => {
  res.render('products/import', { result: null });
});

router.post('/products/import', csvUpload.single('csvFile'), async (req, res) => {
  if (!req.file) {
    return res.render('products/import', { result: { error: 'Choose a CSV file first.' } });
  }

  let parsed;
  try {
    parsed = parseShopifyCsv(req.file.buffer.toString('utf8'));
  } catch (err) {
    return res.render('products/import', {
      result: { error: `Could not read that file as a Shopify products CSV (${err.message}).` },
    });
  }

  if (!parsed.length) {
    return res.render('products/import', { result: { error: 'No products found in that file.' } });
  }

  const imageFailures = await downloadProductImages(parsed, UPLOADS_DIR);

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, price, icon, colors, is_new, description, photos, sort_order, product_type)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'garment')
  `);
  const insertVariant = db.prepare(
    'INSERT INTO product_variants (product_id, size, color, stock) VALUES (?, ?, ?, ?)'
  );

  const imported = [];
  const skipped = [];

  const tx = db.transaction(() => {
    parsed.forEach((p) => {
      if (!p.title) {
        skipped.push({ handle: p.handle, reason: 'No product title found on any row.' });
        return;
      }
      let id = csvSlugify(p.handle) || csvSlugify(p.title);
      let n = 2;
      while (db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) {
        id = `${csvSlugify(p.handle) || csvSlugify(p.title)}-${n}`;
        n += 1;
      }

      const category = p.type || p.productCategory || 'Uncategorized';
      const price = p.variants.find((v) => v.price != null)?.price || 0;
      const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM products').get().m;

      // Collapse this product's variant rows into a distinct colour list
      // (in first-seen order) and a stock lookup per (size, colour) — a
      // product with no real colour option gets a single blank-colour
      // bucket that becomes "Ink" below, same default as a manual add.
      const colorsSeen = [];
      const stockByKey = new Map();
      p.variants.forEach((v) => {
        const color = v.color || '';
        if (color && !colorsSeen.includes(color)) colorsSeen.push(color);
        stockByKey.set(`${v.size}__${color}`, (stockByKey.get(`${v.size}__${color}`) || 0) + v.qty);
      });
      const colorList = colorsSeen.length ? colorsSeen : ['Ink'];

      const photos = p.localImages && p.localImages.length ? p.localImages : [];

      insertProduct.run(
        id,
        p.title,
        category,
        price,
        'icon-tee',
        JSON.stringify(colorList),
        stripDangerousTags(p.bodyHtml),
        JSON.stringify(photos),
        maxOrder + 1
      );

      if (p.variants.length) {
        p.variants.forEach((v) => {
          const color = v.color || colorList[0];
          insertVariant.run(id, v.size, color, v.qty);
        });
      } else {
        insertVariant.run(id, 'ONE SIZE', colorList[0], 0);
      }

      imported.push({ id, name: p.title, variantCount: Math.max(1, p.variants.length) });
    });
  });
  tx();

  res.render('products/import', {
    result: { imported, skipped, imageFailures },
  });
});

router.post('/products', upload.array('newPhotos', 8), (req, res) => {
  const { id, name, category, price, icon, colors, sizes, description } = req.body;
  const productType = ['garment', 'photo', 'accessory'].includes(req.body.productType)
    ? req.body.productType
    : 'garment';
  const isNew = req.body.isNew ? 1 : 0;
  const photos = (req.files || []).map((f) => toUrl(f.filename));
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM products').get().m;
  const colorList = (colors || '').split(',').map((c) => c.trim()).filter(Boolean);
  const sizeList = (sizes || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const cleanId = id.trim();
  const initialStock = Math.max(0, parseInt(req.body.initialStock, 10) || 0);
  const infoSections = parseInfoSections(req);
  const effectiveSizes = sizeList.length ? sizeList : sizesForType(productType, category);
  const sizeGuide = parseSizeGuide(req, effectiveSizes);
  const collectionsList = parseCollections(req);
  ensureCategoryExists(category);

  db.prepare(`
    INSERT INTO products (id, name, category, price, icon, colors, is_new, description, photos, sort_order, product_type, info_sections, size_guide_type, size_guide_data, collections)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cleanId,
    name,
    category,
    parseFloat(price) || 0,
    icon,
    JSON.stringify(colorList),
    isNew,
    description || '',
    JSON.stringify(photos),
    maxOrder + 1,
    productType,
    JSON.stringify(infoSections),
    sizeGuide.type,
    JSON.stringify(sizeGuide.data),
    JSON.stringify(collectionsList)
  );
  syncVariants(db, cleanId, productType, category, colorList, initialStock, sizeList);
  res.redirect(`/admin/products/${cleanId}/edit`);
});

router.get('/products/:id/edit', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).send('Product not found');
  const variants = db
    .prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY color ASC, size ASC')
    .all(product.id);
  const currentSizes = [...new Set(variants.map((v) => v.size))];
  const storedSections = JSON.parse(product.info_sections || '[]');
  const sizeGuideType = product.size_guide_type || '';
  const storedGuideData = JSON.parse(product.size_guide_data || '{}');
  const sizesForGuide = currentSizes.length ? currentSizes : ['XS', 'S', 'M', 'L', 'XL'];
  res.render('products/form', {
    product: {
      ...product,
      colors: JSON.parse(product.colors || '[]').join(', '),
      sizes: currentSizes.join(', '),
      photos: JSON.parse(product.photos || '[]'),
      infoSections: storedSections.length ? storedSections : DEFAULT_INFO_SECTIONS,
      sizeGuideType,
      collections: JSON.parse(product.collections || '[]'),
    },
    variants,
    categories: existingCategories(),
    collections: allCollections(),
    photoFormats: PHOTO_FORMATS,
    sizeGuideEditorTops: buildSizeGuideRows('tops', sizesForGuide, sizeGuideType === 'tops' ? storedGuideData : {}),
    sizeGuideEditorBottoms: buildSizeGuideRows('bottoms', sizesForGuide, sizeGuideType === 'bottoms' ? storedGuideData : {}),
  });
});

router.post('/products/:id', upload.array('newPhotos', 8), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).send('Product not found');

  const { name, category, price, icon, colors, sizes, description } = req.body;
  const productType = ['garment', 'photo', 'accessory'].includes(req.body.productType)
    ? req.body.productType
    : 'garment';
  const isNew = req.body.isNew ? 1 : 0;
  const colorList = (colors || '').split(',').map((c) => c.trim()).filter(Boolean);
  const sizeList = (sizes || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

  let photos = JSON.parse(existing.photos || '[]');
  const keep = [].concat(req.body.keepPhotos || []); // checkboxes for photos to keep
  photos = photos.filter((url) => keep.includes(url));
  const newPhotos = (req.files || []).map((f) => toUrl(f.filename));
  photos = photos.concat(newPhotos);

  const infoSections = parseInfoSections(req);
  const effectiveSizes = sizeList.length ? sizeList : sizesForType(productType, category);
  const sizeGuide = parseSizeGuide(req, effectiveSizes);
  const collectionsList = parseCollections(req);
  ensureCategoryExists(category);

  db.prepare(`
    UPDATE products SET name=?, category=?, price=?, icon=?, colors=?, is_new=?, description=?, photos=?, product_type=?, info_sections=?, size_guide_type=?, size_guide_data=?, collections=?
    WHERE id=?
  `).run(
    name,
    category,
    parseFloat(price) || 0,
    icon,
    JSON.stringify(colorList),
    isNew,
    description || '',
    JSON.stringify(photos),
    productType,
    JSON.stringify(infoSections),
    sizeGuide.type,
    JSON.stringify(sizeGuide.data),
    JSON.stringify(collectionsList),
    req.params.id
  );

  // Add/remove variant rows to match the (possibly just-changed) type,
  // category and colour list, then apply any stock numbers submitted from
  // the existing variant rows shown on the form.
  syncVariants(db, req.params.id, productType, category, colorList, 0, sizeList);
  const stockUpdates = req.body.stock || {};
  const setStock = db.prepare('UPDATE product_variants SET stock = ? WHERE id = ? AND product_id = ?');
  const resetAlert = db.prepare('UPDATE product_variants SET low_stock_alerted = 0 WHERE id = ?');
  const threshold = getLowStockThreshold();
  const restocked = [];
  Object.entries(stockUpdates).forEach(([variantId, value]) => {
    const before = db
      .prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?')
      .get(variantId, req.params.id);
    if (!before) return;
    const stock = Math.max(0, parseInt(value, 10) || 0);
    setStock.run(stock, variantId, req.params.id);
    if (before.stock === 0 && stock > 0) restocked.push(before);
    // Once stock is comfortably above the threshold again, clear the
    // "already alerted" flag so a future dip can alert again.
    if (stock > threshold) resetAlert.run(variantId);
  });

  // Notify anyone waiting on a variant that just came back into stock.
  restocked.forEach((v) => {
    const waiting = db
      .prepare(
        'SELECT * FROM stock_notifications WHERE product_id = ? AND size = ? AND color = ? AND notified = 0'
      )
      .all(v.product_id, v.size, v.color);
    const markNotified = db.prepare('UPDATE stock_notifications SET notified = 1 WHERE id = ?');
    waiting.forEach((w) => {
      sendBackInStockEmail(w.email, name, v.product_id, v.size, v.color).catch((err) =>
        console.error('Back-in-stock email failed:', err.message)
      );
      markNotified.run(w.id);
    });
  });

  res.redirect(`/admin/products/${req.params.id}/edit`);
});

router.post('/products/:id/delete', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.redirect('/admin/products');
});

router.post('/products/:id/move', (req, res) => {
  moveItem('products', req.params.id, req.body.direction);
  res.redirect('/admin/products');
});

/* ================= COLLECTIONS ================= */
// Editorial groupings shown on the public Collections page — separate from
// category (which only drives the shop's filter menu). Products opt into a
// collection from a checklist on their own edit page (see parseCollections
// above); this section is just for defining the collections themselves:
// their name, description and cover photo.
router.get('/collections', (req, res) => {
  const collections = allCollections();
  const counts = collectionProductCounts();
  res.render('collections/list', {
    collections: collections.map((c) => ({ ...c, productCount: counts[c.id] || 0 })),
  });
});

router.get('/collections/new', (req, res) => {
  res.render('collections/form', { collection: null });
});

router.post('/collections', upload.single('coverPhoto'), (req, res) => {
  const { name, description } = req.body;
  const cleanName = (name || '').trim();
  if (!cleanName) return res.redirect('/admin/collections/new');

  let id = slugify(cleanName);
  let n = 2;
  while (db.prepare('SELECT 1 FROM collections WHERE id = ?').get(id)) {
    id = `${slugify(cleanName)}-${n}`;
    n += 1;
  }
  const coverPhoto = req.file ? toUrl(req.file.filename) : '';
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM collections').get().m;

  db.prepare(`
    INSERT INTO collections (id, name, description, cover_photo, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, cleanName, description || '', coverPhoto, maxOrder + 1);

  res.redirect('/admin/collections');
});

router.get('/collections/:id/edit', (req, res) => {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!collection) return res.status(404).send('Collection not found');
  res.render('collections/form', { collection });
});

router.post('/collections/:id', upload.single('coverPhoto'), (req, res) => {
  const existing = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).send('Collection not found');

  const { name, description } = req.body;
  const coverPhoto = req.file ? toUrl(req.file.filename) : existing.cover_photo;

  db.prepare(`
    UPDATE collections SET name=?, description=?, cover_photo=?
    WHERE id=?
  `).run((name || '').trim() || existing.name, description || '', coverPhoto, req.params.id);

  res.redirect('/admin/collections');
});

router.post('/collections/:id/delete', (req, res) => {
  // Deleting a collection just un-tags every product from it — the
  // products themselves are untouched.
  const products = db.prepare('SELECT id, collections FROM products').all();
  const updateProduct = db.prepare('UPDATE products SET collections = ? WHERE id = ?');
  products.forEach((p) => {
    const list = JSON.parse(p.collections || '[]');
    if (list.includes(req.params.id)) {
      updateProduct.run(JSON.stringify(list.filter((cid) => cid !== req.params.id)), p.id);
    }
  });
  db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
  res.redirect('/admin/collections');
});

router.post('/collections/:id/move', (req, res) => {
  moveItem('collections', req.params.id, req.body.direction);
  res.redirect('/admin/collections');
});

/* ================= NEWS ================= */
router.get('/news', (req, res) => {
  const posts = db.prepare('SELECT * FROM news_posts ORDER BY sort_order ASC').all();
  res.render('news/list', { posts });
});

router.get('/news/new', (req, res) => {
  res.render('news/form', { post: null });
});

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

router.post('/news', upload.array('newPhotos', 12), (req, res) => {
  const { title, date, body } = req.body;
  const slug = (req.body.slug || slugify(title)).trim();
  const photos = (req.files || []).map((f) => toUrl(f.filename));
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM news_posts').get().m;

  db.prepare(`
    INSERT INTO news_posts (slug, title, date, body, photos, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    slug,
    title,
    date,
    JSON.stringify((body || '').split('\n').map((p) => p.trim()).filter(Boolean)),
    JSON.stringify(photos),
    maxOrder + 1
  );
  res.redirect('/admin/news');
});

router.get('/news/:id/edit', (req, res) => {
  const post = db.prepare('SELECT * FROM news_posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).send('Post not found');
  res.render('news/form', {
    post: {
      ...post,
      body: JSON.parse(post.body || '[]').join('\n'),
      photos: JSON.parse(post.photos || '[]'),
    },
  });
});

router.post('/news/:id', upload.array('newPhotos', 12), (req, res) => {
  const existing = db.prepare('SELECT * FROM news_posts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).send('Post not found');

  const { title, date, body, slug } = req.body;
  let photos = JSON.parse(existing.photos || '[]');
  const keep = [].concat(req.body.keepPhotos || []);
  photos = photos.filter((url) => keep.includes(url));
  const newPhotos = (req.files || []).map((f) => toUrl(f.filename));
  photos = photos.concat(newPhotos);

  db.prepare(`
    UPDATE news_posts SET slug=?, title=?, date=?, body=?, photos=?
    WHERE id=?
  `).run(
    (slug || slugify(title)).trim(),
    title,
    date,
    JSON.stringify((body || '').split('\n').map((p) => p.trim()).filter(Boolean)),
    JSON.stringify(photos),
    req.params.id
  );
  res.redirect('/admin/news');
});

router.post('/news/:id/delete', (req, res) => {
  db.prepare('DELETE FROM news_posts WHERE id = ?').run(req.params.id);
  res.redirect('/admin/news');
});

router.post('/news/:id/move', (req, res) => {
  moveItem('news_posts', req.params.id, req.body.direction);
  res.redirect('/admin/news');
});

/* ================= STUDIO (Sound / Screen) ================= */
router.get('/studio', (req, res) => {
  const type = req.query.type === 'screen' ? 'screen' : 'sound';
  const sessions = db
    .prepare('SELECT * FROM studio_sessions WHERE type = ? ORDER BY sort_order ASC')
    .all(type);
  res.render('studio/list', { sessions, type });
});

router.get('/studio/new', (req, res) => {
  const type = req.query.type === 'screen' ? 'screen' : 'sound';
  res.render('studio/form', { session: null, type });
});

function extractYoutubeId(input) {
  if (!input) return '';
  const match = input.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : input.trim();
}

router.post('/studio', upload.single('photo'), (req, res) => {
  const { type, artist, location, date, videoId, description } = req.body;
  const photo = req.file ? toUrl(req.file.filename) : '';
  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM studio_sessions WHERE type = ?')
    .get(type).m;

  db.prepare(`
    INSERT INTO studio_sessions (type, artist, location, date, video_id, description, photo, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(type, artist, location, date, extractYoutubeId(videoId), description || '', photo, maxOrder + 1);
  res.redirect('/admin/studio?type=' + type);
});

router.get('/studio/:id/edit', (req, res) => {
  const session = db.prepare('SELECT * FROM studio_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).send('Session not found');
  res.render('studio/form', { session, type: session.type });
});

router.post('/studio/:id', upload.single('photo'), (req, res) => {
  const existing = db.prepare('SELECT * FROM studio_sessions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).send('Session not found');

  const { artist, location, date, videoId, description } = req.body;
  const photo = req.file ? toUrl(req.file.filename) : existing.photo;

  db.prepare(`
    UPDATE studio_sessions SET artist=?, location=?, date=?, video_id=?, description=?, photo=?
    WHERE id=?
  `).run(artist, location, date, extractYoutubeId(videoId), description || '', photo, req.params.id);
  res.redirect('/admin/studio?type=' + existing.type);
});

router.post('/studio/:id/delete', (req, res) => {
  const existing = db.prepare('SELECT * FROM studio_sessions WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM studio_sessions WHERE id = ?').run(req.params.id);
  res.redirect('/admin/studio?type=' + (existing ? existing.type : 'sound'));
});

router.post('/studio/:id/move', (req, res) => {
  const existing = db.prepare('SELECT * FROM studio_sessions WHERE id = ?').get(req.params.id);
  moveItem('studio_sessions', req.params.id, req.body.direction, `type = '${existing.type}'`);
  res.redirect('/admin/studio?type=' + (existing ? existing.type : 'sound'));
});

/* ================= EVENTS ================= */
router.get('/events', (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY event_date DESC').all();
  res.render('events/list', { events });
});

router.get('/events/new', (req, res) => {
  res.render('events/form', { event: null });
});

// Only one event can be featured at a time — clears the flag off every
// other event before the caller sets it on the one that should have it.
function clearOtherFeaturedEvents(exceptId) {
  db.prepare('UPDATE events SET is_featured = 0 WHERE id != ?').run(exceptId || -1);
}

router.post('/events', heroUpload.fields([{ name: 'photo', maxCount: 1 }, { name: 'video', maxCount: 1 }]), (req, res) => {
  const { title, eventDate, eventTime, location, description } = req.body;
  const mediaType = req.body.mediaType === 'video' ? 'video' : 'photo';
  const photo = req.files && req.files.photo ? toUrl(req.files.photo[0].filename) : '';
  const video = req.files && req.files.video ? toUrl(req.files.video[0].filename) : '';
  const isFeatured = req.body.isFeatured ? 1 : 0;

  const info = db.prepare(`
    INSERT INTO events (title, event_date, event_time, location, description, photo, media_type, video, is_featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, eventDate, eventTime || '', location || '', description || '', photo, mediaType, video, isFeatured);
  if (isFeatured) clearOtherFeaturedEvents(info.lastInsertRowid);
  res.redirect('/admin/events');
});

router.get('/events/:id/edit', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).send('Event not found');
  res.render('events/form', { event });
});

router.post('/events/:id', heroUpload.fields([{ name: 'photo', maxCount: 1 }, { name: 'video', maxCount: 1 }]), (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).send('Event not found');

  const { title, eventDate, eventTime, location, description } = req.body;
  const mediaType = req.body.mediaType === 'video' ? 'video' : 'photo';
  const photo = req.files && req.files.photo ? toUrl(req.files.photo[0].filename) : existing.photo;
  const video = req.files && req.files.video ? toUrl(req.files.video[0].filename) : existing.video;
  const isFeatured = req.body.isFeatured ? 1 : 0;

  db.prepare(`
    UPDATE events SET title=?, event_date=?, event_time=?, location=?, description=?, photo=?, media_type=?, video=?, is_featured=?
    WHERE id=?
  `).run(title, eventDate, eventTime || '', location || '', description || '', photo, mediaType, video, isFeatured, req.params.id);
  if (isFeatured) clearOtherFeaturedEvents(req.params.id);
  res.redirect('/admin/events');
});

router.post('/events/:id/delete', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.redirect('/admin/events');
});

/* ================= GATHERING PHOTOS ================= */
router.get('/gathering', (req, res) => {
  const photos = db.prepare('SELECT * FROM gathering_photos ORDER BY sort_order ASC').all();
  res.render('gathering/list', { photos });
});

router.post('/gathering', upload.array('newPhotos', 12), (req, res) => {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM gathering_photos').get().m;
  const insert = db.prepare('INSERT INTO gathering_photos (url, sort_order) VALUES (?, ?)');
  (req.files || []).forEach((f, i) => insert.run(toUrl(f.filename), maxOrder + 1 + i));
  res.redirect('/admin/gathering');
});

router.post('/gathering/:id/delete', (req, res) => {
  db.prepare('DELETE FROM gathering_photos WHERE id = ?').run(req.params.id);
  res.redirect('/admin/gathering');
});

router.post('/gathering/:id/move', (req, res) => {
  moveItem('gathering_photos', req.params.id, req.body.direction);
  res.redirect('/admin/gathering');
});

/* ================= SITE SETTINGS (hero photos) ================= */
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  rows.forEach((r) => { settings[r.key] = r.value; });
  settings.shipping_flat_rate_cents = settings.shipping_flat_rate_cents || '0';
  settings.shipping_free_threshold_cents = settings.shipping_free_threshold_cents || '0';
  settings.shipping_express_rate_cents = settings.shipping_express_rate_cents || '0';
  settings.low_stock_threshold = settings.low_stock_threshold || '3';
  settings.hero_media_type = settings.hero_media_type || 'photo';
  settings.email_header_photo = settings.email_header_photo || '/assets/brandmark-word.png';
  settings.subscribe_enabled = settings.subscribe_enabled === undefined ? '1' : settings.subscribe_enabled;
  settings.collections_heading_enabled = settings.collections_heading_enabled === undefined ? '1' : settings.collections_heading_enabled;

  const categories = db.prepare('SELECT name FROM categories ORDER BY sort_order ASC').all().map((r) => {
    const productCount = db
      .prepare('SELECT COUNT(*) AS c FROM products WHERE category = ?')
      .get(r.name).c;
    return { name: r.name, productCount };
  });

  res.render('settings/form', { settings, categories, error: req.query.error || '' });
});

router.post('/settings/categories/:name/delete', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const productCount = db.prepare('SELECT COUNT(*) AS c FROM products WHERE category = ?').get(name).c;
  if (productCount > 0) {
    return res.redirect(
      `/admin/settings?error=${encodeURIComponent(
        `Can't delete "${name}" — ${productCount} product${productCount === 1 ? '' : 's'} still use it. Move or delete ${productCount === 1 ? 'it' : 'them'} first.`
      )}#categories`
    );
  }
  db.prepare('DELETE FROM categories WHERE name = ?').run(name);
  res.redirect('/admin/settings#categories');
});

router.post(
  '/settings',
  heroUpload.fields([
    { name: 'hero_photo', maxCount: 1 },
    { name: 'hero_video', maxCount: 1 },
    { name: 'about_hero_photo', maxCount: 1 },
    { name: 'gathering_hero_photo', maxCount: 1 },
    { name: 'email_header_photo', maxCount: 1 },
    { name: 'subscribe_photo', maxCount: 1 },
  ]),
  (req, res) => {
    const set = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    ['hero_photo', 'hero_video', 'about_hero_photo', 'gathering_hero_photo', 'email_header_photo', 'subscribe_photo'].forEach((key) => {
      const file = req.files && req.files[key] && req.files[key][0];
      if (file) set.run(key, toUrl(file.filename));
    });
    const heroMediaType = req.body.hero_media_type === 'video' ? 'video' : 'photo';
    set.run('hero_media_type', heroMediaType);
    set.run('hero_heading', (req.body.hero_heading || '').trim());
    set.run('hero_copy', (req.body.hero_copy || '').trim());
    set.run('subscribe_enabled', req.body.subscribe_enabled ? '1' : '0');
    set.run('subscribe_label', (req.body.subscribe_label || '').trim());
    set.run('subscribe_heading', (req.body.subscribe_heading || '').trim());
    set.run('collections_heading_enabled', req.body.collections_heading_enabled ? '1' : '0');
    set.run('collections_heading', (req.body.collections_heading || '').trim());
    set.run('collections_copy', (req.body.collections_copy || '').trim());
    res.redirect('/admin/settings');
  }
);

/* ================= ORDERS ================= */
router.get('/orders', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.render('orders/list', { orders });
});

router.get('/orders/new', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY sort_order ASC').all();
  const variants = db.prepare('SELECT * FROM product_variants WHERE stock > 0 ORDER BY product_id ASC, color ASC, size ASC').all();
  const productsWithVariants = products
    .map((p) => ({ ...p, variants: variants.filter((v) => v.product_id === p.id) }))
    .filter((p) => p.variants.length);
  res.render('orders/manual', { products: productsWithVariants });
});

router.post('/orders/manual', (req, res) => {
  const variantIds = [].concat(req.body.variantId || []);
  const quantities = [].concat(req.body.quantity || []);
  const { customerName, customerEmail, shippingCents, notes } = req.body;

  const lines = [];
  for (let i = 0; i < variantIds.length; i++) {
    const variantId = variantIds[i];
    const quantity = Math.max(1, parseInt(quantities[i], 10) || 0);
    if (!variantId || !quantity) continue;
    const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId);
    if (!variant) continue;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(variant.product_id);
    if (!product) continue;
    if (variant.stock < quantity) {
      return res
        .status(400)
        .send(`${product.name} (${variant.size}, ${variant.color}) only has ${variant.stock} in stock.`);
    }
    lines.push({ product, variant, quantity });
  }

  if (!lines.length) {
    return res.status(400).send('Add at least one item with a quantity before saving.');
  }

  const subtotalCents = lines.reduce((sum, l) => sum + Math.round(l.product.price * 100) * l.quantity, 0);
  const shipCents = Math.max(0, Math.round(parseFloat(shippingCents) * 100) || 0);
  const totalCents = subtotalCents + shipCents;

  const insertOrder = db.prepare(`
    INSERT INTO orders (status, channel, customer_name, customer_email, subtotal_cents, shipping_cents, total_cents, shipping_address)
    VALUES ('paid', 'manual', ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, variant_id, product_name, size, color, quantity, unit_price_cents)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const decrementStock = db.prepare('UPDATE product_variants SET stock = MAX(0, stock - ?) WHERE id = ?');

  const tx = db.transaction(() => {
    const result = insertOrder.run(
      customerName || '',
      customerEmail || '',
      subtotalCents,
      shipCents,
      totalCents,
      JSON.stringify(notes ? { note: notes } : {})
    );
    const orderId = result.lastInsertRowid;
    lines.forEach((l) => {
      insertItem.run(
        orderId,
        l.product.id,
        l.variant.id,
        l.product.name,
        l.variant.size,
        l.variant.color,
        l.quantity,
        Math.round(l.product.price * 100)
      );
      decrementStock.run(l.quantity, l.variant.id);
    });
    return orderId;
  });
  const orderId = tx();

  res.redirect(`/admin/orders/${orderId}`);
});

router.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).send('Order not found');
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  let shippingAddress = {};
  try { shippingAddress = JSON.parse(order.shipping_address || '{}'); } catch (e) { /* ignore */ }
  res.render('orders/detail', { order, items, shippingAddress });
});

router.post('/orders/:id/ship', async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).send('Order not found');
  const { trackingNumber, trackingCarrier } = req.body;
  db.prepare(`
    UPDATE orders SET status = 'shipped', tracking_number = ?, tracking_carrier = ? WHERE id = ?
  `).run(trackingNumber || '', trackingCarrier || '', order.id);
  try {
    await sendShippingUpdateEmail(order, trackingNumber, trackingCarrier);
  } catch (err) {
    console.error('Shipping email failed:', err.message);
  }
  res.redirect(`/admin/orders/${order.id}`);
});

router.post('/orders/:id/refund', async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).send('Order not found');

  if (order.channel !== 'manual') {
    if (!order.payment_intent_id) {
      return res.status(400).send('This order has no Stripe payment on file to refund (it may still be pending).');
    }
    try {
      const stripe = getStripe();
      await stripe.refunds.create({ payment_intent: order.payment_intent_id });
    } catch (err) {
      console.error('Stripe refund error:', err.message);
      return res.status(500).send(`Could not refund via Stripe: ${err.message}`);
    }
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const restock = db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?');
  const tx = db.transaction(() => {
    items.forEach((item) => {
      if (item.variant_id) restock.run(item.quantity, item.variant_id);
    });
    db.prepare("UPDATE orders SET status = 'refunded' WHERE id = ?").run(order.id);
  });
  tx();

  res.redirect(`/admin/orders/${order.id}`);
});

router.get('/orders.csv', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  const header = ['Order #', 'Date', 'Channel', 'Status', 'Customer', 'Email', 'Subtotal', 'Discount', 'Shipping', 'Total'];
  const rows = orders.map((o) => [
    o.id,
    o.created_at,
    o.channel,
    o.status,
    o.customer_name,
    o.customer_email,
    (o.subtotal_cents / 100).toFixed(2),
    (o.discount_cents / 100).toFixed(2),
    (o.shipping_cents / 100).toFixed(2),
    (o.total_cents / 100).toFixed(2),
  ]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
  res.send(toCsv(header, rows));
});

router.get('/products.csv', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY sort_order ASC').all();
  const variants = db.prepare('SELECT * FROM product_variants').all();
  const header = ['ID', 'Name', 'Category', 'Price', 'Size', 'Colour', 'Stock'];
  const rows = [];
  products.forEach((p) => {
    const pv = variants.filter((v) => v.product_id === p.id);
    if (!pv.length) {
      rows.push([p.id, p.name, p.category, p.price, '', '', '']);
    } else {
      pv.forEach((v) => rows.push([p.id, p.name, p.category, p.price, v.size, v.color, v.stock]));
    }
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
  res.send(toCsv(header, rows));
});

function toCsv(header, rows) {
  const escape = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

/* ================= DISCOUNT CODES ================= */
router.get('/discounts', (req, res) => {
  const codes = db.prepare('SELECT * FROM discount_codes ORDER BY created_at DESC').all();
  res.render('discounts/list', { codes });
});

router.get('/discounts/new', (req, res) => {
  res.render('discounts/form', { discount: null });
});

router.post('/discounts', (req, res) => {
  const { code, type, value, minSubtotal, maxUses } = req.body;
  db.prepare(`
    INSERT INTO discount_codes (code, type, value, min_subtotal_cents, max_uses, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(
    code.trim().toUpperCase(),
    type === 'fixed' ? 'fixed' : 'percent',
    type === 'fixed' ? Math.round(parseFloat(value) * 100) || 0 : Math.max(1, Math.min(100, parseInt(value, 10) || 0)),
    Math.max(0, Math.round(parseFloat(minSubtotal) * 100) || 0),
    maxUses ? Math.max(1, parseInt(maxUses, 10)) : null
  );
  res.redirect('/admin/discounts');
});

router.post('/discounts/:id/toggle', (req, res) => {
  db.prepare('UPDATE discount_codes SET active = 1 - active WHERE id = ?').run(req.params.id);
  res.redirect('/admin/discounts');
});

router.post('/discounts/:id/delete', (req, res) => {
  db.prepare('DELETE FROM discount_codes WHERE id = ?').run(req.params.id);
  res.redirect('/admin/discounts');
});

/* ================= SITE SETTINGS (shipping rates + low-stock threshold) ================= */
router.post('/settings/shipping', (req, res) => {
  const flatRate = Math.max(0, Math.round(parseFloat(req.body.flatRate) * 100) || 0);
  const freeThreshold = Math.max(0, Math.round(parseFloat(req.body.freeThreshold) * 100) || 0);
  const expressRate = Math.max(0, Math.round(parseFloat(req.body.expressRate) * 100) || 0);
  const lowStockThreshold = Math.max(0, parseInt(req.body.lowStockThreshold, 10) || 0);
  const set = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  set.run('shipping_flat_rate_cents', String(flatRate));
  set.run('shipping_free_threshold_cents', String(freeThreshold));
  set.run('shipping_express_rate_cents', String(expressRate));
  set.run('low_stock_threshold', String(lowStockThreshold));
  res.redirect('/admin/settings');
});

/* ================= LEADS (newsletter + back-in-stock signups) ================= */
router.get('/leads', (req, res) => {
  const subscribers = db
    .prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC')
    .all();
  const stockRequests = db
    .prepare(
      `SELECT sn.*, p.name AS product_name
       FROM stock_notifications sn
       LEFT JOIN products p ON p.id = sn.product_id
       ORDER BY sn.created_at DESC`
    )
    .all();
  res.render('leads/list', { subscribers, stockRequests });
});

router.post('/leads/subscribers/:id/delete', (req, res) => {
  db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').run(req.params.id);
  res.redirect('/admin/leads');
});

router.get('/leads/subscribers.csv', (req, res) => {
  const subscribers = db
    .prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC')
    .all();
  const header = ['Email', 'Source', 'Date'];
  const rows = subscribers.map((s) => [s.email, s.source, s.created_at]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
  res.send(toCsv(header, rows));
});

router.get('/leads/stock-requests.csv', (req, res) => {
  const stockRequests = db
    .prepare(
      `SELECT sn.*, p.name AS product_name
       FROM stock_notifications sn
       LEFT JOIN products p ON p.id = sn.product_id
       ORDER BY sn.created_at DESC`
    )
    .all();
  const header = ['Email', 'Product', 'Size', 'Colour', 'Notified', 'Date'];
  const rows = stockRequests.map((s) => [
    s.email,
    s.product_name || s.product_id,
    s.size,
    s.color,
    s.notified ? 'Yes' : 'No',
    s.created_at,
  ]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="stock-requests.csv"');
  res.send(toCsv(header, rows));
});

/* ---------------- helper: reorder rows within a table ---------------- */
function moveItem(table, id, direction, extraWhere) {
  const idCol = table === 'products' ? 'id' : 'id';
  const where = extraWhere ? `WHERE ${extraWhere}` : '';
  const rows = db.prepare(`SELECT ${idCol} as id, sort_order FROM ${table} ${where} ORDER BY sort_order ASC`).all();
  const idx = rows.findIndex((r) => String(r.id) === String(id));
  if (idx === -1) return;
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= rows.length) return;

  const a = rows[idx];
  const b = rows[swapWith];
  const update = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE ${idCol} = ?`);
  update.run(b.sort_order, a.id);
  update.run(a.sort_order, b.id);
}

module.exports = router;
