const COLORS = {
  // Neutrals
  Black:"#121110", Ink:"#121110", White:"#FFFFFF", Ivory:"#EFEBDE", Cream:"#F3EAD8", Ecru:"#E8E1CF",
  Stone:"#C9C2B3", Sand:"#D9CBAE", Taupe:"#B8A99A", Beige:"#D8C9AE", Grey:"#8C887E", Gray:"#8C887E",
  Charcoal:"#2B2A27", Slate:"#4C5459", Silver:"#B8B8B2",
  // Browns / tans
  Camel:"#A9744F", Tan:"#C8A671", Brown:"#7A4430", Chocolate:"#3E2723", Espresso:"#3B2A21",
  Cognac:"#8A4B2D", Chestnut:"#6B3A2A", Mahogany:"#4E2A22", Walnut:"#5A3A2A", Rust:"#B35A32",
  Terracotta:"#C1653D", Clay:"#A9633E", Mocha:"#5C4433",
  // Greens
  Olive:"#5B5B42", Sage:"#9CAE8C", Forest:"#31462B", Emerald:"#2E5D45", Green:"#3D6B4C",
  Khaki:"#8C8465", Mint:"#B7D9C6", Moss:"#5B6B3F",
  // Blues
  Navy:"#1F2937", Denim:"#3A597A", Indigo:"#334066", Cobalt:"#2F5D8A", Sky:"#8FB6D9",
  Teal:"#2F6B69", Turquoise:"#2FA6A0", Steel:"#5C6E77", Blue:"#33587A",
  // Reds / pinks / purples
  Red:"#8C2B22", Burgundy:"#5C1F2A", Maroon:"#4A1E22", Wine:"#5E1F2E", Rose:"#C48B8F",
  Blush:"#E3C6C4", Pink:"#D9A9AC", Coral:"#D97456", Plum:"#5A3A50", Lavender:"#B7A6C9", Purple:"#5B3B5E",
  // Yellows / oranges
  Mustard:"#B98A2A", Gold:"#B8963E", Bronze:"#8A6A32", Orange:"#C1602A", Apricot:"#D99A5B",
  Yellow:"#D9B23E", Peach:"#E3B79A"
};
// Case/whitespace-insensitive lookup — admin can type "green", "Green" or
// "GREEN" and it'll still match, rather than silently falling back to grey.
function colorHex(name){
  if(!name) return '#999';
  const key = Object.keys(COLORS).find(k => k.toLowerCase() === String(name).trim().toLowerCase());
  return key ? COLORS[key] : '#999';
}
// Shown on a product page when that product has no custom info sections of
// its own set from admin — matches the generic copy every product used to
// have hardcoded.
const DEFAULT_INFO_SECTIONS = [
  { title: 'Composition &amp; care', body: 'Made from responsibly sourced natural fibres. Machine wash cold, inside out, and lay flat to dry to preserve the shape.' },
  { title: 'Shipping &amp; returns', body: 'Free local hand-delivery around Logan and Brisbane, flat-rate shipping across the rest of Australia (free over $150), and flat-rate New Zealand/international shipping — see the Shipping page for details. Unworn pieces can be returned within 30 days for a full refund.' }
];
// Australia and New Zealand get their own shipping rules (see
// lib/shipping.js) — everything else is priced as one flat "Rest of World"
// rate, but customers still pick their real country for the address.
const COUNTRIES = [
  ["AU","Australia"], ["NZ","New Zealand"],
  ["AF","Afghanistan"],["AX","Åland Islands"],["AL","Albania"],["DZ","Algeria"],["AS","American Samoa"],["AD","Andorra"],["AO","Angola"],["AI","Anguilla"],["AQ","Antarctica"],["AG","Antigua and Barbuda"],["AR","Argentina"],["AM","Armenia"],["AW","Aruba"],["AT","Austria"],["AZ","Azerbaijan"],
  ["BS","Bahamas"],["BH","Bahrain"],["BD","Bangladesh"],["BB","Barbados"],["BY","Belarus"],["BE","Belgium"],["BZ","Belize"],["BJ","Benin"],["BM","Bermuda"],["BT","Bhutan"],["BO","Bolivia"],["BA","Bosnia and Herzegovina"],["BW","Botswana"],["BR","Brazil"],["BN","Brunei"],["BG","Bulgaria"],["BF","Burkina Faso"],["BI","Burundi"],
  ["KH","Cambodia"],["CM","Cameroon"],["CA","Canada"],["CV","Cape Verde"],["KY","Cayman Islands"],["CF","Central African Republic"],["TD","Chad"],["CL","Chile"],["CN","China"],["CO","Colombia"],["KM","Comoros"],["CG","Congo"],["CD","Congo (DRC)"],["CK","Cook Islands"],["CR","Costa Rica"],["CI","Côte d'Ivoire"],["HR","Croatia"],["CU","Cuba"],["CW","Curaçao"],["CY","Cyprus"],["CZ","Czechia"],
  ["DK","Denmark"],["DJ","Djibouti"],["DM","Dominica"],["DO","Dominican Republic"],
  ["EC","Ecuador"],["EG","Egypt"],["SV","El Salvador"],["GQ","Equatorial Guinea"],["ER","Eritrea"],["EE","Estonia"],["SZ","Eswatini"],["ET","Ethiopia"],
  ["FK","Falkland Islands"],["FO","Faroe Islands"],["FJ","Fiji"],["FI","Finland"],["FR","France"],["GF","French Guiana"],["PF","French Polynesia"],
  ["GA","Gabon"],["GM","Gambia"],["GE","Georgia"],["DE","Germany"],["GH","Ghana"],["GI","Gibraltar"],["GR","Greece"],["GL","Greenland"],["GD","Grenada"],["GP","Guadeloupe"],["GU","Guam"],["GT","Guatemala"],["GG","Guernsey"],["GN","Guinea"],["GW","Guinea-Bissau"],["GY","Guyana"],
  ["HT","Haiti"],["HN","Honduras"],["HK","Hong Kong"],["HU","Hungary"],
  ["IS","Iceland"],["IN","India"],["ID","Indonesia"],["IR","Iran"],["IQ","Iraq"],["IE","Ireland"],["IM","Isle of Man"],["IL","Israel"],["IT","Italy"],
  ["JM","Jamaica"],["JP","Japan"],["JE","Jersey"],["JO","Jordan"],
  ["KZ","Kazakhstan"],["KE","Kenya"],["KI","Kiribati"],["KW","Kuwait"],["KG","Kyrgyzstan"],
  ["LA","Laos"],["LV","Latvia"],["LB","Lebanon"],["LS","Lesotho"],["LR","Liberia"],["LY","Libya"],["LI","Liechtenstein"],["LT","Lithuania"],["LU","Luxembourg"],
  ["MO","Macao"],["MG","Madagascar"],["MW","Malawi"],["MY","Malaysia"],["MV","Maldives"],["ML","Mali"],["MT","Malta"],["MH","Marshall Islands"],["MQ","Martinique"],["MR","Mauritania"],["MU","Mauritius"],["YT","Mayotte"],["MX","Mexico"],["FM","Micronesia"],["MD","Moldova"],["MC","Monaco"],["MN","Mongolia"],["ME","Montenegro"],["MS","Montserrat"],["MA","Morocco"],["MZ","Mozambique"],["MM","Myanmar"],
  ["NA","Namibia"],["NR","Nauru"],["NP","Nepal"],["NL","Netherlands"],["NC","New Caledonia"],["NI","Nicaragua"],["NE","Niger"],["NG","Nigeria"],["NU","Niue"],["NF","Norfolk Island"],["MK","North Macedonia"],["MP","Northern Mariana Islands"],["NO","Norway"],
  ["OM","Oman"],
  ["PK","Pakistan"],["PW","Palau"],["PS","Palestine"],["PA","Panama"],["PG","Papua New Guinea"],["PY","Paraguay"],["PE","Peru"],["PH","Philippines"],["PN","Pitcairn"],["PL","Poland"],["PT","Portugal"],["PR","Puerto Rico"],
  ["QA","Qatar"],
  ["RE","Réunion"],["RO","Romania"],["RU","Russia"],["RW","Rwanda"],
  ["WS","Samoa"],["SM","San Marino"],["ST","São Tomé and Príncipe"],["SA","Saudi Arabia"],["SN","Senegal"],["RS","Serbia"],["SC","Seychelles"],["SL","Sierra Leone"],["SG","Singapore"],["SK","Slovakia"],["SI","Slovenia"],["SB","Solomon Islands"],["SO","Somalia"],["ZA","South Africa"],["KR","South Korea"],["SS","South Sudan"],["ES","Spain"],["LK","Sri Lanka"],["SD","Sudan"],["SR","Suriname"],["SE","Sweden"],["CH","Switzerland"],["SY","Syria"],
  ["TW","Taiwan"],["TJ","Tajikistan"],["TZ","Tanzania"],["TH","Thailand"],["TL","Timor-Leste"],["TG","Togo"],["TO","Tonga"],["TT","Trinidad and Tobago"],["TN","Tunisia"],["TR","Türkiye"],["TM","Turkmenistan"],["TC","Turks and Caicos Islands"],["TV","Tuvalu"],
  ["UG","Uganda"],["UA","Ukraine"],["AE","United Arab Emirates"],["GB","United Kingdom"],["US","United States"],["UY","Uruguay"],["UZ","Uzbekistan"],
  ["VU","Vanuatu"],["VA","Vatican City"],["VE","Venezuela"],["VN","Vietnam"],["VG","British Virgin Islands"],["VI","U.S. Virgin Islands"],
  ["WF","Wallis and Futuna"],
  ["YE","Yemen"],
  ["ZM","Zambia"],["ZW","Zimbabwe"]
];
const SIZE_GUIDES = {
  bottoms: {
    columns: ["Waist (Relaxed)","Inseam Length","Front Rise","Leg Opening"],
    rows: {
      XS:  [27.5, 30.5, 12,   17.5],
      S:   [29.5, 30.5, 12.5, 18],
      M:   [31.5, 30.5, 13,   18.5],
      L:   [33.5, 30.5, 13.5, 19],
      XL:  [35.5, 31.5, 14,   19.5],
      XXL: [37.5, 31.5, 14.5, 20]
    },
    intl: { XS:44, S:46, M:48, L:50, XL:52, XXL:54 }
  },
  tops: {
    columns: ["Chest","Body Length","Sleeve Length"],
    rows: {
      XS:  [36, 26, 23],
      S:   [38, 27, 23.5],
      M:   [40, 28, 24],
      L:   [42, 29, 24.5],
      XL:  [44, 30, 25],
      XXL: [46, 31, 25.5]
    },
    intl: { XS:44, S:46, M:48, L:50, XL:52, XXL:54 }
  }
};
function guideForCategory(cat){
  if(cat === "Pants") return "bottoms";
  if(["Tees & Sweats","Knitwear","Outerwear"].includes(cat)) return "tops";
  return null;
}
// Same size->EU-size mapping for every guide shape, used as a fallback for
// a product's own custom size guide (which only stores measurements, not
// an INTL column) — the shared default guides above carry their own copy
// too, but it's identical, so a custom guide can just borrow this one.
const INTL_SIZE_MAP = { XS:44, S:46, M:48, L:50, XL:52, XXL:54 };
// Which measurements table (if any) a product's page should show. A
// product with its own size_guide_type/data (set in admin because its cut
// runs differently from the rest of its category) uses that; otherwise it
// falls back to the shared default for its category, same as always.
function guideForProduct(p){
  if(p.sizeGuideType === 'none') return null;
  if((p.sizeGuideType === 'tops' || p.sizeGuideType === 'bottoms') && p.sizeGuideData && p.sizeGuideData.rows){
    return p.sizeGuideData;
  }
  const key = guideForCategory(p.category);
  return key ? SIZE_GUIDES[key] : null;
}
function fmtIn(n){
  const whole = Math.floor(n);
  const frac = n - whole;
  if(frac === 0) return String(whole);
  if(Math.abs(frac - 0.5) < 0.01) return whole + "\u00BD";
  return n.toFixed(2);
}
function fmtCm(n){
  const cm = Math.round(n * 2.54 * 2) / 2;
  return Number.isInteger(cm) ? String(cm) : cm.toFixed(1);
}
/* ---------------- LIVE DATA (fetched from the server) ---------------- */
let PRODUCTS = [];
let NEWS_POSTS = [];
let SOUND_SESSIONS = [];
let SCREEN_SESSIONS = [];
let CATEGORIES = ["All"];
let GATHERING_PHOTOS = [];
let EVENTS = [];
let SITE_SETTINGS = {};
let COLLECTIONS = [];

