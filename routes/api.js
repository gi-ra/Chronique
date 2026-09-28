const express = require('express');
const db = require('../db/database');
const { getStripe } = require('../lib/stripe');
const { calculateShipping, getShippingSettings } = require('../lib/shipping');

const router = express.Router();

function parseProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    type: row.product_type || 'garment',
    price: row.price,
    icon: row.icon,
    colors: JSON.parse(row.colors || '[]'),
    isNew: !!row.is_new,
    desc: row.description,
    photos: JSON.parse(row.photos || '[]'),
    infoSections: JSON.parse(row.info_sections || '[]'),
    sizeGuideType: row.size_guide_type || '',
    sizeGuideData: JSON.parse(row.size_guide_data || '{}'),
    collections: JSON.parse(row.collections || '[]'),
  };
}

function parseCollection(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    coverPhoto: row.cover_photo,
  };
}

function getVariants(productId) {
  return db
    .prepare('SELECT size, color, stock FROM product_variants WHERE product_id = ? ORDER BY id ASC')
    .all(productId);
}

function parseNews(row) {
  return {
    slug: row.slug,
    title: row.title,
    date: row.date,
    body: JSON.parse(row.body || '[]'),
    photos: JSON.parse(row.photos || '[]'),
  };
}

function parseStudio(row) {
  return {
    id: row.id,
    artist: row.artist,
    location: row.location,
    date: row.date,
    videoId: row.video_id,
    desc: row.description,
    photo: row.photo,
  };
}

// ---------- Products ----------
router.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY sort_order ASC').all();
  const stockTotals = db
    .prepare('SELECT product_id, SUM(stock) AS total FROM product_variants GROUP BY product_id')
    .all();
  const stockMap = {};
  stockTotals.forEach((r) => { stockMap[r.product_id] = r.total; });
  res.json(
    rows.map((row) => ({
      ...parseProduct(row),
      inStock: (stockMap[row.id] || 0) > 0,
    }))
  );
});

router.get('/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({
    ...parseProduct(row),
    variants: getVariants(row.id),
  });
});

router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT name FROM categories ORDER BY sort_order ASC').all();
  res.json(['All', ...rows.map((r) => r.name)]);
});

// ---------- Collections (editorial page — separate from category/menu) ----------
router.get('/collections', (req, res) => {
  const rows = db.prepare('SELECT * FROM collections ORDER BY sort_order ASC').all();
  const productRows = db.prepare('SELECT collections FROM products').all();
  const counts = {};
  productRows.forEach((p) => {
    JSON.parse(p.collections || '[]').forEach((cid) => {
      counts[cid] = (counts[cid] || 0) + 1;
    });
  });
  res.json(rows.map((r) => ({ ...parseCollection(r), productCount: counts[r.id] || 0 })));
});

// ---------- News ----------
router.get('/news', (req, res) => {
  const rows = db.prepare('SELECT * FROM news_posts ORDER BY sort_order ASC').all();
  res.json(rows.map(parseNews));
});

router.get('/news/:slug', (req, res) => {
  const rows = db.prepare('SELECT * FROM news_posts ORDER BY sort_order ASC').all();
  const idx = rows.findIndex((r) => r.slug === req.params.slug);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  res.json({
    post: parseNews(rows[idx]),
    newer: idx > 0 ? rows[idx - 1].slug : null,
    older: idx < rows.length - 1 ? rows[idx + 1].slug : null,
  });
});

// ---------- Studio (sound / screen) ----------
router.get('/studio', (req, res) => {
  const type = req.query.type === 'screen' ? 'screen' : 'sound';
  const rows = db
    .prepare('SELECT * FROM studio_sessions WHERE type = ? ORDER BY sort_order ASC')
    .all(type);
  res.json(rows.map(parseStudio));
});

// ---------- Gathering ----------
router.get('/gathering', (req, res) => {
  const rows = db.prepare('SELECT url FROM gathering_photos ORDER BY sort_order ASC').all();
  res.json(rows.map((r) => r.url));
});

// ---------- Events ----------
router.get('/events', (req, res) => {
  const rows = db.prepare('SELECT * FROM events ORDER BY event_date DESC').all();
  res.json(rows);
});

// ---------- Site settings (hero photos etc.) ----------
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  rows.forEach((r) => { settings[r.key] = r.value; });
  res.json(settings);
});

// ---------- Shipping ----------
// Rates/threshold only, for the cart page's free-shipping progress message
// — the real per-order price always comes from /shipping/quote below.
router.get('/shipping-settings', (req, res) => {
  res.json(getShippingSettings());
});

