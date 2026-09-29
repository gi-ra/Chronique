// Pushes newsletter/restock sign-ups to Klaviyo, in addition to always
// saving them in our own database first (see routes/api.js) — the database
// copy is the source of truth and never depends on Klaviyo being
// reachable; this is a best-effort sync on top of it.
//
// Needs two environment variables, both from your Klaviyo account:
//   KLAVIYO_API_KEY  — Settings > API Keys > Private API Keys > Create
//                       Private API Key (starts with "pk_"). Needs the
//                       "Profiles" and "Subscriptions" scopes (Full Access
//                       is simplest). Never put this in the website code —
//                       only in Render's Environment settings.
//   KLAVIYO_LIST_ID   — the list you want sign-ups added to. Go to
//                       Lists & Segments in Klaviyo, open (or create) the
//                       list, and copy the ID shown in the page's URL
//                       (.../list/ABC123/...) or under the list's Settings.
//
// If either is missing, this quietly no-ops (logging once) so local
// development and a not-yet-configured production don't break — the
// sign-up is still saved locally either way.

const KLAVIYO_REVISION = '2024-10-15';
let warnedMissingConfig = false;

function isConfigured() {
  const configured = !!(process.env.KLAVIYO_API_KEY && process.env.KLAVIYO_LIST_ID);
  if (!configured && !warnedMissingConfig) {
    warnedMissingConfig = true;
    console.log('Klaviyo not configured (KLAVIYO_API_KEY / KLAVIYO_LIST_ID) — sign-ups are still saved locally.');
  }
  return configured;
}

async function klaviyoRequest(pathname, body) {
  const res = await fetch(`https://a.klaviyo.com/api/${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`,
      revision: KLAVIYO_REVISION,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Klaviyo ${pathname} responded ${res.status}: ${text.slice(0, 300)}`);
  }
}

// email: string. source: where the sign-up came from (drawer/home/
// gathering-rsvp/checkout/restock), stored as a Klaviyo custom property so
// you can filter/segment by it. extraProperties: optional object merged in
// (e.g. which product someone wants restocked).
async function subscribeToKlaviyo({ email, source, extraProperties }) {
  if (!isConfigured()) return;
  try {
    await klaviyoRequest('profile-subscription-bulk-create-jobs/', {
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          custom_source: source || '',
          profiles: {
            data: [
              {
                type: 'profile',
                attributes: {
                  email,
                  properties: { 'Signup Source': source || '', ...(extraProperties || {}) },
                  subscriptions: {
                    email: { marketing: { consent: 'SUBSCRIBED' } },
                  },
                },
              },
            ],
          },
        },
        relationships: {
          list: { data: { type: 'list', id: process.env.KLAVIYO_LIST_ID } },
        },
      },
    });
  } catch (err) {
    // Never let a Klaviyo hiccup fail the sign-up itself — it's already
    // saved locally by this point.
    console.error('Klaviyo sync failed:', err.message);
  }
}

module.exports = { subscribeToKlaviyo };