async function loadAllData(){
  const [products, news, sound, screen, categories, gathering, events, settings, collections] = await Promise.all([
    fetch('/api/products').then(r => r.json()),
    fetch('/api/news').then(r => r.json()),
    fetch('/api/studio?type=sound').then(r => r.json()),
    fetch('/api/studio?type=screen').then(r => r.json()),
    fetch('/api/categories').then(r => r.json()),
    fetch('/api/gathering').then(r => r.json()),
    fetch('/api/events').then(r => r.json()),
    fetch('/api/settings').then(r => r.json()),
    fetch('/api/collections').then(r => r.json()),
  ]);
  PRODUCTS = products;
  NEWS_POSTS = news;
  SOUND_SESSIONS = sound;
  SCREEN_SESSIONS = screen;
  CATEGORIES = categories;
  GATHERING_PHOTOS = gathering;
  EVENTS = events;
  SITE_SETTINGS = settings;
  COLLECTIONS = collections;
  renderNavCategories();

  const heroPhoto = document.getElementById('heroPhoto');
  const heroVideo = document.getElementById('heroVideo');
  const heroMuteBtn = document.getElementById('heroMuteBtn');
  const heroMuteIconOn = document.getElementById('heroMuteIconOn');
  const heroMuteIconOff = document.getElementById('heroMuteIconOff');
  const aboutHeroPhoto = document.getElementById('aboutHeroPhoto');
  const gatheringHeroPhoto = document.getElementById('gatheringHeroPhoto');

  // Home hero can be set to either a photo or a video from admin. Show
  // whichever one is chosen and make sure the other is hidden/stopped.
  // The video always starts muted (browsers block audible autoplay), with
  // a small button letting the viewer turn the sound on themselves.
  if(heroPhoto && heroVideo){
    if(settings.hero_media_type === 'video' && settings.hero_video){
      heroVideo.src = settings.hero_video;
      heroVideo.muted = true;
      heroVideo.style.display = '';
      heroPhoto.style.display = 'none';
      if(heroMuteBtn) heroMuteBtn.style.display = '';
      if(heroMuteIconOn) heroMuteIconOn.style.display = '';
      if(heroMuteIconOff) heroMuteIconOff.style.display = 'none';
    } else {
      if(settings.hero_photo) heroPhoto.src = settings.hero_photo;
      heroPhoto.style.display = '';
      heroVideo.style.display = 'none';
      heroVideo.removeAttribute('src');
      if(heroMuteBtn) heroMuteBtn.style.display = 'none';
    }
  }
  if(heroMuteBtn && heroVideo && !heroMuteBtn.dataset.bound){
    heroMuteBtn.dataset.bound = '1';
    heroMuteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      heroVideo.muted = !heroVideo.muted;
      if(heroMuteIconOn) heroMuteIconOn.style.display = heroVideo.muted ? '' : 'none';
      if(heroMuteIconOff) heroMuteIconOff.style.display = heroVideo.muted ? 'none' : '';
      heroMuteBtn.setAttribute('aria-label', heroVideo.muted ? 'Unmute video' : 'Mute video');
      if(!heroVideo.muted) heroVideo.play().catch(() => {});
    });
  }
  if(aboutHeroPhoto && settings.about_hero_photo) aboutHeroPhoto.src = settings.about_hero_photo;
  if(gatheringHeroPhoto && settings.gathering_hero_photo) gatheringHeroPhoto.src = settings.gathering_hero_photo;

  // Home page "Coming soon" email block — admin can hide it entirely,
  // change its label/heading copy, and swap in a real photo instead of
  // the default textured panel.
  const comingSoonSection = document.getElementById('comingSoonSection');
  if(comingSoonSection){
    const enabled = settings.subscribe_enabled !== '0';
    comingSoonSection.style.display = enabled ? '' : 'none';
    if(enabled){
      const csLabel = document.getElementById('csLabel');
      const csHeading = document.getElementById('csHeading');
      const csPhoto = document.getElementById('csPhoto');
      if(csLabel) csLabel.textContent = settings.subscribe_label || 'Coming soon';
      if(csHeading) csHeading.textContent = settings.subscribe_heading || 'The next drop is on its way';
      if(csPhoto){
        if(settings.subscribe_photo){
          csPhoto.style.backgroundImage = `url("${settings.subscribe_photo}")`;
          csPhoto.style.backgroundSize = 'cover';
          csPhoto.style.backgroundPosition = 'center';
          csPhoto.classList.remove('photo-tex');
        }else{
          csPhoto.style.backgroundImage = '';
          csPhoto.classList.add('photo-tex');
        }
      }
    }
  }

  // Optional heading/copy overlaid on the home hero — set from Admin > Site
  // images. Hidden entirely when both are blank, e.g. left over from an
  // earlier design that didn't use them.
  const heroCaption = document.getElementById('heroCaption');
  const heroHeading = document.getElementById('heroHeading');
  const heroCopy = document.getElementById('heroCopy');
  const heroSection = document.querySelector('.hero');
  if(heroCaption && heroHeading && heroCopy){
    const heading = (settings.hero_heading || '').trim();
    const copy = (settings.hero_copy || '').trim();
    heroHeading.textContent = heading;
    heroCopy.textContent = copy;
    heroHeading.style.display = heading ? '' : 'none';
    heroCopy.style.display = copy ? '' : 'none';
    const hasCaption = !!(heading || copy);
    heroCaption.style.display = hasCaption ? '' : 'none';
    if(heroSection) heroSection.classList.toggle('has-caption', hasCaption);
  }

  updateBagCount();
}