// The cart page calls this every time the address or cart changes, so the
// customer always sees the real price before paying — checkout itself
// runs the exact same calculateShipping() so the two can never disagree.
router.post('/shipping/quote', (req, res) => {
  const subtotalCents = Math.max(0, parseInt(req.body.subtotalCents, 10) || 0);
  const { country, postcode, line1, line2 } = req.body;
  const quote = calculateShipping({ subtotalCents, country, postcode, line1, line2 });
  res.json(quote);
});

// ---------- Discount codes ----------
// Shared by the cart page's "Apply" button (a preview) and checkout itself
// (which always re-validates server-side rather than trusting the client).
function resolveDiscount(code, subtotalCents) {
  if (!code) return { valid: false, discountCents: 0, codeRow: null, error: null };
  const row = db.prepare('SELECT * FROM discount_codes WHERE code = ? COLLATE NOCASE').get(code.trim());
  if (!row || !row.active) {
    return { valid: false, discountCents: 0, codeRow: null, error: 'That code is not valid.' };
  }
  if (row.max_uses != null && row.used_count >= row.max_uses) {
    return { valid: false, discountCents: 0, codeRow: null, error: 'That code has already been used up.' };
  }
  if (subtotalCents < row.min_subtotal_cents) {
    return {
      valid: false,
      discountCents: 0,
      codeRow: null,
      error: `That code needs a minimum order of $${(row.min_subtotal_cents / 100).toFixed(2)}.`,
    };
  }
  const discountCents =
    row.type === 'percent'
      ? Math.round((subtotalCents * row.value) / 100)
      : Math.min(row.value, subtotalCents);
  return { valid: true, discountCents, codeRow: row, error: null };
}

router.post('/discount/validate', (req, res) => {
  const { code, subtotalCents } = req.body;
  const result = resolveDiscount(code, Math.max(0, parseInt(subtotalCents, 10) || 0));
  if (!result.valid) {
    return res.status(400).json({ valid: false, error: result.error || 'That code is not valid.' });
  }
  res.json({ valid: true, discountCents: result.discountCents });
});

// ---------- Back-in-stock notifications ----------
router.post('/notify-stock', (req, res) => {
  const { productId, size, color, email } = req.body;
  if (!productId || !size || !color || !email || !email.includes('@')) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const variant = db
    .prepare('SELECT * FROM product_variants WHERE product_id = ? AND size = ? AND color = ?')
    .get(productId, size, color);
  if (!variant) return res.status(404).json({ error: 'That size/colour was not found.' });

  const existing = db
    .prepare(
      'SELECT id FROM stock_notifications WHERE product_id = ? AND size = ? AND color = ? AND email = ? AND notified = 0'
    )
    .get(productId, size, color, email);
  if (!existing) {
    db.prepare(
      'INSERT INTO stock_notifications (product_id, size, color, email) VALUES (?, ?, ?, ?)'
    ).run(productId, size, color, email);
  }
  res.json({ ok: true });
});

// ---------- Newsletter / RSVP signups ----------
// Body: { email, source } — source is just a label (e.g. "drawer",
// "home", "gathering-rsvp") saying which form it came from, for your own
// context in admin. Every source lands in the same subscriber list.
router.post('/subscribe', (req, res) => {
  const { email, source } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const clean = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM newsletter_subscribers WHERE email = ?').get(clean);
  if (!existing) {
    db.prepare(
      'INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?)'
    ).run(clean, String(source || '').slice(0, 60));
  }
  res.json({ ok: true });
});

