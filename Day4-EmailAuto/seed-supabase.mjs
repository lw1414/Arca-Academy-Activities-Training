// Seed Supabase form_submissions with 20 realistic rows by calling the deployed
// `submit` edge function (same path the live site uses).
//
// Usage:
//   node seed-supabase.mjs
//
// Notes:
// - Goes through the edge function, so each call also triggers the welcome
//   email via Resend (if configured). Pass --no-email to skip by hitting REST
//   directly instead (requires an insert RLS policy or service-role key).

const SUPABASE_URL = 'https://ejdarjipxnruwxoaimgs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6jQeujqdEwvh5vfeCMPLSw_JXFc-G7e';
const TABLE = 'form_submissions';

const args = new Set(process.argv.slice(2));
const useRest = args.has('--no-email');

const SAMPLES = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  const firstNames = ['Alex','Jordan','Sam','Riley','Casey','Morgan','Taylor','Quinn','Avery','Drew','Elliot','Rowan','Sage','Kai','Reese','Hayden','Parker','Skylar','Emery','Finley'];
  const lastNames  = ['Reyes','Okafor','Nakamura','Patel','Lindqvist','Moreau','Castillo','Hofstadter','Bianchi','Petrov','Sokolov','Andersson','Müller','Park','Singh','Costa','Watanabe','Vázquez','Ng','Greco'];
  const first = firstNames[i];
  const last  = lastNames[i];
  const msgs = [
    'Loved the orbital section. Could we schedule a 20-min walkthrough this week?',
    'Looking for pricing details on the Team tier — do you offer annual billing?',
    'We are a 35-person QA team evaluating end-to-end testing platforms. Demo available?',
    'How does TesterTech integrate with GitHub Actions and CircleCI out of the box?',
    'Need a SOC 2 report before we can onboard. Where can I request it?',
    'Curious about flaky-test detection — does it auto-quarantine or just flag?',
    'Migrating off Cypress; can your importer convert specs automatically?',
    'Trial extended? We need two more weeks to finish a fair eval against Playwright Cloud.',
    'Saw your TesterTech demo at a conference. Can I get the slide deck?',
    'Does the platform support visual regression with a perceptual diff threshold?',
    'We are an agency running tests for ~12 clients. Is there a multi-workspace setup?',
    'Any case studies from fintech customers? Compliance team wants references.',
    'Hi! Quick question on the smart-watch dissection page — what stack did you use?',
    'Can we pipe test results into Datadog or Honeycomb via the webhooks API?',
    'Self-hosted runner support? Some of our tests need access to internal services.',
    'Would love to see SAML SSO before we commit. Roadmap?',
    'How big is the free tier — total test minutes per month?',
    'Interested in the platform for mobile app testing (iOS + Android).',
    'Please add me to your newsletter and share any upcoming webinar links.',
    'Following up after our LinkedIn chat — sending the requirements doc tomorrow.',
  ];
  return {
    name: `${first} ${last}`,
    email: `${first}.${last}.${String(n).padStart(2,'0')}@example.com`.toLowerCase(),
    message: msgs[i],
  };
});

async function viaEdge(s) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
    },
    body: JSON.stringify(s),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`edge ${r.status}: ${text}`);
  return text;
}

async function viaRest(s) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(s),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`rest ${r.status}: ${text}\n  (needs anon insert policy OR service-role key; or run without --no-email to use the edge function)`);
  return text;
}

const insert = useRest ? viaRest : viaEdge;
console.log(`Seeding 20 rows into Supabase via ${useRest ? 'REST (--no-email)' : 'edge function (will trigger Resend welcome emails)'}…\n`);

let ok = 0, fail = 0;
for (const [i, s] of SAMPLES.entries()) {
  const idx = String(i + 1).padStart(2, '0');
  try {
    await insert(s);
    console.log(`  ✓ ${idx}  ${s.email}`);
    ok++;
  } catch (e) {
    console.log(`  ✗ ${idx}  ${s.email}  — ${e.message}`);
    fail++;
  }
  await new Promise(r => setTimeout(r, 250));
}

console.log(`\nDone: ${ok} ok, ${fail} failed.`);
process.exit(fail ? 1 : 0);
