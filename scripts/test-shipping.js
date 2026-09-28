// Plain Node test script (no framework needed) for the region-based
// shipping rules in lib/shipping.js. Run with `npm test`.
//
// Uses whatever shipping settings are currently in the database — on a
// fresh install (nothing set in Settings > Shipping yet) that's the
// defaults: Rest of Australia $10 (free over $150), NZ $20, Rest of World
// $30 — matching the numbers these tests expect.

const { calculateShipping } = require('../lib/shipping');

const BELOW_THRESHOLD_CENTS = 5000; // $50 — under the $150 free-shipping threshold
const ABOVE_THRESHOLD_CENTS = 20000; // $200 — over the $150 free-shipping threshold

let passed = 0;
let failed = 0;

function check(name, actual, expected, detail) {
  const ok = actual === expected;
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  if (detail) console.log(`        ${detail}`);
}

function run(label, input, assertions) {
  console.log(`\n${label}`);
  const result = calculateShipping(input);
  console.log(`        -> cents=${result.cents} isLocalDelivery=${result.isLocalDelivery} label="${result.label}"`);
  assertions(result);
}

run(
  '1. Logan postcode 4114 -> free local delivery',
  { subtotalCents: BELOW_THRESHOLD_CENTS, country: 'AU', postcode: '4114', line1: '1 Test Street' },
  (r) => {
    check('is local delivery', r.isLocalDelivery, true);
    check('cost is $0', r.cents, 0);
  }
);

run(
  '2. Brisbane CBD postcode 4000 -> free local delivery',
  { subtotalCents: BELOW_THRESHOLD_CENTS, country: 'AU', postcode: '4000', line1: '1 Test Street' },
  (r) => {
    check('is local delivery', r.isLocalDelivery, true);
    check('cost is $0', r.cents, 0);
  }
);

run(
  '3. Toowoomba 4350 -> checking whether it falls inside 100km',
  { subtotalCents: BELOW_THRESHOLD_CENTS, country: 'AU', postcode: '4350', line1: '1 Test Street' },
  (r) => {
    // Straight-line distance from Logan Central to Toowoomba (4350) is
    // ~124.2km — outside the 100km radius, so it should NOT qualify for
    // local delivery. It falls back to the Rest of Australia flat rate.
    check('is NOT local delivery (124.2km > 100km radius)', r.isLocalDelivery, false);
    check('gets Rest of Australia flat rate', r.cents, 1000);
  }
);

run(
  '4. Cairns 4870, under the free-shipping threshold -> $10',
  { subtotalCents: BELOW_THRESHOLD_CENTS, country: 'AU', postcode: '4870', line1: '1 Test Street' },
  (r) => {
    check('is NOT local delivery', r.isLocalDelivery, false);
    check('cost is $10 (1000 cents)', r.cents, 1000);
  }
);

run(
  '5. Melbourne 3000, over the free-shipping threshold -> free',
  { subtotalCents: ABOVE_THRESHOLD_CENTS, country: 'AU', postcode: '3000', line1: '1 Test Street' },
  (r) => {
    check('is NOT local delivery', r.isLocalDelivery, false);
    check('cost is $0 (threshold met)', r.cents, 0);
  }
);

run(
  '6. Local postcode (4114) but a PO Box address -> $10',
  { subtotalCents: BELOW_THRESHOLD_CENTS, country: 'AU', postcode: '4114', line1: 'PO Box 123' },
  (r) => {
    check('is NOT local delivery (PO Box cannot be hand-delivered)', r.isLocalDelivery, false);
    check('cost is $10 (1000 cents)', r.cents, 1000);
  }
);

run(
  '7. Auckland, New Zealand -> NZ rate',
  { subtotalCents: BELOW_THRESHOLD_CENTS, country: 'NZ', postcode: '1010', line1: '1 Queen Street' },
  (r) => {
    check('is NOT local delivery', r.isLocalDelivery, false);
    check('cost is $20 (2000 cents)', r.cents, 2000);
  }
);

run(
  '8. London, UK -> international rate plus the duties note',
  { subtotalCents: BELOW_THRESHOLD_CENTS, country: 'GB', postcode: 'SW1A 1AA', line1: '10 Downing Street' },
  (r) => {
    check('is NOT local delivery', r.isLocalDelivery, false);
    check('cost is $30 (3000 cents)', r.cents, 3000);
    check('shows the duties/taxes note', r.note.includes('import duties'), true);
  }
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