// ---------- Checkout ----------
// Body: { items: [{ productId, size, color, quantity }], discountCode, shippingAddress: { line1, line2, city, state, postcode, country } }
// The shipping address is collected on our own cart page (not Stripe's
// hosted page) specifically so shipping can be priced from it *before* the
// Stripe session — and therefore the price — is created. See lib/shipping.js.
router.post('/checkout/create-session', async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) {
    return res.status(400).json({ error: 'Your bag is empty.' });
  }
  const address = req.body.shippingAddress || {};
  const line1 = (address.line1 || '').trim();
  const city = (address.city || '').trim();
  const state = (address.state || '').trim();
  const postcode = (address.postcode || '').trim();
  const country = (address.country || '').trim();
  const line2 = (address.line2 || '').trim();
  if (!line1 || !city || !postcode || !country) {
    return res.status(400).json({ error: 'Please complete your shipping address first.' });
  }
  const discountCode = (req.body.discountCode || '').trim();

  // Validate every line against real products/variants and current stock.
  const resolved = [];
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
    if (!product) {
      return res.status(400).json({ error: `A product in your bag no longer exists.` });
    }
    const variant = db
      .prepare('SELECT * FROM product_variants WHERE product_id = ? AND size = ? AND color = ?')
      .get(item.productId, item.size, item.color);
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
    if (!variant || variant.stock < quantity) {
      return res.status(400).json({
        error: `${product.name} (${item.size}, ${item.color}) doesn't have enough stock — only ${variant ? variant.stock : 0} left.`,
      });
    }
    resolved.push({ product, variant, quantity });
  }

  const subtotalCents = resolved.reduce(
    (sum, r) => sum + Math.round(r.product.price * 100) * r.quantity,
    0
  );

  let discountCents = 0;
  if (discountCode) {
    const discount = resolveDiscount(discountCode, subtotalCents);
    if (!discount.valid) {
      return res.status(400).json({ error: discount.error || 'That discount code is not valid.' });
    }
    discountCents = discount.discountCents;
  }

  const quote = calculateShipping({ subtotalCents, country, postcode, line1, line2 });
  const shippingCents = quote.cents;
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);
  const shippingRegion = quote.isLocalDelivery
    ? 'local'
    : country.toUpperCase() === 'NZ'
      ? 'nz'
      : country.toUpperCase() === 'AU'
        ? 'standard'
        : 'international';
  const shippingAddressJson = JSON.stringify({
    line1,
    line2,
    city,
    state,
    postal_code: postcode,
    country,
  });

  // Create a pending order in our own database first, then hand its id to
  // Stripe as metadata so the webhook can find it again after payment. The
  // shipping address is saved here (not from Stripe's webhook) since we
  // collected it ourselves before Stripe was ever involved.
  const insertOrder = db.prepare(`
    INSERT INTO orders (status, subtotal_cents, shipping_cents, shipping_method, shipping_address, is_local_delivery, discount_code, discount_cents, total_cents)
    VALUES ('pending', ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const orderResult = insertOrder.run(
    subtotalCents,
    shippingCents,
    shippingRegion,
    shippingAddressJson,
    quote.isLocalDelivery ? 1 : 0,
    discountCode,
    discountCents,
    totalCents
  );
  const orderId = orderResult.lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, variant_id, product_name, size, color, quantity, unit_price_cents)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  resolved.forEach((r) => {
    insertItem.run(
      orderId,
      r.product.id,
      r.variant.id,
      r.product.name,
      r.variant.size,
      r.variant.color,
      r.quantity,
      Math.round(r.product.price * 100)
    );
  });

  const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;

  try {
    const stripe = getStripe();
    const lineItems = resolved.map((r) => ({
      quantity: r.quantity,
      price_data: {
        currency: 'aud',
        unit_amount: Math.round(r.product.price * 100),
        product_data: {
          name: `${r.product.name} — ${r.variant.size}, ${r.variant.color}`,
        },
      },
    }));
    if (shippingCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'aud',
          unit_amount: shippingCents,
          product_data: { name: quote.label },
        },
      });
    }

    // A one-off Stripe coupon for exactly this order's discount amount —
    // simpler than syncing our own discount_codes table to Stripe's
    // promotion codes, and Stripe still displays it as a discount line.
    const discounts = [];
    if (discountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency: 'aud',
        duration: 'once',
        name: discountCode,
      });
      discounts.push({ coupon: coupon.id });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      discounts: discounts.length ? discounts : undefined,
      // No shipping_address_collection here — we already collected and
      // priced the shipping address ourselves before creating this
      // session (see above), so asking Stripe to collect it again could
      // let a customer enter a different address than the one we priced.
      success_url: `${siteUrl}/#/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#/cart`,
      metadata: { order_id: String(orderId) },
    });

    db.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, orderId);
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout session error:', err.message);
    res.status(500).json({
      error:
        'Could not start checkout. If you are the site owner, check that STRIPE_SECRET_KEY is set correctly in your .env file — see README.md.',
    });
  }
});

// ---------- Order confirmation (used by the success page) ----------
router.get('/orders/confirm', (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).json({ error: 'missing session_id' });

  const order = db.prepare('SELECT * FROM orders WHERE stripe_session_id = ?').get(sessionId);
  if (!order) return res.status(404).json({ error: 'not found' });

  const items = db
    .prepare('SELECT product_name, size, color, quantity, unit_price_cents FROM order_items WHERE order_id = ?')
    .all(order.id);

  res.json({
    status: order.status,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    subtotalCents: order.subtotal_cents,
    shippingCents: order.shipping_cents,
    discountCode: order.discount_code,
    discountCents: order.discount_cents,
    totalCents: order.total_cents,
    isLocalDelivery: !!order.is_local_delivery,
    items,
  });
});

module.exports = router;
