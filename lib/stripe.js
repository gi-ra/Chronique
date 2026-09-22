const Stripe = require('stripe');

let stripe = null;

function getStripe() {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add it to your .env file — see README.md for how to get one from your Stripe dashboard.'
    );
  }
  stripe = new Stripe(key);
  return stripe;
}

module.exports = { getStripe };
