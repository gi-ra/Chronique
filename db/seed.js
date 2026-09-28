/*
 * Populates the database with the site's current content (products, news
 * posts, studio sessions, gathering photos) and copies the starter images
 * into public/uploads and public/assets.
 *
 * Safe to run once when setting the project up. Running it again will NOT
 * duplicate content — it only inserts rows that don't already exist.
 */
const fs = require('fs');
const path = require('path');
const db = require('./database');
const { UPLOADS_DIR } = require('./paths');

const EXTRACTED_DIR = path.join(__dirname, '..', 'extracted');
const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');

function copyIfMissing(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    console.log('copied', path.basename(dest));
  }
}

function seedImages() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const modelPhotos = ['model-1', 'model-2', 'model-3', 'model-4', 'model-5'];
  modelPhotos.forEach((name) => {
    copyIfMissing(
      path.join(EXTRACTED_DIR, 'images', `${name}.jpg`),
      path.join(UPLOADS_DIR, `${name}.jpg`)
    );
  });

  ['hero-photo.jpg', 'about-hero-photo.jpg', 'gathering-hero-photo.jpg'].forEach((name) => {
    copyIfMissing(
      path.join(EXTRACTED_DIR, 'images', name),
      path.join(UPLOADS_DIR, name)
    );
  });

  ['brandmark-word.png', 'brandmark-icon.png'].forEach((name) => {
    copyIfMissing(
      path.join(EXTRACTED_DIR, 'images', name),
      path.join(ASSETS_DIR, name)
    );
  });
}

function seedSettings() {
  const defaults = {
    hero_photo: '/uploads/hero-photo.jpg',
    about_hero_photo: '/uploads/about-hero-photo.jpg',
    gathering_hero_photo: '/uploads/gathering-hero-photo.jpg',
    // Shipping (see lib/shipping.js): flat rates in cents, plus the
    // subtotal (also in cents) at/above which Rest-of-Australia shipping
    // is waived. Local delivery inside the zone in config/local-postcodes.json
    // is always free regardless of these settings.
    shipping_au_flat_rate_cents: '1000',
    shipping_au_free_threshold_cents: '15000',
    shipping_nz_rate_cents: '2000',
    shipping_row_rate_cents: '3000',
  };
  const insert = db.prepare(
    'INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)'
  );
  Object.entries(defaults).forEach(([key, value]) => insert.run(key, value));
}

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
function guideForCategory(cat) {
  if (cat === 'Pants') return 'bottoms';
  if (['Tees & Sweats', 'Knitwear', 'Outerwear'].includes(cat)) return 'tops';
  return null;
}

function seedVariants(products) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM product_variants').get().n;
  if (existing > 0) {
    console.log('product variants already seeded, skipping');
    return;
  }
  const insert = db.prepare(
    'INSERT INTO product_variants (product_id, size, color, stock) VALUES (?, ?, ?, ?)'
  );
  let count = 0;
  products.forEach((p) => {
    const sizes = guideForCategory(p.category) ? APPAREL_SIZES : ['ONE SIZE'];
    const colors = p.colors && p.colors.length ? p.colors : ['Ink'];
    sizes.forEach((size) => {
      colors.forEach((color) => {
        // Starter stock so the site isn't sold out on day one — change these
        // in /admin any time.
        insert.run(p.id, size, color, 10);
        count += 1;
      });
    });
  });
  console.log('seeded', count, 'product variants (10 in stock each)');
}

function seedProducts(products) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (existing > 0) {
    console.log('products already seeded, skipping');
    return;
  }
  const insert = db.prepare(`
    INSERT INTO products (id, name, category, price, icon, colors, is_new, description, photos, sort_order)
    VALUES (@id, @name, @category, @price, @icon, @colors, @is_new, @description, @photos, @sort_order)
  `);
  products.forEach((p, i) => {
    insert.run({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      icon: p.icon,
      colors: JSON.stringify(p.colors || []),
      is_new: p.isNew ? 1 : 0,
      description: p.desc || '',
      photos: JSON.stringify((p.photos || []).map((key) => `/uploads/${key}.jpg`)),
      sort_order: i,
    });
  });
  console.log('seeded', products.length, 'products');
}

function seedNews(posts) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM news_posts').get().n;
  if (existing > 0) {
    console.log('news posts already seeded, skipping');
    return;
  }
  const insert = db.prepare(`
    INSERT INTO news_posts (slug, title, date, body, photos, sort_order)
    VALUES (@slug, @title, @date, @body, @photos, @sort_order)
  `);
  posts.forEach((post, i) => {
    insert.run({
      slug: post.slug,
      title: post.title,
      date: post.date,
      body: JSON.stringify(post.body || []),
      photos: JSON.stringify((post.photos || []).map((key) => `/uploads/${key}.jpg`)),
      sort_order: i,
    });
  });
  console.log('seeded', posts.length, 'news posts');
}

function seedStudio(sessions, type) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM studio_sessions WHERE type = ?').get(type).n;
  if (existing > 0) {
    console.log(`${type} sessions already seeded, skipping`);
    return;
  }
  const insert = db.prepare(`
    INSERT INTO studio_sessions (type, artist, location, date, video_id, description, photo, sort_order)
    VALUES (@type, @artist, @location, @date, @video_id, @description, @photo, @sort_order)
  `);
  sessions.forEach((s, i) => {
    insert.run({
      type,
      artist: s.artist,
      location: s.location,
      date: s.date,
      video_id: s.videoId || '',
      description: s.desc || '',
      photo: `/uploads/${s.photo}.jpg`,
      sort_order: i,
    });
  });
  console.log('seeded', sessions.length, type, 'sessions');
}

function seedGathering() {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM gathering_photos').get().n;
  if (existing > 0) {
    console.log('gathering photos already seeded, skipping');
    return;
  }
  const photos = ['model-1', 'model-2', 'model-3', 'model-4', 'model-5', 'model-1'];
  const insert = db.prepare('INSERT INTO gathering_photos (url, sort_order) VALUES (?, ?)');
  photos.forEach((key, i) => insert.run(`/uploads/${key}.jpg`, i));
  console.log('seeded', photos.length, 'gathering photos');
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(EXTRACTED_DIR, 'data.json'), 'utf8'));
  seedImages();
  seedSettings();
  seedProducts(data.PRODUCTS);
  seedVariants(data.PRODUCTS);
  seedNews(data.NEWS_POSTS);
  seedStudio(data.SOUND_SESSIONS, 'sound');
  seedStudio(data.SCREEN_SESSIONS, 'screen');
  seedGathering();
  console.log('\nSeed complete.');
}

main();
