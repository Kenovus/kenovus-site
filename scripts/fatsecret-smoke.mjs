/**
 * Local smoke test for FatSecret (from `sonalife/`: `npm run fatsecret:smoke`).
 * Requires `.env` with EXPO_PUBLIC_FATSECRET_* and IP allowlisting in FatSecret developer console.
 */
import 'dotenv/config';

const id = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID;
const sec = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET;
const scope = (process.env.EXPO_PUBLIC_FATSECRET_TOKEN_SCOPE ?? '').trim();

if (!id || !sec) {
  console.error('Missing EXPO_PUBLIC_FATSECRET_CLIENT_ID / EXPO_PUBLIC_FATSECRET_CLIENT_SECRET');
  process.exit(1);
}

const basic = Buffer.from(`${id}:${sec}`).toString('base64');
const body = new URLSearchParams({ grant_type: 'client_credentials' });
if (scope) body.set('scope', scope);

const tr = await fetch('https://oauth.fatsecret.com/connect/token', {
  method: 'POST',
  headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: body.toString(),
});
const tokenJson = await tr.json();
console.log('[FatSecret smoke] token status', tr.status, tokenJson);
if (!tr.ok || !tokenJson.access_token) process.exit(1);
const token = tokenJson.access_token;

async function search(q) {
  const u = new URL('https://platform.fatsecret.com/rest/server.api');
  u.searchParams.set('method', 'foods.search.v3');
  u.searchParams.set('search_expression', q);
  u.searchParams.set('format', 'json');
  u.searchParams.set('max_results', '5');
  u.searchParams.set('flag_default_serving', 'true');
  const fr = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const j = await fr.json();
  console.log('[FatSecret smoke] search', q, 'status', fr.status, JSON.stringify(j).slice(0, 2000));
}

async function nlp(q) {
  const fr = await fetch('https://platform.fatsecret.com/rest/natural-language-processing/v1', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_input: q, include_food_data: false, region: 'US', language: 'en' }),
  });
  const t = await fr.text();
  console.log('[FatSecret smoke] NLP', q, 'status', fr.status, t.slice(0, 2500));
}

await search('banana');
await nlp('2 scrambled eggs');