/* ---------------- CART (stored in this browser only, per device) ---------------- */
const CART_KEY = 'chronique_cart';
function getCart(){
  try{
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveCart(cart){
  try{ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }catch(e){}
  updateBagCount();
}

/* ---------------- SHIPPING ADDRESS (remembered per device, like the cart) ---------------- */
const SHIP_ADDRESS_KEY = 'chronique_shipping_address';
function getSavedAddress(){
  try{
    const raw = localStorage.getItem(SHIP_ADDRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function saveAddress(address){
  try{ localStorage.setItem(SHIP_ADDRESS_KEY, JSON.stringify(address)); }catch(e){}
}
function cartLineKey(productId, size, color){ return `${productId}__${size}__${color}`; }
function addToCart(productId, size, color, qty){
  const cart = getCart();
  const key = cartLineKey(productId, size, color);
  const existing = cart.find(l => cartLineKey(l.productId, l.size, l.color) === key);
  if(existing){ existing.qty += qty; } else { cart.push({ productId, size, color, qty }); }
  saveCart(cart);
}
function removeCartLine(index){
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
}
function setCartLineQty(index, qty){
  const cart = getCart();
  if(!cart[index]) return;
  cart[index].qty = Math.max(1, qty);
  saveCart(cart);
}
function cartCount(){
  return getCart().reduce((sum, l) => sum + l.qty, 0);
}
function updateBagCount(){
  document.querySelectorAll('.bag-count').forEach(el => { el.textContent = cartCount(); });
}


/* ---------------- HELPERS ---------------- */
function money(n){ return "$" + n.toFixed(0) + " AUD"; }
function cardHTML(p){
  const colourLabel = p.colors.length > 1 ? `${p.colors.length} colours` : p.colors[0];
  return `<a class="pcard" href="#/product/${p.id}">
    <div class="frame">
      ${p.isNew && p.inStock !== false ? '<span class="tag-new">New</span>' : ''}
      ${p.inStock === false ? '<span class="tag-new">Sold out</span>' : ''}
      <img class="pcard-photo" src="${(p.photos[0])}" alt="">
    </div>
    <div class="info">
      <div class="cat mono">${p.category}</div>
      <h3>${p.name}</h3>
      <div class="meta">
        <span>${money(p.price)}</span>
        <span>${colourLabel}</span>
      </div>
    </div>
  </a>`;
}

/* ---------------- TOAST ---------------- */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------------- HOME ---------------- */
function renderHome(){
  /* Homepage is static content — no dynamic grid, matching the reference site. */
}

/* ---------------- SHOP ---------------- */
let activeCat = "All";
let activeSort = "recommended";
let currentGuide = null;

function renderNavCategories(){
  const row = document.getElementById('navCategoryLinks');
  if (!row) return;
  row.innerHTML = CATEGORIES.filter(c => c !== "All").map(c =>
    `<a href="#/shop?cat=${encodeURIComponent(c)}">${c}</a>`
  ).join('');
}

function renderChips(){
  const row = document.getElementById('chipRow');
  row.innerHTML = CATEGORIES.filter(c => c !== "All").map(c =>
    `<a href="#/shop?cat=${encodeURIComponent(c)}" class="${c===activeCat ? 'active' : ''}">${c}</a>`
  ).join('');

  const shopAllActive = activeCat === "All" && activeSort !== "new";
  const newActive = activeSort === "new" && activeCat === "All";
  document.getElementById('discShopAll').classList.toggle('active', shopAllActive);
  document.getElementById('discNewArrivals').classList.toggle('active', newActive);
}

function renderShop(){
  renderChips();
  document.getElementById('sortSelect').value = activeSort;

  let list = activeCat === "All" ? [...PRODUCTS] : PRODUCTS.filter(p => p.category === activeCat);

  if(activeSort === "new"){
    list.sort((a,b) => (b.isNew - a.isNew));
  } else if(activeSort === "price-asc"){
    list.sort((a,b) => a.price - b.price);
  } else if(activeSort === "price-desc"){
    list.sort((a,b) => b.price - a.price);
  }

  document.getElementById('resultCount').textContent = `${list.length} piece${list.length===1?'':'s'}`;
  const grid = document.getElementById('shopGrid');
  grid.innerHTML = list.length ? list.map(cardHTML).join('') :
    `<div class="empty-state" style="grid-column:1/-1;">No pieces match this filter.</div>`;
}

document.getElementById('sortSelect').addEventListener('change', (e) => {
  activeSort = e.target.value;
  const params = new URLSearchParams();
  if(activeCat !== "All") params.set('cat', activeCat);
  if(activeSort !== "recommended") params.set('sort', activeSort);
  const qs = params.toString();
  location.hash = '#/shop' + (qs ? '?' + qs : '');
});

const filterToggleBtn = document.getElementById('filterToggleBtn');
const shopSidebar = document.getElementById('shopSidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
function openSidebar(){
  shopSidebar.classList.add('open');
  sidebarBackdrop.classList.add('open');
  filterToggleBtn.classList.add('active');
  filterToggleBtn.setAttribute('aria-expanded', 'true');
}
function closeSidebar(){
  shopSidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('open');
  filterToggleBtn.classList.remove('active');
  filterToggleBtn.setAttribute('aria-expanded', 'false');
}
filterToggleBtn.addEventListener('click', () => {
  shopSidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});
document.getElementById('sidebarCloseBtn').addEventListener('click', closeSidebar);
sidebarBackdrop.addEventListener('click', closeSidebar);

/* ---------------- COLLECTIONS ---------------- */
// A collection is a curated editorial grouping (set up in Admin > Collections,
// tagged onto products from each product's own edit page) — independent of
// category, which only drives the shop's filter menu above.
function collectionTileHTML(c){
  const count = PRODUCTS.filter(p => (p.collections || []).includes(c.id)).length;
  const photo = c.coverPhoto
    ? `<img class="collection-tile-photo" src="${c.coverPhoto}" alt="">`
    : `<div class="collection-tile-photo photo-tex" style="position:absolute; inset:0;"></div>`;
  return `<a class="collection-tile" href="#/collections/${encodeURIComponent(c.id)}">
    ${photo}
    <div class="collection-tile-text">
      <h2>${c.name}</h2>
      <div class="ct-count mono">${count} piece${count===1?'':'s'}</div>
      <span class="ct-link">View collection</span>
    </div>
  </a>`;
}
function renderCollectionsPage(){
  const hero = document.getElementById('collectionsHero');
  if(hero){
    const enabled = SITE_SETTINGS.collections_heading_enabled !== '0';
    hero.style.display = enabled ? '' : 'none';
    if(enabled){
      const headingEl = document.getElementById('collectionsHeading');
      const copyEl = document.getElementById('collectionsCopy');
      if(headingEl) headingEl.textContent = SITE_SETTINGS.collections_heading || 'Collections';
      if(copyEl) copyEl.textContent = SITE_SETTINGS.collections_copy || 'Curated groupings from across the shop — pulled together by season, story or theme, not by category.';
    }
  }
  const grid = document.getElementById('collectionsGrid');
  grid.innerHTML = COLLECTIONS.length ? COLLECTIONS.map(collectionTileHTML).join('') :
    `<div class="empty-state" style="grid-column:1/-1;">No collections yet.</div>`;
}
function renderCollectionDetail(id){
  const c = COLLECTIONS.find(x => x.id === id);
  const banner = document.getElementById('collectionBanner');
  const bannerPhoto = document.getElementById('collectionBannerPhoto');
  const nameEl = document.getElementById('collectionName');
  const descEl = document.getElementById('collectionDescription');
  const crumbEl = document.getElementById('collectionCrumbName');

  if(!c){
    nameEl.textContent = 'Collection not found';
    descEl.textContent = '';
    crumbEl.textContent = '';
    banner.classList.remove('has-photo');
    bannerPhoto.style.backgroundImage = '';
    document.getElementById('collectionCount').textContent = '';
    document.getElementById('collectionGrid').innerHTML =
      `<div class="empty-state" style="grid-column:1/-1;">That collection doesn't exist.</div>`;
    return;
  }

  nameEl.textContent = c.name;
  descEl.textContent = c.description || '';
  crumbEl.textContent = '/ ' + c.name;
  setTitle(c.name);
  if(c.coverPhoto){
    banner.classList.add('has-photo');
    bannerPhoto.style.backgroundImage = `url("${c.coverPhoto}")`;
  } else {
    banner.classList.remove('has-photo');
    bannerPhoto.style.backgroundImage = '';
  }

  const list = PRODUCTS.filter(p => (p.collections || []).includes(id));
  document.getElementById('collectionCount').textContent = `${list.length} piece${list.length===1?'':'s'}`;
  document.getElementById('collectionGrid').innerHTML = list.length ? list.map(cardHTML).join('') :
    `<div class="empty-state" style="grid-column:1/-1;">No pieces in this collection yet.</div>`;
}

/* ---------------- PRODUCT DETAIL ---------------- */
async function renderProduct(id){
  const p = PRODUCTS.find(x => x.id === id);
  const root = document.getElementById('pdpRoot');
  if(!p){
    root.innerHTML = `<div class="empty-state">Piece not found.</div>`;
    document.getElementById('crumbCat').textContent = '';
    document.getElementById('crumbName').textContent = '';
    setTitle('Piece not found');
    return;
  }
  document.getElementById('crumbCat').innerHTML = `/ <a href="#/shop?cat=${encodeURIComponent(p.category)}">${p.category}</a>`;
  document.getElementById('crumbName').textContent = `/ ${p.name}`;
  setTitle(p.name);

  root.innerHTML = `<div class="empty-state">Loading…</div>`;
  let full;
  try{
    full = await fetch(`/api/products/${encodeURIComponent(id)}`).then(r => r.json());
  }catch(e){
    root.innerHTML = `<div class="empty-state">Could not load this piece. Please try again.</div>`;
    return;
  }
  const variants = full.variants || [];

  // Unique sizes/colours, in the order they first appear (matches how
  // they were entered in the admin panel).
  const sizes = [...new Set(variants.map(v => v.size))];
  const colors = [...new Set(variants.map(v => v.color))];
  const hasSizes = !(sizes.length === 1 && sizes[0] === 'ONE SIZE');
  const isPhotoFormat = p.type === 'photo';
  const hasColors = !isPhotoFormat;

  let selectedColor = colors[0] || p.colors[0];
  let selectedSize = sizes[0] || 'ONE SIZE';
  let qty = 1;
  let photoIndex = 0;
  const guide = guideForProduct(p);
  currentGuide = guide;

  function variantFor(size, color){
    return variants.find(v => v.size === size && v.color === color);
  }
  function stockFor(size, color){
    const v = variantFor(size, color);
    return v ? v.stock : 0;
  }

  root.innerHTML = `
    <div class="visual-col">
      <div class="visual">
        ${p.isNew ? '<span class="tag-new">New</span>' : ''}
        <img class="pdp-photo" id="pdpMainPhoto" src="${(p.photos[0])}" alt="">
      </div>
      ${p.photos.length > 1 ? `
      <div class="pdp-thumbs" id="pdpThumbs">
        ${p.photos.map((ph,i) => `<button class="pdp-thumb ${i===0?'active':''}" data-photo="${ph}"><img src="${(ph)}" alt=""></button>`).join('')}
      </div>` : ''}
    </div>
    <div class="info">
      <h1>${p.name}</h1>
      <div class="price mono">${money(p.price)}</div>
      <p class="desc">${p.desc}</p>

      ${hasColors ? `
      <div class="field">
        <span class="flabel">Colour — <span id="colorLabel">${selectedColor}</span></span>
        <div class="colorpicker" id="colorPicker">
          ${colors.map((c,i) => `<button data-color="${c}" class="${i===0?'active':''}" style="background:${colorHex(c)}" aria-label="${c}"></button>`).join('')}
        </div>
      </div>` : ''}

      ${isPhotoFormat ? `
      <div class="field">
        <span class="flabel">Format — <span id="colorLabel">${selectedColor}</span></span>
        <div class="sizepicker" id="colorPicker">
          ${colors.map((c,i) => `<button data-color="${c}" class="${i===0?'active':''}">${c}</button>`).join('')}
        </div>
      </div>` : ''}

      ${hasSizes ? `
      <div class="field">
        <span class="flabel">Size${guide ? ` — <button type="button" id="sizeGuideBtn" class="size-guide-link mono">Size guide</button>` : ''}</span>
        <div class="sizepicker" id="sizePicker">
          ${sizes.map((s,i) => `<button data-size="${s}" class="${i===0?'active':''}">${s}</button>`).join('')}
        </div>
      </div>` : ''}

      <div class="field">
        <span class="flabel">Quantity</span>
        <div class="qty">
          <button id="qtyMinus" aria-label="Decrease quantity">–</button>
          <span id="qtyVal">1</span>
          <button id="qtyPlus" aria-label="Increase quantity">+</button>
        </div>
      </div>

      <div class="stock-note" id="stockNote"></div>
      <div class="notify-stock" id="notifyStock" style="display:none;">
        <p class="flabel" style="margin:0 0 8px;">Get an email when this is back</p>
        <div class="notify-row">
          <input type="email" id="notifyEmail" placeholder="you@email.com">
          <button type="button" id="notifyBtn">Notify me</button>
        </div>
        <div class="notify-note" id="notifyNote"></div>
      </div>

      <button class="add-btn" id="addBtn">Add to bag — ${money(p.price)}</button>
      <button class="buy-now-btn" id="buyNowBtn">Buy now</button>

      <div class="accordion">
        ${(p.infoSections && p.infoSections.length ? p.infoSections : DEFAULT_INFO_SECTIONS).map((s) => `
        <details>
          <summary>${s.title}</summary>
          <div class="acc-body">${s.body}</div>
        </details>`).join('')}
      </div>
    </div>
  `;

  const addBtn = document.getElementById('addBtn');
  const buyNowBtn = document.getElementById('buyNowBtn');
  const qtyVal = document.getElementById('qtyVal');
  const stockNote = document.getElementById('stockNote');
  const notifyStock = document.getElementById('notifyStock');
  const notifyNote = document.getElementById('notifyNote');

  function refreshAvailability(){
    const stock = stockFor(selectedSize, selectedColor);
    qty = Math.min(qty, Math.max(1, stock));
    qtyVal.textContent = qty;
    if(stock <= 0){
      stockNote.textContent = 'Sold out in this size and colour.';
      stockNote.classList.add('low');
      addBtn.disabled = true;
      addBtn.textContent = 'Sold out';
      buyNowBtn.disabled = true;
      notifyStock.style.display = '';
      notifyNote.textContent = '';
    }else{
      addBtn.disabled = false;
      addBtn.textContent = `Add to bag — ${money(p.price)}`;
      buyNowBtn.disabled = false;
      notifyStock.style.display = 'none';
      if(stock <= 3){
        stockNote.textContent = `Only ${stock} left in this size and colour.`;
        stockNote.classList.add('low');
      }else{
        stockNote.textContent = '';
        stockNote.classList.remove('low');
      }
    }
    // Grey out colour swatches with zero stock in the current size.
    root.querySelectorAll('#colorPicker button').forEach(btn => {
      const s = stockFor(selectedSize, btn.dataset.color);
      btn.disabled = s <= 0;
    });
    // Grey out sizes with zero stock in the current colour.
    root.querySelectorAll('#sizePicker button').forEach(btn => {
      const s = stockFor(btn.dataset.size, selectedColor);
      btn.disabled = s <= 0;
    });
  }

  root.querySelectorAll('#colorPicker button').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('#colorPicker button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedColor = btn.dataset.color;
      document.getElementById('colorLabel').textContent = selectedColor;
      refreshAvailability();
    });
  });
  root.querySelectorAll('#pdpThumbs .pdp-thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('#pdpThumbs .pdp-thumb').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      photoIndex = p.photos.indexOf(btn.dataset.photo);
      document.getElementById('pdpMainPhoto').src = (btn.dataset.photo);
    });
  });
  if(p.photos.length > 1){
    document.getElementById('pdpMainPhoto').style.cursor = 'pointer';
    document.getElementById('pdpMainPhoto').addEventListener('click', () => {
      photoIndex = (photoIndex + 1) % p.photos.length;
      const nextPhoto = p.photos[photoIndex];
      document.getElementById('pdpMainPhoto').src = (nextPhoto);
      root.querySelectorAll('#pdpThumbs .pdp-thumb').forEach((b,i) => b.classList.toggle('active', i === photoIndex));
    });
  }
  const sizeGuideBtn = document.getElementById('sizeGuideBtn');
  if(sizeGuideBtn){
    sizeGuideBtn.addEventListener('click', openSizeGuide);
  }
  root.querySelectorAll('#sizePicker button').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('#sizePicker button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSize = btn.dataset.size;
      refreshAvailability();
    });
  });
  document.getElementById('qtyMinus').addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    qtyVal.textContent = qty;
  });
  document.getElementById('qtyPlus').addEventListener('click', () => {
    const stock = stockFor(selectedSize, selectedColor);
    qty = Math.min(Math.max(1, stock), qty + 1);
    qtyVal.textContent = qty;
  });
  addBtn.addEventListener('click', () => {
    const stock = stockFor(selectedSize, selectedColor);
    if(stock <= 0) return;
    addToCart(p.id, selectedSize, selectedColor, qty);
    showToast(`Added ${p.name} to bag`);
  });
  buyNowBtn.addEventListener('click', () => {
    const stock = stockFor(selectedSize, selectedColor);
    if(stock <= 0) return;
    // Checkout now needs a full shipping address to price shipping
    // correctly (see the Bag page), so "Buy now" adds the item and takes
    // the shopper straight there instead of skipping to Stripe directly.
    addToCart(p.id, selectedSize, selectedColor, qty);
    location.hash = '#/cart';
  });
  document.getElementById('notifyBtn').addEventListener('click', async () => {
    const email = document.getElementById('notifyEmail').value.trim();
    if(!email || !email.includes('@')){
      notifyNote.textContent = 'Enter a valid email address.';
      return;
    }
    try{
      const res = await fetch('/api/notify-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id, size: selectedSize, color: selectedColor, email }),
      });
      if(!res.ok){
        const data = await res.json().catch(() => ({}));
        notifyNote.textContent = data.error || 'Something went wrong. Please try again.';
        return;
      }
      notifyNote.textContent = "You're on the list — we'll email you when it's back.";
      document.getElementById('notifyEmail').value = '';
    }catch(e){
      notifyNote.textContent = 'Could not reach the server. Please try again.';
    }
  });

  refreshAvailability();
  renderRelatedProducts(p);
}

