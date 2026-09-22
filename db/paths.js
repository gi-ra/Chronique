const path = require('path');
const fs = require('fs');

// Everything that needs to persist across restarts/redeploys (the database
// file and uploaded photos) lives under DATA_DIR. Locally this defaults to
// the project folder itself. On a host like Render, set DATA_DIR to the
// mount path of a persistent disk (see README) so this survives redeploys.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

module.exports = { DATA_DIR, UPLOADS_DIR };
