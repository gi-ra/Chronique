const express = require('express');
const db = require('../db/database');
const { absoluteUrl, renderPage } = require('../lib/seo');

const router = express.Router();

const SITE_DESCRIPTION =
  'Chronique — independent apparel out of Logan, Queensland. Considered garments, small runs, made to last.';

function firstPhotoUrl(photosJson) {
  try {
    const photos = JSON.parse(photosJson || '[]');
    return photos[0] ? absoluteUrl(photos[0]) : undefined;
  } catch (e) {
    return undefined;
  }
}

function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

function productStock(productId) {
  const row = db
    .prepare('SELECT COALESCE(SUM(stock), 0) AS total FROM product_variants WHERE product_id = ?')
    .get(productId);
  return row.total;
}

router.get('/', (req, res) => {
  renderPage(res, { canonicalPath: '/' });
});

router.get('/shop', (req, res) => {
  const cat = req.query.cat;
  const title = cat && cat !== 'All' ? `Shop — ${cat}` : 'Shop';
  renderPage(res, {
    title,
    description: 'Shop the full Chronique collection — considered garments and small-run pieces, made in Logan, Queensland.',
    canonicalPath: '/shop', // filters (?cat, ?sort, ?q, ?curated) are variants of one page, not separate pages
  });
});

router.get('/shop/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return renderPage(res, { title: 'Piece not found', noindex: true, canonicalPath: `/shop/${req.params.id}` }, 404);
  }
  const stock = productStock(product.id);
  const image = firstPhotoUrl(product.photos);
  const description = product.description
    ? product.description.slice(0, 300)
    : `${product.name} — $${product.price} AUD. ${SITE_DESCRIPTION}`;

  renderPage(res, {
    title: `${product.name} — $${product.price} AUD`,
    description,
    canonicalPath: `/shop/${product.id}`,
    image,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description,
      image: image ? [image] : undefined,
      brand: { '@type': 'Brand', name: 'Chronique' },
      offers: {
        '@type': 'Offer',
        url: absoluteUrl(`/shop/${product.id}`),
        priceCurrency: 'AUD',
        price: String(product.price),
        availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      },
    },
  });
});

router.get('/collections', (req, res) => {
  renderPage(res, {
    title: 'Collections',
    description: 'Curated groupings from across the Chronique shop — pulled together by season, story or theme.',
    canonicalPath: '/collections',
  });
});

router.get('/collections/:id', (req, res) => {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!collection) {
    return renderPage(res, { title: 'Collection not found', noindex: true, canonicalPath: `/collections/${req.params.id}` }, 404);
  }
  renderPage(res, {
    title: collection.name,
    description: collection.description || SITE_DESCRIPTION,
    canonicalPath: `/collections/${collection.id}`,
    image: collection.cover_photo ? absoluteUrl(collection.cover_photo) : undefined,
  });
});

router.get('/about', (req, res) => {
  renderPage(res, {
    title: 'About',
    description: 'The story behind Chronique — independent apparel out of Logan, Queensland.',
    canonicalPath: '/about',
  });
});

router.get('/news', (req, res) => {
  renderPage(res, {
    title: 'News',
    description: 'Chronique news — releases, sessions and stories from the studio.',
    canonicalPath: '/news',
  });
});

router.get('/news/:slug', (req, res) => {
  const post = db.prepare('SELECT * FROM news_posts WHERE slug = ?').get(req.params.slug);
  if (!post) {
    return renderPage(res, { title: 'Post not found', noindex: true, canonicalPath: `/news/${req.params.slug}` }, 404);
  }
  let bodyParagraphs = [];
  try { bodyParagraphs = JSON.parse(post.body || '[]'); } catch (e) { /* ignore */ }
  renderPage(res, {
    title: post.title,
    description: (bodyParagraphs[0] || SITE_DESCRIPTION).slice(0, 300),
    canonicalPath: `/news/${post.slug}`,
    image: firstPhotoUrl(post.photos),
  });
});

router.get('/studio', (req, res) => {
  renderPage(res, {
    title: 'Studio',
    description: 'Chronique Studio — Sound and Screen sessions.',
    canonicalPath: '/studio',
  });
});

router.get('/gathering', (req, res) => {
  renderPage(res, {
    title: 'The Gathering',
    description: 'The Gathering — Chronique’s in-person events and sittings.',
    canonicalPath: '/gathering',
  });
});

router.get('/size-chart', (req, res) => {
  renderPage(res, {
    title: 'Size chart',
    description: 'Chronique size guide and measurements.',
    canonicalPath: '/size-chart',
  });
});

router.get('/client-services', (req, res) => {
  renderPage(res, {
    title: 'Client services',
    description: 'Shipping options, returns and answers to common questions about ordering from Chronique.',
    canonicalPath: '/client-services',
  });
});

router.get('/legal', (req, res) => {
  renderPage(res, {
    title: 'Legal',
    description: 'Chronique’s privacy policy and terms.',
    canonicalPath: '/legal',
  });
});

// Not useful to index — a shopping cart and a one-time order receipt are
// per-visitor, not content someone should land on from a search result.
router.get('/cart', (req, res) => {
  renderPage(res, { title: 'Bag', canonicalPath: '/cart', noindex: true });
});

router.get('/order-confirmation', (req, res) => {
  renderPage(res, { title: 'Order confirmed', canonicalPath: '/order-confirmation', noindex: true });
});

router.get('/sitemap.xml', (req, res) => {
  const staticPaths = [
    '/', '/shop', '/collections', '/about', '/news', '/studio', '/gathering',
    '/size-chart', '/client-services', '/legal',
  ];
  const products = db.prepare('SELECT id FROM products ORDER BY sort_order ASC').all();
  const posts = db.prepare('SELECT slug FROM news_posts ORDER BY sort_order ASC').all();
  const collections = db.prepare('SELECT id FROM collections ORDER BY sort_order ASC').all();

  const urls = [
    ...staticPaths,
    ...products.map((p) => `/shop/${encodeURIComponent(p.id)}`),
    ...posts.map((p) => `/news/${encodeURIComponent(p.slug)}`),
    ...collections.map((c) => `/collections/${encodeURIComponent(c.id)}`),
  ];

  const body = urls
    .map((u) => `  <url><loc>${escapeXml(absoluteUrl(u))}</loc></url>`)
    .join('\n');

  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`
  );
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /order-confirmation\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`
  );
});

module.exports = router;