/* ---------------- RELATED PRODUCTS ---------------- */
function renderRelatedProducts(p){
  const related = PRODUCTS.filter(x => x.id !== p.id && x.category === p.category).slice(0, 4);
  const section = document.getElementById('relatedSection');
  if(!section) return;
  if(!related.length){
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  document.getElementById('relatedGrid').innerHTML = related.map(cardHTML).join('');
}

/* ---------------- CART PAGE ---------------- */
function findProductAndVariant(productId, size, color){
  const p = PRODUCTS.find(x => x.id === productId);
  return p;
}
function renderCartPage(){
  const root = document.getElementById('cartRoot');
  const cart = getCart();

  if(!cart.length){
    root.innerHTML = `<div class="empty-state">Your bag is empty. <a href="#/shop">Continue shopping &rarr;</a></div>`;
    return;
  }

  let subtotal = 0;
  const lines = cart.map((line, i) => {
    const p = findProductAndVariant(line.productId, line.size, line.color);
    if(!p) return { i, html: '', valid: false };
    const lineTotal = p.price * line.qty;
    subtotal += lineTotal;
    const sizeLabel = line.size && line.size !== 'ONE SIZE' ? `${line.size} · ${line.color}` : line.color;
    return {
      i,
      valid: true,
      html: `
      <div class="cart-line" data-index="${i}">
        <img src="${p.photos[0]}" alt="">
        <div>
          <p class="cl-name"><a href="#/product/${p.id}">${p.name}</a></p>
          <div class="cl-meta">${sizeLabel}</div>
          <div class="cl-qty">
            <button class="cl-qty-minus" aria-label="Decrease quantity">–</button>
            <span>${line.qty}</span>
            <button class="cl-qty-plus" aria-label="Increase quantity">+</button>
          </div>
          <button class="cl-remove">Remove</button>
        </div>
        <div class="cl-price mono">${money(lineTotal)}</div>
      </div>`
    };
  });

  // Drop any lines whose product no longer exists (deleted since it was added).
  const invalidIndexes = lines.filter(l => !l.valid).map(l => l.i);
  if(invalidIndexes.length){
    const cleaned = cart.filter((_, i) => !invalidIndexes.includes(i));
    saveCart(cleaned);
    return renderCartPage();
  }

  const savedAddress = getSavedAddress();

  root.innerHTML = `
    <div>
      <h1>Your bag</h1>
      <div class="cart-lines">${lines.map(l => l.html).join('')}</div>
    </div>
    <div class="cart-summary">
      <h2>Order summary</h2>

      <div class="field" style="margin-bottom:16px;">
        <span class="flabel">Shipping address</span>
        <div class="ship-address-form">
          <select id="shipCountry">
            ${COUNTRIES.map(([code, name]) => `<option value="${code}" ${(savedAddress.country || 'AU') === code ? 'selected' : ''}>${name}</option>`).join('')}
          </select>
          <input type="text" id="shipLine1" placeholder="Address line 1" autocomplete="address-line1" value="${savedAddress.line1 || ''}">
          <input type="text" id="shipLine2" placeholder="Address line 2 (optional)" autocomplete="address-line2" value="${savedAddress.line2 || ''}">
          <div class="row2">
            <input type="text" id="shipCity" placeholder="City" autocomplete="address-level2" value="${savedAddress.city || ''}">
            <input type="text" id="shipState" placeholder="State / region" autocomplete="address-level1" value="${savedAddress.state || ''}">
          </div>
          <input type="text" id="shipPostcode" placeholder="Postcode" autocomplete="postal-code" value="${savedAddress.postcode || ''}">
        </div>
        <div class="ship-quote-note" id="shipQuoteNote">Enter your shipping address to see the cost.</div>
      </div>

      <div class="field" style="margin-bottom:16px;">
        <span class="flabel">Discount code</span>
        <div class="discount-row">
          <input type="text" id="discountInput" placeholder="Enter code">
          <button type="button" id="discountApplyBtn">Apply</button>
        </div>
        <div class="discount-note" id="discountNote"></div>
      </div>

      <div class="cart-summary-row"><span>Subtotal</span><span class="mono">${money(subtotal)}</span></div>
      <div class="cart-summary-row" id="cartDiscountRow" style="display:none;"><span>Discount</span><span class="mono" id="cartDiscountVal"></span></div>
      <div class="cart-summary-row" id="cartShippingRow"><span>Shipping</span><span class="mono">—</span></div>
      <div class="cart-summary-row total"><span>Total</span><span class="mono" id="cartTotalVal">${money(subtotal)}</span></div>
      <button class="checkout-btn" id="checkoutBtn" disabled>Checkout</button>
      <div class="checkout-error" id="checkoutError"></div>
    </div>
  `;

  let shippingSettings = { auFreeThresholdCents: 0 };
  let appliedDiscount = null; // { code, discountCents } once validated
  let currentQuote = null; // { cents, isLocalDelivery, label, note } once a quote succeeds
  let quoteRequestId = 0;

  fetch('/api/shipping-settings').then(r => r.json()).then((settings) => {
    shippingSettings = settings;
    if(currentQuote) refreshQuote(); // redo the progress-message math now the threshold is known
  }).catch(() => {});

  function currentAddress(){
    return {
      country: document.getElementById('shipCountry').value,
      line1: document.getElementById('shipLine1').value.trim(),
      line2: document.getElementById('shipLine2').value.trim(),
      city: document.getElementById('shipCity').value.trim(),
      state: document.getElementById('shipState').value.trim(),
      postcode: document.getElementById('shipPostcode').value.trim(),
    };
  }

  function recalcTotals(){
    const shippingCents = currentQuote ? currentQuote.cents : 0;
    const discountCents = appliedDiscount ? appliedDiscount.discountCents : 0;
    const total = Math.max(0, subtotal - discountCents / 100 + shippingCents / 100);

    document.getElementById('cartShippingRow').innerHTML = currentQuote
      ? `<span>${currentQuote.label}</span><span class="mono">${shippingCents === 0 ? 'Free' : money(shippingCents / 100)}</span>`
      : `<span>Shipping</span><span class="mono">—</span>`;
    document.getElementById('cartTotalVal').textContent = money(total);

    const discountRow = document.getElementById('cartDiscountRow');
    if(appliedDiscount){
      discountRow.style.display = '';
      document.getElementById('cartDiscountVal').textContent = `-${money(discountCents / 100)}`;
    }else{
      discountRow.style.display = 'none';
    }
  }

  // The single source of truth for shipping is the server (see
  // /api/shipping/quote → lib/shipping.js) — this just calls it every time
  // the address or cart changes, so the price shown here always matches
  // what checkout will actually charge.
  async function refreshQuote(){
    const address = currentAddress();
    const noteEl = document.getElementById('shipQuoteNote');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if(!address.line1 || !address.city || !address.postcode || !address.country){
      currentQuote = null;
      checkoutBtn.disabled = true;
      noteEl.className = 'ship-quote-note';
      noteEl.textContent = 'Enter your shipping address to see the cost.';
      recalcTotals();
      return;
    }

    const myRequestId = ++quoteRequestId;
    noteEl.className = 'ship-quote-note';
    noteEl.textContent = 'Calculating shipping…';

    try{
      const res = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtotalCents: Math.round(subtotal * 100), ...address }),
      });
      const data = await res.json();
      if(myRequestId !== quoteRequestId) return; // a newer edit already superseded this request

      currentQuote = data;
      checkoutBtn.disabled = false;
      saveAddress(address);
      recalcTotals();

      if(data.isLocalDelivery){
        noteEl.textContent = data.label;
      } else if(address.country === 'AU' && data.cents > 0 && shippingSettings.auFreeThresholdCents){
        const remainingCents = shippingSettings.auFreeThresholdCents - Math.round(subtotal * 100);
        if(remainingCents > 0){
          noteEl.textContent = `You're ${money(remainingCents / 100)} away from free shipping.`;
          noteEl.classList.add('progress');
        } else {
          noteEl.textContent = '';
        }
      } else {
        noteEl.textContent = data.note || '';
      }
    }catch(e){
      if(myRequestId !== quoteRequestId) return;
      currentQuote = null;
      checkoutBtn.disabled = true;
      noteEl.textContent = 'Could not calculate shipping — check your connection and try again.';
    }
  }

  let addressDebounce;
  ['shipCountry', 'shipLine1', 'shipLine2', 'shipCity', 'shipState', 'shipPostcode'].forEach((id) => {
    const el = document.getElementById(id);
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      clearTimeout(addressDebounce);
      addressDebounce = setTimeout(refreshQuote, 400);
    });
  });
  refreshQuote();

  document.getElementById('discountApplyBtn').addEventListener('click', async () => {
    const codeInput = document.getElementById('discountInput');
    const note = document.getElementById('discountNote');
    const code = codeInput.value.trim();
    if(!code){ note.textContent = 'Enter a code first.'; return; }
    note.textContent = 'Checking…';
    try{
      const res = await fetch('/api/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotalCents: Math.round(subtotal * 100) }),
      });
      const data = await res.json();
      if(!res.ok || !data.valid){
        appliedDiscount = null;
        note.textContent = data.error || 'That code is not valid.';
        recalcTotals();
        return;
      }
      appliedDiscount = { code, discountCents: data.discountCents };
      note.textContent = `"${code.toUpperCase()}" applied.`;
      recalcTotals();
    }catch(e){
      note.textContent = 'Could not reach the server. Please try again.';
    }
  });

  root.querySelectorAll('.cart-line').forEach(el => {
    const i = parseInt(el.dataset.index, 10);
    el.querySelector('.cl-qty-minus').addEventListener('click', () => {
      const c = getCart();
      setCartLineQty(i, (c[i].qty || 1) - 1);
      renderCartPage();
    });
    el.querySelector('.cl-qty-plus').addEventListener('click', () => {
      const c = getCart();
      setCartLineQty(i, (c[i].qty || 1) + 1);
      renderCartPage();
    });
    el.querySelector('.cl-remove').addEventListener('click', () => {
      removeCartLine(i);
      renderCartPage();
    });
  });

  document.getElementById('checkoutBtn').addEventListener('click', async () => {
    const btn = document.getElementById('checkoutBtn');
    const errEl = document.getElementById('checkoutError');
    errEl.textContent = '';
    if(!currentQuote){
      errEl.textContent = 'Please complete your shipping address first.';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Redirecting…';
    try{
      const res = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: getCart().map(l => ({ productId: l.productId, size: l.size, color: l.color, quantity: l.qty })),
          shippingAddress: currentAddress(),
          discountCode: appliedDiscount ? appliedDiscount.code : '',
        }),
      });
      const data = await res.json();
      if(!res.ok || !data.url){
        errEl.textContent = data.error || 'Could not start checkout. Please try again.';
        btn.disabled = false;
        btn.textContent = 'Checkout';
        return;
      }
      location.href = data.url;
    }catch(e){
      errEl.textContent = 'Could not reach the server. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Checkout';
    }
  });
}

