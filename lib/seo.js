const fs = require('fs');
const path = require('path');

// The whole public site is one HTML file that client-side JavaScript
// fills in — see public/index.html and public/js/site.js. That's fine for
// visitors, but a crawler or a link-preview bot (Facebook/iMessage/etc.)
// never runs that JavaScript, so it only ever sees whatever is already in
// the raw HTML. This module's job is narrow but important: swap in the
// right <title>/description/Open Graph/canonical/JSON-LD for whichever
// real page was requested, entirely on the server, before the file is
// sent — so those bots (and Google) see accurate, page-specific tags
// without needing to execute any JavaScript. The actual visible page
// still renders via site.js exactly as before.
const TEMPLATE_PATH = path.join(__dirname, '..', 'public', 'index.html');
const TEMPLATE = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const MARKER = '<!--SEO_HEAD-->';

function siteUrl() {
  return (process.env.SITE_URL || 'https://chronique.au').replace(/\/$/, '');
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}

// path should start with '/' and have no trailing slash (except root '/').
function absoluteUrl(pathname) {
  if (pathname === '/' || pathname === '') return `${siteUrl()}/`;
  return `${siteUrl()}${pathname}`;
}

// Builds the block of tags that replaces <!--SEO_HEAD--> for one page.
// - title/description: shown in search results and browser tabs.
// - canonicalPath: the one "real" address for this page (query strings
//   like ?sort=new are left off, so Google doesn't treat every filter
//   combination as a separate page needing its own ranking).
// - image: absolute URL, falls back to the site's default social image.
// - noindex: true for pages that shouldn't be indexed (e.g. the cart).
// - jsonLd: optional object (or array of objects) serialized as
//   structured data — used for Product pages.
function buildHead({ title, description, canonicalPath, image, noindex, jsonLd }) {
  const fullTitle = title ? `${title} — Chronique` : 'Chronique — Independent apparel';
  const desc = description || 'Chronique — independent apparel out of Logan, Queensland. Considered garments, small runs, made to last.';
  const canonical = absoluteUrl(canonicalPath || '/');
  const img = image || `${siteUrl()}/assets/og-image.jpg`;

  const lines = [
    `<title>${escapeHtml(fullTitle)}</title>`,
    `<meta name="description" content="${escapeAttr(desc)}">`,
    `<link rel="canonical" href="${escapeAttr(canonical)}">`,
    noindex ? `<meta name="robots" content="noindex, follow">` : '',
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Chronique">`,
    `<meta property="og:title" content="${escapeAttr(fullTitle)}">`,
    `<meta property="og:description" content="${escapeAttr(desc)}">`,
    `<meta property="og:image" content="${escapeAttr(img)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:url" content="${escapeAttr(canonical)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(fullTitle)}">`,
    `<meta name="twitter:description" content="${escapeAttr(desc)}">`,
    `<meta name="twitter:image" content="${escapeAttr(img)}">`,
  ];

  if (jsonLd) {
    const payload = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    payload.forEach((obj) => {
      // JSON-LD sits inside a <script> tag, so escape "</" to stop a stray
      // "</script" inside a product description from closing the tag early.
      const json = JSON.stringify(obj).replace(/<\//g, '<\\/');
      lines.push(`<script type="application/ld+json">${json}</script>`);
    });
  }

  return lines.filter(Boolean).join('\n');
}

// Renders the SPA shell with this page's tags injected in place of the
// marker in public/index.html, and sends it.
function renderPage(res, headOptions, status) {
  const html = TEMPLATE.replace(MARKER, buildHead(headOptions));
  res.status(status || 200).type('html').send(html);
}

module.exports = { siteUrl, absoluteUrl, buildHead, renderPage, escapeHtml };
