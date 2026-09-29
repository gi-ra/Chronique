const express = require('express');
const db = require('../db/database');
const { getStripe } = require('../lib/stripe');
const { sendOrderConfirmationEmail, sendAdminNewOrderAlert, sendLowStockAlert } = require('../lib/mailer');
const { getLowStockThreshold } = require('../lib/shipping');
const { subscribeToKlaviyo } = require('../lib/klaviyo');

const router = express.Router();

// Stripe requires the raw, unparsed request body to verify the webhook
// signature — this route is mounted in server.js BEFORE the global
// express.json() middleware for that reason. Do not add any body-parsing
// middleware in front of this route.
router.post('/stripe', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set — cannot verify webhook, ignoring request.');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    handleCheckoutCompleted(session).catch((err) => {
      console.error('Error handling checkout.session.completed:', err);
    });
  }

  res.json({ received: true });
});

async function handleCheckoutCompleted(session) {
  const orderId = session.metadata && session.metadata.order_id;
  if (!orderId) {
    console.error('checkout.session.completed with no order_id in metadata');
    return;
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    console.error('Webhook: order not found for id', orderId);
    return;
  }

  // Idempotency: Stripe can send the same event more than once.
  if (order.status === 'paid') {
    return;
  }

  const customerName = (session.customer_details && session.customer_details.name) || '';
  const customerEmail = (session.customer_details && session.customer_details.email) || '';
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : '';

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  const decrementStock = db.prepare(
    'UPDATE product_variants SET stock = MAX(0, stock - ?) WHERE id = ?'
  );
  // shipping_address is NOT touched here — the customer's address was
  // already collected on our own cart page and saved on the order at
  // checkout time (see routes/api.js), since shipping is priced from it
  // *before* this Stripe session even exists. Stripe never collects it.
  const markPaid = db.prepare(`
    UPDATE orders SET status = 'paid', customer_name = ?, customer_email = ?, payment_intent_id = ?
    WHERE id = ?
  `);

  // Track which variants dropped to/below the low-stock threshold as part
  // of this sale, so we can email an alert once the transaction commits
  // (and only once per dip below the line — see the alerted-flag reset in
  // routes/admin.js when stock is topped back up).
  const lowStockCandidates = [];
  const threshold = getLowStockThreshold();

  const tx = db.transaction(() => {
    items.forEach((item) => {
      if (item.variant_id) {
        decrementStock.run(item.quantity, item.variant_id);
        const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.variant_id);
        if (variant && variant.stock <= threshold && !variant.low_stock_alerted) {
          lowStockCandidates.push({ variant, item });
          db.prepare('UPDATE product_variants SET low_stock_alerted = 1 WHERE id = ?').run(variant.id);
        }
      }
    });
    markPaid.run(customerName, customerEmail, paymentIntentId, order.id);
  });
  tx();

  if (order.discount_code) {
    db.prepare('UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ? COLLATE NOCASE').run(
      order.discount_code
    );
  }

  console.log(`Order #${order.id} marked as paid (${customerEmail}).`);

  // Only add them to the mailing list now that payment has actually gone
  // through — not just because they started checkout and ticked the box.
  if (order.newsletter_optin && customerEmail) {
    const clean = customerEmail.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM newsletter_subscribers WHERE email = ?').get(clean);
    if (!existing) {
      db.prepare('INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?)').run(clean, 'checkout');
      await subscribeToKlaviyo({ email: clean, source: 'checkout' });
    }
  }

  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  await Promise.all([
    sendOrderConfirmationEmail(updatedOrder, items),
    sendAdminNewOrderAlert(updatedOrder),
    ...lowStockCandidates.map(({ variant, item }) =>
      sendLowStockAlert(item.product_name, variant.size, variant.color, variant.stock)
    ),
  ]);
}

module.exports = router;