/* ---------------- ORDER CONFIRMATION PAGE ---------------- */
async function renderOrderConfirmationPage(){
  const root = document.getElementById('orderConfirmationRoot');
  const params = new URLSearchParams((location.hash.split('?')[1] || ''));
  const sessionId = params.get('session_id');

  if(!sessionId){
    root.innerHTML = `<div class="empty-state">Order not found.</div>`;
    return;
  }

  root.innerHTML = `<div class="empty-state">Loading your order…</div>`;
  let order;
  try{
    const res = await fetch(`/api/orders/confirm?session_id=${encodeURIComponent(sessionId)}`);
    if(!res.ok) throw new Error('not found');
    order = await res.json();
  }catch(e){
    root.innerHTML = `<div class="empty-state">We couldn't find that order.</div>`;
    return;
  }

  // The order is confirmed here as soon as Stripe redirects back — the
  // webhook (which actually marks it paid and decrements stock) can land
  // a moment later, so don't block the confirmation message on it.
  saveCart([]);

  root.innerHTML = `
    <h1>Thank you${order.customerName ? `, ${order.customerName}` : ''}.</h1>
    <p>Your order has been placed${order.customerEmail ? ` and a confirmation will be sent to ${order.customerEmail}` : ''}. We'll let you know once it ships.</p>
    <div class="oc-items">
      ${order.items.map(it => `
        <div class="oc-item">
          <div>
            <div>${it.product_name}</div>
            <div class="oc-meta">${it.size && it.size !== 'ONE SIZE' ? `${it.size} · ${it.color}` : it.color} &times; ${it.quantity}</div>
          </div>
          <div class="mono">${money((it.unit_price_cents * it.quantity) / 100)}</div>
        </div>
      `).join('')}
    </div>
    <div class="oc-totals">
      <div class="row"><span>Subtotal</span><span class="mono">${money(order.subtotalCents / 100)}</span></div>
      ${order.discountCents ? `<div class="row"><span>Discount (${order.discountCode})</span><span class="mono">-${money(order.discountCents / 100)}</span></div>` : ''}
      <div class="row"><span>Shipping</span><span class="mono">${order.shippingCents === 0 ? 'Free' : money(order.shippingCents / 100)}</span></div>
      <div class="row total"><span>Total</span><span class="mono">${money(order.totalCents / 100)}</span></div>
    </div>
    ${order.isLocalDelivery ? `<p class="note">Free local delivery — hand-delivered by Chronique within 3 business days.</p>` : ''}
  `;
}

