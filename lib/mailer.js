// Sends transactional emails (order confirmations, shipping updates, admin
// alerts, back-in-stock notices) through Resend (https://resend.com), which
// has a generous free tier and a plain HTTP API — no extra dependency
// needed, just fetch().
//
// If RESEND_API_KEY isn't set, every send here logs to the console instead
// of failing, so the rest of the app (checkout, admin, etc.) keeps working
// during local development before you've set up an email account. See the
// README for how to get a key.

const db = require('../db/database');

function money(cents) {
  return `$${(cents / 100).toFixed(2)} AUD`;
}

// The photo shown at the top of customer-facing emails (order confirmation,
// shipping updates). Editable from Admin > Site images; falls back to the
// Chronique wordmark until an admin uploads their own.
function getEmailHeaderPhotoUrl() {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('email_header_photo');
  const path = (row && row.value) || '/assets/brandmark-word.png';
  const base = (process.env.SITE_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

function emailHeaderHtml() {
  const url = getEmailHeaderPhotoUrl();
  return `
    <div style="text-align:center; margin-bottom:24px;">
      <img src="${url}" alt="Chronique" style="max-width:220px; height:auto;">
    </div>
  `;
}

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'Chronique <onboarding@resend.dev>';

  if (!apiKey) {
    console.log(`[mailer] RESEND_API_KEY not set — would have emailed ${to}: "${subject}"`);
    return { skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[mailer] Resend API error (${res.status}) sending to ${to}:`, body);
      return { skipped: true, error: body };
    }
    return await res.json();
  } catch (err) {
    console.error(`[mailer] Failed to send email to ${to}:`, err.message);
    return { skipped: true, error: err.message };
  }
}

function itemsToHtmlRows(items) {
  return items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0;">${it.product_name}${
          it.size && it.size !== 'ONE SIZE' ? ` — ${it.size}, ${it.color}` : ` — ${it.color}`
        } &times; ${it.quantity}</td>
        <td style="padding:8px 0; text-align:right;">${money(it.unit_price_cents * it.quantity)}</td>
      </tr>`
    )
    .join('');
}

async function sendOrderConfirmationEmail(order, items) {
  if (!order.customer_email) return;
  const html = `
    <div style="font-family:sans-serif; max-width:520px; margin:0 auto;">
      ${emailHeaderHtml()}
      <h1 style="font-weight:400;">Thank you${order.customer_name ? `, ${order.customer_name}` : ''}.</h1>
      <p>Your Chronique order #${order.id} is confirmed.</p>
      <table style="width:100%; border-collapse:collapse; margin-top:20px;">
        ${itemsToHtmlRows(items)}
        <tr><td style="padding-top:14px; border-top:1px solid #ddd;">Subtotal</td><td style="padding-top:14px; border-top:1px solid #ddd; text-align:right;">${money(order.subtotal_cents)}</td></tr>
        ${order.discount_cents ? `<tr><td>Discount (${order.discount_code})</td><td style="text-align:right;">-${money(order.discount_cents)}</td></tr>` : ''}
        <tr><td>Shipping</td><td style="text-align:right;">${order.shipping_cents === 0 ? 'Free' : money(order.shipping_cents)}</td></tr>
        <tr><td style="font-weight:600; padding-top:6px;">Total</td><td style="font-weight:600; text-align:right; padding-top:6px;">${money(order.total_cents)}</td></tr>
      </table>
      ${order.shipping_method === 'local_hand' ? `<p style="margin-top:20px;">Free local delivery — hand-delivered by Chronique within 3 business days.</p>` : ''}
      ${order.shipping_method === 'local_courier' ? `<p style="margin-top:20px;">Free local delivery.</p>` : ''}
      <p style="margin-top:24px; color:#666; font-size:13px;">We'll let you know once it ships.</p>
    </div>
  `;
  return sendEmail({ to: order.customer_email, subject: `Order confirmed — #${order.id}`, html });
}

async function sendShippingUpdateEmail(order, trackingNumber, carrier) {
  if (!order.customer_email) return;
  const html = `
    <div style="font-family:sans-serif; max-width:520px; margin:0 auto;">
      ${emailHeaderHtml()}
      <h1 style="font-weight:400;">Your order is on its way.</h1>
      <p>Order #${order.id} has shipped${carrier ? ` with ${carrier}` : ''}.</p>
      ${trackingNumber ? `<p>Tracking number: <strong>${trackingNumber}</strong></p>` : ''}
    </div>
  `;
  return sendEmail({ to: order.customer_email, subject: `Your order has shipped — #${order.id}`, html });
}

async function sendAdminNewOrderAlert(order) {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) return;
  const html = `
    <div style="font-family:sans-serif;">
      ${order.shipping_method === 'local_hand' ? `<p style="font-weight:600; color:#7A4430;">🚚 Hand-deliver this order yourself — within 50km.</p>` : ''}
      ${order.shipping_method === 'local_courier' ? `<p style="font-weight:600; color:#2E6B33;">🚚 Book a courier for this order — free local delivery, outside the 50km hand-delivery range.</p>` : ''}
      <p>New paid order <strong>#${order.id}</strong> — ${money(order.total_cents)} from ${order.customer_name || order.customer_email || 'a customer'}.</p>
      <p><a href="${process.env.SITE_URL || ''}/admin/orders/${order.id}">View in admin</a></p>
    </div>
  `;
  return sendEmail({
    to,
    subject: `${order.is_local_delivery ? '🚚 ' : ''}New order #${order.id} — ${money(order.total_cents)}`,
    html,
  });
}

async function sendLowStockAlert(productName, size, color, stock) {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) return;
  const label = size && size !== 'ONE SIZE' ? `${size}, ${color}` : color;
  const html = `
    <div style="font-family:sans-serif;">
      <p><strong>${productName}</strong> (${label}) is running low — only ${stock} left.</p>
      <p><a href="${process.env.SITE_URL || ''}/admin/products">Manage stock</a></p>
    </div>
  `;
  return sendEmail({ to, subject: `Low stock: ${productName} (${label})`, html });
}

async function sendBackInStockEmail(email, productName, productId, size, color) {
  const label = size && size !== 'ONE SIZE' ? `${size}, ${color}` : color;
  const url = `${process.env.SITE_URL || ''}/#/product/${productId}`;
  const html = `
    <div style="font-family:sans-serif; max-width:520px; margin:0 auto;">
      ${emailHeaderHtml()}
      <p><strong>${productName}</strong> (${label}) is back in stock.</p>
      <p><a href="${url}">Shop it now</a></p>
    </div>
  `;
  return sendEmail({ to: email, subject: `Back in stock: ${productName}`, html });
}

module.exports = {
  sendOrderConfirmationEmail,
  sendShippingUpdateEmail,
  sendAdminNewOrderAlert,
  sendLowStockAlert,
  sendBackInStockEmail,
};
