require('dotenv').config();
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhooks');
const { UPLOADS_DIR } = require('./db/paths');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Stripe webhooks must be mounted with the RAW body (for signature
// verification) before the general JSON body parser below touches the
// request — do not move this after express.json().
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 days
  })
);

// Public site (static HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Uploaded photos live under DATA_DIR (see db/paths.js) so they survive
// redeploys when DATA_DIR points at a persistent disk.
app.use('/uploads', express.static(UPLOADS_DIR));

// JSON API the public site's JavaScript calls
app.use('/api', apiRoutes);

// Password-protected admin panel
app.use('/admin', adminRoutes);

// Anything else falls back to the single-page site (client-side router
// handles the rest via the URL hash, e.g. /#/shop).
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Chronique running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin`);
});