/* ---------------- NEWS ---------------- */
function newsCardHTML(post){
  return `<a class="news-card" href="#/news/${post.slug}">
    <div class="news-photo-wrap"><img src="${(post.photos[0])}" alt=""></div>
    <h3>${post.title}</h3>
    <div class="news-date mono">${post.date}</div>
  </a>`;
}
function renderNewsGrid(){
  document.getElementById('newsGrid').innerHTML = NEWS_POSTS.map(newsCardHTML).join('');
}
function renderNewsPost(slug){
  const idx = NEWS_POSTS.findIndex(p => p.slug === slug);
  const post = NEWS_POSTS[idx];
  const root = document.getElementById('newsPostRoot');
  if(!post){
    root.innerHTML = `<div class="empty-state">Post not found.</div>`;
    document.getElementById('postCrumb').textContent = '';
    setTitle('Post not found');
    return;
  }
  document.getElementById('postCrumb').textContent = `/ ${post.title}`;
  setTitle(post.title);
  const older = NEWS_POSTS[idx + 1];
  const newer = NEWS_POSTS[idx - 1];
  root.innerHTML = `
    <h1>${post.title}</h1>
    <span class="news-date mono">${post.date}</span>
    ${post.body.map(p => `<p>${p}</p>`).join('')}
    <div class="np-essay">
      ${post.photos.map((ph,i) => `<button type="button" class="np-essay-photo" data-index="${i}"><img src="${(ph)}" alt=""></button>`).join('')}
    </div>
    <div class="np-nav">
      ${newer ? `<a href="#/news/${newer.slug}">&larr; Newer post</a>` : `<span></span>`}
      ${older ? `<a href="#/news/${older.slug}">Older post &rarr;</a>` : `<span></span>`}
    </div>
  `;
  root.querySelectorAll('.np-essay-photo').forEach(btn => {
    btn.addEventListener('click', () => openLightbox(post.photos, parseInt(btn.dataset.index, 10)));
  });
}

/* ---------------- STUDIO (Sound / Screen) ---------------- */
let studioFilter = 'sound';
function youtubeEmbedUrl(videoId){
  return `https://www.youtube.com/embed/${videoId}?rel=0`;
}
function currentStudioList(){
  return studioFilter === 'screen' ? SCREEN_SESSIONS : SOUND_SESSIONS;
}
function renderSoundPage(){
  const root = document.getElementById('soundRoot');
  const list = currentStudioList();
  const current = list[0];
  root.innerHTML = `
    <div class="studio-tabs" id="studioTabs">
      <button type="button" class="mono ${studioFilter==='sound'?'active':''}" data-filter="sound">Sound</button>
      <button type="button" class="mono ${studioFilter==='screen'?'active':''}" data-filter="screen">Screen</button>
    </div>
    <div class="sound-player-wrap">
      <iframe id="soundPlayer" src="${youtubeEmbedUrl(current.videoId)}"
        title="${current.artist} — ${current.location}" frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>
    </div>
    <div class="sound-now" id="soundNow">
      <h2 id="soundNowTitle">${current.artist}, ${current.location.split(',')[0]}</h2>
      <span class="sf-date mono" id="soundNowDate">${current.date.toUpperCase()}</span>
      <p id="soundNowDesc">${current.desc}</p>
    </div>
    <span class="sound-select-label mono">Watch more</span>
    <div class="sound-grid" id="soundGrid">
      ${list.map((s, i) => `
        <button type="button" class="sound-thumb ${i===0?'active':''}" data-index="${i}">
          <div class="thumb-photo">
            <img src="${(s.photo)}" alt="">
            <div class="thumb-play">
              <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="23" fill="rgba(10,10,9,0.55)" stroke="#FAF8F4" stroke-width="1.2"/><path d="M19 15l16 9-16 9V15z" fill="#FAF8F4"/></svg>
            </div>
          </div>
          <div class="thumb-info">
            <span class="row-date mono">${s.date.toUpperCase()}</span>
            <h3>${s.artist.toUpperCase()} — ${s.location.toUpperCase()}</h3>
          </div>
        </button>
      `).join('')}
    </div>
  `;
  document.querySelectorAll('#studioTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      if(studioFilter === btn.dataset.filter) return;
      studioFilter = btn.dataset.filter;
      renderSoundPage();
    });
  });
  root.querySelectorAll('.sound-thumb').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = list[parseInt(btn.dataset.index, 10)];
      document.getElementById('soundPlayer').src = youtubeEmbedUrl(s.videoId);
      document.getElementById('soundNowTitle').textContent = `${s.artist}, ${s.location.split(',')[0]}`;
      document.getElementById('soundNowDate').textContent = s.date.toUpperCase();
      document.getElementById('soundNowDesc').textContent = s.desc;
      root.querySelectorAll('.sound-thumb').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector('.sound-player-wrap').scrollIntoView({behavior:'smooth', block:'start'});
    });
  });
}

/* ---------------- GATHERING ---------------- */
function formatEventDate(dateStr, timeStr){
  let label = dateStr;
  try{
    const d = new Date(dateStr + 'T00:00:00');
    label = new Intl.DateTimeFormat('en-AU', { day:'numeric', month:'short', year:'numeric' }).format(d).toUpperCase();
  }catch(e){}
  return timeStr ? `${label} · ${timeStr}` : label;
}
// A description can be several lines (one per paragraph) — used both in the
// compact calendar-detail row and the full showcase panel.
function eventDescParagraphs(desc){
  return (desc || '').split('\n').map(p => p.trim()).filter(Boolean).map(p => `<p>${p}</p>`).join('');
}
function eventRowHTML(ev){
  const photo = ev.media_type !== 'video' ? (ev.photo || '') : '';
  return `
    <div class="event-row">
      ${photo ? `<div class="event-row-photo"><img src="${photo}" alt=""></div>` : ''}
      <div class="event-row-info">
        <div class="event-date">${formatEventDate(ev.event_date, ev.event_time)}</div>
        <h3>${ev.title}</h3>
        ${ev.location ? `<div class="event-location">${ev.location}</div>` : ''}
        ${ev.description ? `<p>${ev.description}</p>` : ''}
      </div>
    </div>
  `;
}
// The single event picked in admin to headline the Gathering page. Falls
// back to whichever event is soonest upcoming (or, if none are, the most
// recent past one) so the panel still shows something sensible before an
// admin has explicitly featured anything.
function featuredEvent(){
  const flagged = EVENTS.find(e => e.is_featured);
  if(flagged) return flagged;
  const today = new Date().toISOString().slice(0,10);
  const upcoming = EVENTS.slice().filter(e => e.event_date >= today).sort((a,b) => a.event_date.localeCompare(b.event_date));
  return upcoming[0] || EVENTS.slice().sort((a,b) => b.event_date.localeCompare(a.event_date))[0] || null;
}
function renderEventShowcase(){
  const section = document.getElementById('eventShowcase');
  if(!section) return;
  const ev = featuredEvent();
  if(!ev){ section.style.display = 'none'; return; }

  const photoEl = document.getElementById('eventShowcasePhoto');
  const videoEl = document.getElementById('eventShowcaseVideo');
  const isVideo = ev.media_type === 'video' && ev.video;
  if(isVideo){
    videoEl.src = ev.video;
    videoEl.style.display = '';
    photoEl.style.display = 'none';
    photoEl.removeAttribute('src');
  } else {
    videoEl.style.display = 'none';
    videoEl.removeAttribute('src');
    photoEl.style.display = '';
    photoEl.src = ev.photo || '';
  }

  document.getElementById('eventShowcaseDate').textContent = formatEventDate(ev.event_date, ev.event_time);
  document.getElementById('eventShowcaseTitle').textContent = ev.title;
  const locEl = document.getElementById('eventShowcaseLocation');
  locEl.textContent = ev.location || '';
  locEl.style.display = ev.location ? '' : 'none';
  document.getElementById('eventShowcaseDesc').innerHTML = eventDescParagraphs(ev.description);

  section.style.display = '';
}
// Month currently shown in the Gathering page's calendar. Defaults to
// whichever month has the next upcoming event once events load (see
// renderGatheringPage), falling back to the current month.
let gatheringCalDate = new Date();

