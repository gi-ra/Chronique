require('dotenv').config();
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhooks');
const pageRoutes = require('./routes/pages');
const { renderPage } = require('./lib/seo');
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

// A direct request for the raw template file would skip the page routes
// below and show the unfilled <!--SEO_HEAD--> placeholder — redirect it to
// "/" instead, which serves the same file properly filled in.
app.get('/index.html', (req, res) => res.redirect(301, '/'));

// Public site (static CSS/JS/images). index:false so a bare "/" request
// can't be served straight from this file list either — it needs to go
// through the page route below instead, same reason as above.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Uploaded photos live under DATA_DIR (see db/paths.js) so they survive
// redeploys when DATA_DIR points at a persistent disk.
app.use('/uploads', express.static(UPLOADS_DIR));

// JSON API the public site's JavaScript calls
app.use('/api', apiRoutes);

// Password-protected admin panel
app.use('/admin', adminRoutes);

// Real, plain addresses for every page (e.g. /shop, /shop/rugby-jumper,
// /about) — each one injects that page's own title/description/Open
// Graph/canonical tags (and JSON-LD for products) into the same HTML shell
// client-side JavaScript then renders into, plus /sitemap.xml and
// /robots.txt. See routes/pages.js and lib/seo.js.
app.use('/', pageRoutes);

// Anything else is a genuinely unknown address — a real 404, not a silent
// fallback to the homepage, so search engines don't index broken links.
app.use((req, res) => {
  renderPage(res, { title: 'Page not found', noindex: true, canonicalPath: req.path }, 404);
});

app.listen(PORT, () => {
  console.log(`Chronique running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin`);
});
