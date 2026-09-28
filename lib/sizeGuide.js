// Mirrors the SIZE_GUIDES defaults baked into public/js/site.js — used only
// to pre-fill the admin "Size guide" editor with sensible starting numbers
// for a product's category, which the admin can then adjust for that one
// product's actual cut.
const DEFAULT_GUIDES = {
  bottoms: {
    columns: ['Waist (Relaxed)', 'Inseam Length', 'Front Rise', 'Leg Opening'],
    rows: {
      XS: [27.5, 30.5, 12, 17.5],
      S: [29.5, 30.5, 12.5, 18],
      M: [31.5, 30.5, 13, 18.5],
      L: [33.5, 30.5, 13.5, 19],
      XL: [35.5, 31.5, 14, 19.5],
      XXL: [37.5, 31.5, 14.5, 20],
    },
  },
  tops: {
    columns: ['Chest', 'Body Length', 'Sleeve Length'],
    rows: {
      XS: [36, 26, 23],
      S: [38, 27, 23.5],
      M: [40, 28, 24],
      L: [42, 29, 24.5],
      XL: [44, 30, 25],
      XXL: [46, 31, 25.5],
    },
  },
};

// Category -> which default shape (tops/bottoms) it starts from, same
// mapping as guideForCategory() in site.js. A category not listed here has
// no default — the admin has to explicitly pick "Tops" or "Bottoms" shape.
function defaultGuideTypeForCategory(category) {
  if (category === 'Pants') return 'bottoms';
  if (['Tees & Sweats', 'Knitwear', 'Outerwear'].includes(category)) return 'tops';
  return '';
}

module.exports = { DEFAULT_GUIDES, defaultGuideTypeForCategory };