function eventsByDateMap(){
  const map = {};
  EVENTS.forEach(e => { (map[e.event_date] = map[e.event_date] || []).push(e); });
  return map;
}
function renderGatheringCalendarGrid(){
  const grid = document.getElementById('gcalGrid');
  const label = document.getElementById('gcalMonthLabel');
  if(!grid || !label) return;

  const year = gatheringCalDate.getFullYear();
  const month = gatheringCalDate.getMonth();
  label.textContent = gatheringCalDate.toLocaleDateString('en-AU', { month:'long', year:'numeric' }).toUpperCase();

  const eventsByDate = eventsByDateMap();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0,10);

  let cells = '';
  for(let i=0;i<startOffset;i++) cells += `<div class="gcal-cell empty"></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasEvents = !!eventsByDate[dateStr];
    const isToday = dateStr === todayStr;
    cells += `<button type="button" class="gcal-cell${hasEvents ? ' has-event' : ''}${isToday ? ' today' : ''}" data-date="${dateStr}"${hasEvents ? '' : ' tabindex="-1"'}>
      <span class="gcal-daynum">${d}</span>
      ${hasEvents ? '<span class="gcal-dot"></span>' : ''}
    </button>`;
  }
  grid.innerHTML = cells;

  grid.querySelectorAll('.gcal-cell.has-event').forEach(btn => {
    btn.addEventListener('click', () => showGatheringCalendarDetail(btn.dataset.date, eventsByDate[btn.dataset.date]));
  });
}
function showGatheringCalendarDetail(dateStr, dayEvents){
  const detail = document.getElementById('gcalDetail');
  if(!detail || !dayEvents) return;
  document.querySelectorAll('#gcalGrid .gcal-cell.selected').forEach(c => c.classList.remove('selected'));
  const activeCell = document.querySelector(`#gcalGrid .gcal-cell[data-date="${dateStr}"]`);
  if(activeCell) activeCell.classList.add('selected');
  detail.innerHTML = dayEvents.map(eventRowHTML).join('');
  detail.style.display = '';
}
function renderGatheringPage(){
  renderEventShowcase();

  const grid = document.getElementById('gatheringGrid');
  const photos = GATHERING_PHOTOS;
  grid.innerHTML = photos.map((ph,i) => `
    <button type="button" class="g-photo" data-index="${i}"><img src="${ph}" alt=""></button>
  `).join('');
  grid.querySelectorAll('.g-photo').forEach(btn => {
    btn.addEventListener('click', () => openLightbox(photos, parseInt(btn.dataset.index, 10)));
  });

  // A small month calendar shown right on the Gathering page (rather than
  // as its own menu item) so customers can see what's coming up. Days with
  // something on are marked; tapping one shows the details below.
  const section = document.getElementById('gatheringEventsSection');
  const detail = document.getElementById('gcalDetail');
  if(section){
    if(EVENTS.length){
      const today = new Date().toISOString().slice(0,10);
      const upcoming = EVENTS.slice().filter(e => e.event_date >= today).sort((a,b) => a.event_date.localeCompare(b.event_date));
      const target = upcoming[0] || EVENTS.slice().sort((a,b) => b.event_date.localeCompare(a.event_date))[0];
      const [ty, tm] = target.event_date.split('-').map(Number);
      gatheringCalDate = new Date(ty, tm - 1, 1);

      const prevBtn = document.getElementById('gcalPrev');
      const nextBtn = document.getElementById('gcalNext');
      if(prevBtn && !prevBtn.dataset.bound){
        prevBtn.dataset.bound = '1';
        prevBtn.addEventListener('click', () => {
          gatheringCalDate = new Date(gatheringCalDate.getFullYear(), gatheringCalDate.getMonth() - 1, 1);
          renderGatheringCalendarGrid();
        });
      }
      if(nextBtn && !nextBtn.dataset.bound){
        nextBtn.dataset.bound = '1';
        nextBtn.addEventListener('click', () => {
          gatheringCalDate = new Date(gatheringCalDate.getFullYear(), gatheringCalDate.getMonth() + 1, 1);
          renderGatheringCalendarGrid();
        });
      }

      if(detail){ detail.style.display = 'none'; detail.innerHTML = ''; }
      renderGatheringCalendarGrid();
      section.style.display = '';
    } else {
      section.style.display = 'none';
    }
  }
}

/* ---------------- ROUTER ---------------- */
const routes = {
  home: document.getElementById('route-home'),
  shop: document.getElementById('route-shop'),
  product: document.getElementById('route-product'),
  cart: document.getElementById('route-cart'),
  orderconfirmation: document.getElementById('route-order-confirmation'),
  chart: document.getElementById('route-chart'),
  about: document.getElementById('route-about'),
  clientservices: document.getElementById('route-client-services'),
  legal: document.getElementById('route-legal'),
  news: document.getElementById('route-news'),
  newspost: document.getElementById('route-newspost'),
  sound: document.getElementById('route-sound'),
  gathering: document.getElementById('route-gathering'),
  collections: document.getElementById('route-collections'),
  collection: document.getElementById('route-collection'),
};
function setTitle(pageTitle){
  document.title = pageTitle ? `${pageTitle} — Chronique` : 'Chronique — Independent apparel';
}
function setActiveNav(key){
  document.querySelectorAll('#navlinks a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === key);
  });
}
function showRoute(key){
  Object.values(routes).forEach(r => r.classList.remove('active'));
  routes[key].classList.add('active');
  window.scrollTo(0,0);
}
function handleRoute(){
  const hash = location.hash || "#/";
  const [pathPart, queryPart] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(queryPart || "");

  if(pathPart === "/" || pathPart === ""){
    currentRoute = 'home';
    renderHome();
    showRoute('home');
    setActiveNav(null);
    setTitle('');
  } else if(pathPart === "/shop"){
    currentRoute = 'shop';
    activeCat = params.get('cat') || "All";
    activeSort = params.get('sort') || "recommended";
    activeQuery = params.get('q') || "";
    renderShop();
    showRoute('shop');
    setActiveNav(activeSort === 'new' ? 'shop-new' : 'shop');
    setTitle(activeCat && activeCat !== 'All' ? `Shop — ${activeCat}` : 'Shop');
  } else if(pathPart.startsWith("/product/")){
    currentRoute = 'product';
    const id = pathPart.split('/product/')[1];
    renderProduct(decodeURIComponent(id));
    showRoute('product');
    setActiveNav(null);
  } else if(pathPart === "/cart"){
    currentRoute = 'cart';
    renderCartPage();
    showRoute('cart');
    setActiveNav(null);
    setTitle('Cart');
  } else if(pathPart === "/order-confirmation"){
    currentRoute = 'orderconfirmation';
    renderOrderConfirmationPage();
    showRoute('orderconfirmation');
    setActiveNav(null);
    setTitle('Order confirmed');
  } else if(pathPart === "/size-chart"){
    currentRoute = 'chart';
    renderSizeChartPage();
    showRoute('chart');
    setActiveNav(null);
    setTitle('Size chart');
  } else if(pathPart === "/about"){
    currentRoute = 'about';
    showRoute('about');
    setActiveNav(null);
    setTitle('About');
  } else if(pathPart === "/client-services"){
    currentRoute = 'clientservices';
    showRoute('clientservices');
    setActiveNav(null);
    setTitle('Client services');
  } else if(pathPart === "/legal"){
    currentRoute = 'legal';
    showRoute('legal');
    setActiveNav(null);
    setTitle('Legal');
  } else if(pathPart === "/news"){
    currentRoute = 'news';
    renderNewsGrid();
    showRoute('news');
    setActiveNav(null);
    setTitle('News');
  } else if(pathPart.startsWith("/news/")){
    currentRoute = 'newspost';
    const slug = pathPart.split('/news/')[1];
    renderNewsPost(decodeURIComponent(slug));
    showRoute('newspost');
    setActiveNav(null);
  } else if(pathPart === "/sound"){
    currentRoute = 'sound';
    renderSoundPage();
    showRoute('sound');
    setActiveNav(null);
    setTitle('Studio');
  } else if(pathPart === "/gathering"){
    currentRoute = 'gathering';
    renderGatheringPage();
    showRoute('gathering');
    setActiveNav(null);
    setTitle('The Gathering');
  } else if(pathPart === "/collections"){
    currentRoute = 'collections';
    renderCollectionsPage();
    showRoute('collections');
    setActiveNav(null);
    setTitle('Collections');
  } else if(pathPart.startsWith("/collections/")){
    currentRoute = 'collection';
    const cid = pathPart.split('/collections/')[1];
    renderCollectionDetail(decodeURIComponent(cid));
    showRoute('collection');
    setActiveNav(null);
  } else {
    currentRoute = 'home';
    renderHome();
    showRoute('home');
    setActiveNav(null);
    setTitle('');
  }
  nav.classList.remove('open');
  drawerBackdrop.classList.remove('open');
  burger.setAttribute('aria-expanded','false');
  shopSidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('open');
  filterToggleBtn.classList.remove('active');
  filterToggleBtn.setAttribute('aria-expanded','false');
  announcementBar.classList.toggle('show', currentRoute === 'home');
  updateHeaderState();
}
window.addEventListener('hashchange', handleRoute);

