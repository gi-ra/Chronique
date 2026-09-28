// Turns a Shopify "Export products" CSV into the product/variant rows this
// app understands. Shopify's CSV has one row per (image OR variant) with the
// product-level fields (Title, Body (HTML), Type…) repeated only on the
// first row of each product — every row shares the same Handle, which is
// what groups them back together.
const { parse } = require('csv-parse/sync');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

function stripDangerousTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .trim();
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Reads a Shopify export CSV (as a Buffer/string) and groups its rows into
// one entry per product Handle, with all its images and (size, colour,
// stock) variant combinations collected together.
function parseShopifyCsv(csvText) {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });

  const byHandle = new Map();
  const order = [];

  records.forEach((row) => {
    const handle = (row.Handle || '').trim();
    if (!handle) return;
    if (!byHandle.has(handle)) {
      byHandle.set(handle, {
        handle,
        title: '',
        bodyHtml: '',
        type: '',
        productCategory: '',
        images: [],
        variants: [], // { size, color, price, qty }
      });
      order.push(handle);
    }
    const p = byHandle.get(handle);

    if ((row.Title || '').trim()) p.title = row.Title.trim();
    if ((row['Body (HTML)'] || '').trim()) p.bodyHtml = row['Body (HTML)'];
    if ((row.Type || '').trim()) p.type = row.Type.trim();
    if ((row['Product Category'] || '').trim()) p.productCategory = row['Product Category'].trim();

    const imageSrc = (row['Image Src'] || '').trim();
    if (imageSrc && !p.images.includes(imageSrc)) p.images.push(imageSrc);

    // Which option is size vs colour varies row to row in theory, but is
    // consistent within one product's rows in practice — Shopify always
    // uses the same Option1/2/3 Name for every row of a given Handle.
    const opt1Name = (row['Option1 Name'] || '').trim().toLowerCase();
    const opt2Name = (row['Option2 Name'] || '').trim().toLowerCase();
    const opt1Val = (row['Option1 Value'] || '').trim();
    const opt2Val = (row['Option2 Value'] || '').trim();

    let size = '';
    let color = '';
    [
      [opt1Name, opt1Val],
      [opt2Name, opt2Val],
    ].forEach(([name, val]) => {
      if (!val) return;
      if (name.includes('size')) size = val;
      else if (name.includes('col')) color = val; // colour / color
    });

    const hasVariantData = (row['Variant Price'] || '').trim() || (row['Variant Inventory Qty'] || '').trim() || size || color;
    if (hasVariantData) {
      p.variants.push({
        size: size || 'ONE SIZE',
        color: color || '',
        price: parseFloat(row['Variant Price']) || null,
        qty: Math.max(0, parseInt(row['Variant Inventory Qty'], 10) || 0),
      });
    }
  });

  return order.map((h) => byHandle.get(h));
}

function fetchToFile(url, destPath, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(destPath, () => {});
        return fetchToFile(res.headers.location, destPath, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Downloads every image URL referenced by the parsed products into
// uploadsDir, and swaps each product's `images` list (remote URLs) for the
// local /uploads/... paths that were actually saved. Failures are collected
// rather than thrown, so one bad image link doesn't sink the whole import.
async function downloadProductImages(products, uploadsDir) {
  const failures = [];
  const cache = new Map(); // remote URL -> local /uploads/... url, so a photo shared across products only downloads once

  for (const p of products) {
    const localUrls = [];
    for (const src of p.images) {
      if (cache.has(src)) {
        localUrls.push(cache.get(src));
        continue;
      }
      try {
        const ext = (path.extname(new URL(src).pathname) || '.jpg').split('?')[0].slice(0, 5) || '.jpg';
        const filename = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const dest = path.join(uploadsDir, filename);
        await fetchToFile(src, dest);
        const localUrl = `/uploads/${filename}`;
        cache.set(src, localUrl);
        localUrls.push(localUrl);
      } catch (err) {
        failures.push({ handle: p.handle, src, error: err.message });
      }
    }
    p.localImages = localUrls;
  }
  return failures;
}

module.exports = { parseShopifyCsv, downloadProductImages, stripDangerousTags, slugify };