/* ---------------- HEADER STATE (transparent-at-top / solid-on-scroll) ---------------- */
const header = document.getElementById('siteHeader');
const announcementBar = document.getElementById('announcementBar');
const brandIcon = document.querySelector('.brandmark-icon');
let currentRoute = 'home';
let lastScrollY = window.scrollY || 0;
let iconRotation = 0;
function updateHeaderState(){
  const scrollY = window.scrollY || window.pageYOffset;
  const delta = scrollY - lastScrollY;
  lastScrollY = scrollY;
  iconRotation += delta * 0.6;
  if(brandIcon) brandIcon.style.transform = `rotate(${iconRotation}deg)`;

  const transparent = currentRoute === 'home' && scrollY < 60;
  header.classList.toggle('transparent', transparent);
  header.classList.toggle('solid', !transparent);
  header.classList.toggle('icon-mode', scrollY > 60);
  announcementBar.classList.toggle('transparent', transparent);
  announcementBar.classList.toggle('solid', !transparent);
}
window.addEventListener('scroll', updateHeaderState, {passive:true});

/* ---------------- NAV / DRAWER ---------------- */
const burger = document.getElementById('burgerBtn');
const nav = document.getElementById('navlinks');
const drawerBackdrop = document.getElementById('drawerBackdrop');
function openDrawer(){
  nav.classList.add('open');
  drawerBackdrop.classList.add('open');
  burger.setAttribute('aria-expanded', 'true');
}
function closeDrawer(){
  nav.classList.remove('open');
  drawerBackdrop.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
}
burger.addEventListener('click', () => {
  nav.classList.contains('open') ? closeDrawer() : openDrawer();
});
document.getElementById('drawerCloseBtn').addEventListener('click', closeDrawer);
drawerBackdrop.addEventListener('click', closeDrawer);

/* ---------------- SEARCH OVERLAY ---------------- */
const searchOverlay = document.getElementById('searchOverlay');
const searchInput = document.getElementById('searchInput');
document.getElementById('searchBtn').addEventListener('click', () => {
  searchOverlay.classList.add('open');
  setTimeout(() => searchInput.focus(), 300);
});
document.getElementById('searchCloseBtn').addEventListener('click', () => {
  searchOverlay.classList.remove('open');
});
searchInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' && searchInput.value.trim()){
    searchOverlay.classList.remove('open');
    location.hash = '#/shop?q=' + encodeURIComponent(searchInput.value.trim());
  }
  if(e.key === 'Escape'){ searchOverlay.classList.remove('open'); }
});

/* ---------------- SIZE GUIDE MODAL ---------------- */
const sizeGuideModal = document.getElementById('sizeGuideModal');
const sizeGuideBackdrop = document.getElementById('sizeGuideBackdrop');
let activeUnit = 'in';
function buildSizeTableHTML(guide, unit){
  if(!guide) return '';
  const sizes = Object.keys(guide.rows);
  if(unit === 'intl'){
    const intlMap = guide.intl || INTL_SIZE_MAP;
    return `
      <table class="sizeguide-table">
        <thead><tr><th>Size</th><th>Int'l</th></tr></thead>
        <tbody>
          ${sizes.map(s => `<tr><td>${s}</td><td>${intlMap[s] != null ? intlMap[s] : '—'}</td></tr>`).join('')}
        </tbody>
      </table>`;
  }
  const fmt = unit === 'cm' ? fmtCm : fmtIn;
  return `
    <table class="sizeguide-table">
      <thead><tr><th>Size</th>${guide.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>
        ${sizes.map(s => `<tr><td>${s}</td>${guide.rows[s].map(v => `<td>${fmt(v)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>`;
}
function renderSizeGuideTable(){
  document.getElementById('sizeGuideTableWrap').innerHTML = buildSizeTableHTML(currentGuide, activeUnit);
}
function openSizeGuide(){
  activeUnit = 'in';
  document.querySelectorAll('#unitTabs button').forEach(b => b.classList.toggle('active', b.dataset.unit === 'in'));
  renderSizeGuideTable();
  sizeGuideModal.classList.add('open');
  sizeGuideBackdrop.classList.add('open');
}
function closeSizeGuide(){
  sizeGuideModal.classList.remove('open');
  sizeGuideBackdrop.classList.remove('open');
}
document.getElementById('sizeGuideCloseBtn').addEventListener('click', closeSizeGuide);
sizeGuideBackdrop.addEventListener('click', closeSizeGuide);
document.querySelectorAll('#unitTabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    activeUnit = btn.dataset.unit;
    document.querySelectorAll('#unitTabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSizeGuideTable();
  });
});

/* ---------------- SIZE CHART PAGE ---------------- */
let chartUnit = 'in';
function renderSizeChartPage(){
  document.querySelectorAll('#chartUnitTabs button').forEach(b => b.classList.toggle('active', b.dataset.unit === chartUnit));
  document.getElementById('chartTableTops').innerHTML = buildSizeTableHTML('tops', chartUnit);
  document.getElementById('chartTableBottoms').innerHTML = buildSizeTableHTML('bottoms', chartUnit);
}
document.querySelectorAll('#chartUnitTabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    chartUnit = btn.dataset.unit;
    renderSizeChartPage();
  });
});

/* ---------------- LIGHTBOX ---------------- */
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCount = document.getElementById('lightboxCount');
let lightboxPhotos = [];
let lightboxIndex = 0;
function showLightboxPhoto(){
  lightboxImg.src = (lightboxPhotos[lightboxIndex]);
  lightboxCount.textContent = `${lightboxIndex + 1} / ${lightboxPhotos.length}`;
}
function openLightbox(photos, index){
  lightboxPhotos = photos;
  lightboxIndex = index;
  showLightboxPhoto();
  lightbox.classList.add('open');
}
function closeLightbox(){
  lightbox.classList.remove('open');
}
function lightboxPrev(){
  lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
  showLightboxPhoto();
}
function lightboxNext(){
  lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
  showLightboxPhoto();
}
document.getElementById('lightboxCloseBtn').addEventListener('click', closeLightbox);
document.getElementById('lightboxPrevBtn').addEventListener('click', lightboxPrev);
document.getElementById('lightboxNextBtn').addEventListener('click', lightboxNext);
lightbox.addEventListener('click', (e) => {
  if(e.target === lightbox) closeLightbox();
});
window.addEventListener('keydown', (e) => {
  if(!lightbox.classList.contains('open')) return;
  if(e.key === 'Escape') closeLightbox();
  if(e.key === 'ArrowLeft') lightboxPrev();
  if(e.key === 'ArrowRight') lightboxNext();
});

/* ---------------- LIVE LOCALE CLOCK (announcement bar, home only) ---------------- */
function updateClock(){
  const el = document.getElementById('announcementBar');
  if(!el) return;
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-AU', { timeZone:'Australia/Brisbane', weekday:'short', day:'numeric', month:'short' }).format(now);
  const time = new Intl.DateTimeFormat('en-AU', { timeZone:'Australia/Brisbane', hour:'numeric', minute:'2-digit', second:'2-digit', hour12:true }).format(now);
  el.textContent = `Logan, QLD — ${date} · ${time}`;
}
updateClock();
setInterval(updateClock, 1000);

/* ---------------- NEWSLETTER ---------------- */
function wireSubscribe(btnId, inputId, noteId, source){
  const btn = document.getElementById(btnId);
  if(!btn) return;
  btn.addEventListener('click', async () => {
    const input = document.getElementById(inputId);
    const note = document.getElementById(noteId);
    const email = (input.value || '').trim();
    if(!email || !email.includes('@')){
      note.textContent = 'Enter a valid email.';
      return;
    }
    btn.disabled = true;
    try{
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source })
      });
      if(!res.ok) throw new Error('failed');
      note.textContent = "You're on the list.";
      input.value = '';
    }catch(e){
      note.textContent = "Couldn't save that — please try again.";
    }finally{
      btn.disabled = false;
    }
  });
}
wireSubscribe('drawerSubBtn', 'drawerEmail', 'drawerSubNote', 'drawer');
wireSubscribe('homeSubBtn', 'homeEmail', 'homeSubNote', 'home');
wireSubscribe('gatheringSubBtn', 'gatheringEmail', 'gatheringSubNote', 'gathering-rsvp');

/* ---------------- INIT ---------------- */
loadAllData().then(() => {
  handleRoute();
}).catch(err => {
  console.error('Failed to load site data', err);
  document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif;">Could not load the site data. Is the server running?</p>';
});
