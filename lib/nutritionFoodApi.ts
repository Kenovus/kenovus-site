import { getExpoPublic } from '@/lib/expoPublicEnv';

export type FoodSearchItem = {
  name: string;
  brand: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size: number;
  serving_unit: string;
  source: 'fatsecret' | 'openfoodfacts' | 'usda';
  image: string | null;
  raw: Record<string, unknown>;
};

export type ConversationalFoodItem = FoodSearchItem & {
  quantity: number;
  phrase: string;
};

const USDA_KEY = getExpoPublic('EXPO_PUBLIC_USDA_API_KEY');
const FATSECRET_CLIENT_ID = getExpoPublic('EXPO_PUBLIC_FATSECRET_CLIENT_ID');
const FATSECRET_CLIENT_SECRET = getExpoPublic('EXPO_PUBLIC_FATSECRET_CLIENT_SECRET');
const FATSECRET_TOKEN_SCOPE = getExpoPublic('EXPO_PUBLIC_FATSECRET_TOKEN_SCOPE').trim();

// Log credential presence at module load — visible in Metro on first import
console.log('[FoodAPI] credentials check:', {
  fatsecret_id_len:     FATSECRET_CLIENT_ID.length,
  fatsecret_secret_len: FATSECRET_CLIENT_SECRET.length,
  usda_key_len:         USDA_KEY.length,
  scope:                FATSECRET_TOKEN_SCOPE || '(none)',
});


const OAUTH_URL = 'https://oauth.fatsecret.com/connect/token';
const SERVER_API = 'https://platform.fatsecret.com/rest/server.api';
const NLP_URL = 'https://platform.fatsecret.com/rest/natural-language-processing/v1';
const FATSECRET_SEARCH_PROXY_URL =
  'https://gixqbbnvoigocxlobbci.supabase.co/functions/v1/fatsecret-search';

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : 0;
}

/** Wrap fetch with a hard timeout so a slow network doesn't silently return nothing */
async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function hasFatSecretCredentials(): boolean {
  return Boolean(FATSECRET_CLIENT_ID && FATSECRET_CLIENT_SECRET);
}

let tokenCache: { accessToken: string; expiresAtMs: number } | null = null;
const TOKEN_SKEW_MS = 60_000;

function basicAuthHeader(): string {
  const raw = `${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`;
  const b64 =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(raw)
      : Buffer.from(raw, 'utf8').toString('base64');
  return `Basic ${b64}`;
}

async function getFatSecretAccessToken(): Promise<string | null> {
  if (!hasFatSecretCredentials()) {
    console.warn('[FatSecret token] no credentials — id_len:', FATSECRET_CLIENT_ID.length, 'secret_len:', FATSECRET_CLIENT_SECRET.length);
    return null;
  }
  const now = Date.now();
  if (tokenCache && now < tokenCache.expiresAtMs - TOKEN_SKEW_MS) {
    console.log('[FatSecret token] using cached token (expires in', Math.round((tokenCache.expiresAtMs - now) / 1000), 's)');
    return tokenCache.accessToken;
  }

  console.log('[FatSecret token] fetching new token from', OAUTH_URL);
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  if (FATSECRET_TOKEN_SCOPE) body.set('scope', FATSECRET_TOKEN_SCOPE);

  try {
    const res = await fetch(OAUTH_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const text = await res.text();
    console.log('[FatSecret token] HTTP', res.status, '— raw:', text.slice(0, 300));

    let json: { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      console.error('[FatSecret token] non-JSON response. Status:', res.status, 'Body:', text.slice(0, 200));
      return null;
    }
    if (!res.ok || !json.access_token) {
      console.error('[FatSecret token] FAILED. Status:', res.status, 'error:', json.error, json.error_description);
      return null;
    }
    const expiresIn = Number(json.expires_in) || 86400;
    tokenCache = { accessToken: json.access_token, expiresAtMs: now + expiresIn * 1000 };
    console.log('[FatSecret token] OK — expires_in:', expiresIn, 's, scope:', FATSECRET_TOKEN_SCOPE || '(all)');
    return tokenCache.accessToken;
  } catch (e) {
    console.error('[FatSecret token] fetch threw:', e);
    return null;
  }
}

function isFatSecretTopLevelError(json: unknown): { code: number; message: string } | null {
  if (!json || typeof json !== 'object') return null;
  const err = (json as { error?: { code?: number | string; message?: string } }).error;
  if (!err || typeof err.message !== 'string') return null;
  const code = typeof err.code === 'number' ? err.code : Number(err.code);
  if (!Number.isFinite(code)) return null;
  return { code, message: err.message };
}

async function fatSecretServerApiGet(params: Record<string, string>): Promise<unknown> {
  const token = await getFatSecretAccessToken();
  if (!token) return null;
  const url = new URL(SERVER_API);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    console.warn('[FatSecret] server.api non-JSON', res.status, text.slice(0, 200));
    return null;
  }
  const apiErr = isFatSecretTopLevelError(json);
  if (apiErr) {
    console.warn('[FatSecret] server.api error', apiErr.code, apiErr.message, 'params=', params);
    return null;
  }
  return json;
}

async function fatSecretServerApiPostForm(params: Record<string, string>): Promise<unknown> {
  const token = await getFatSecretAccessToken();
  if (!token) { console.warn('[FatSecret API POST] no token — aborting'); return null; }
  const body = new URLSearchParams(params).toString();
  console.log('[FatSecret API POST]', SERVER_API, '— method:', params.method, 'query:', params.search_expression ?? params.barcode ?? '?');
  let res: Response;
  try {
    res = await fetch(SERVER_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (e) {
    console.error('[FatSecret API POST] fetch threw:', e);
    return null;
  }
  const text = await res.text();
  console.log('[FatSecret API POST] HTTP', res.status, '— raw (first 400):', text.slice(0, 400));
  let json: unknown;
  try { json = JSON.parse(text) as unknown; } catch {
    console.error('[FatSecret API POST] non-JSON. Status:', res.status);
    return null;
  }
  const apiErr = isFatSecretTopLevelError(json);
  if (apiErr) {
    console.error('[FatSecret API POST] API error code', apiErr.code, ':', apiErr.message);
    return null;
  }
  return json;
}

/** POST first (most reliable for FatSecret), then GET as fallback. */
async function fatSecretServerApi(params: Record<string, string>): Promise<unknown> {
  const postRes = await fatSecretServerApiPostForm(params);
  if (postRes != null) return postRes;
  console.log('[FatSecret API] POST returned null — trying GET fallback');
  return fatSecretServerApiGet(params);
}

function pickServingRecord(servingsBlock: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!servingsBlock) return null;
  const list = toArray<Record<string, unknown>>(servingsBlock.serving as Record<string, unknown> | Record<string, unknown>[] | undefined);
  if (!list.length) return null;
  const def = list.find((s) => String(s.is_default ?? '') === '1');
  return def ?? list[0] ?? null;
}

function mapFatSecretFoodRow(food: Record<string, unknown>, serving: Record<string, unknown> | null): FoodSearchItem | null {
  const foodName = String(food.food_name ?? '').trim();
  if (!foodName) return null;
  const brandRaw = String(food.brand_name ?? '').trim();
  const brand = brandRaw || null;

  const srv = serving ?? pickServingRecord(food.servings as Record<string, unknown> | undefined);
  if (!srv) return null;

  const metricAmt = n(srv.metric_serving_amount) || 100;
  const metricUnit = String(srv.metric_serving_unit ?? 'g').trim() || 'g';
  const carbs = n(srv.carbohydrate);

  return {
    name: foodName,
    brand,
    calories: n(srv.calories),
    protein_g: n(srv.protein),
    carbs_g: carbs,
    fat_g: n(srv.fat),
    serving_size: metricAmt > 0 ? metricAmt : n(srv.number_of_units) || 1,
    serving_unit: metricUnit,
    source: 'fatsecret',
    image: extractFoodImageUrl(food),
    raw: { food, serving: srv },
  };
}

function extractFoodImageUrl(food: Record<string, unknown>): string | null {
  const imgs = food.food_images as Record<string, unknown> | undefined;
  if (!imgs) return null;
  const list = toArray<Record<string, unknown>>(imgs.food_image as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const small = list.find((x) => String(x.image_type ?? '').includes('72')) ?? list[0];
  const url = small ? String(small.image_url ?? '') : '';
  return url || null;
}

function parseFoodsSearchV3(json: unknown): FoodSearchItem[] {
  if (!json || typeof json !== 'object') return [];
  const root = json as Record<string, unknown>;
  const block = (root.foods_search ?? root.foodsSearch) as Record<string, unknown> | undefined;
  if (!block) return [];
  const results = block.results as Record<string, unknown> | undefined;
  if (!results) return [];
  const foods = toArray<Record<string, unknown>>(results.food as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const out: FoodSearchItem[] = [];
  for (const f of foods) {
    const serving = pickServingRecord(f.servings as Record<string, unknown> | undefined);
    const item = mapFatSecretFoodRow(f, serving);
    if (item) out.push(item);
  }
  return out;
}

async function fatSecretFoodSearch(query: string, maxResults = 10): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];
  console.log('[FatSecret Search] starting search for:', q);
  const json = await fatSecretServerApi({
    method: 'foods.search.v3',
    search_expression: q,
    format: 'json',
    max_results: String(maxResults),
    flag_default_serving: 'true',
    region: 'US',
  });
  if (!json) {
    console.warn('[FatSecret Search] no JSON returned for query:', q);
    return [];
  }
  // Log the raw structure before parsing so we can see exactly what FatSecret returned
  const rawStr = JSON.stringify(json);
  console.log('[FatSecret Search] raw response keys:', Object.keys(json as object));
  console.log('[FatSecret Search] raw (first 600):', rawStr.slice(0, 600));
  const items = parseFoodsSearchV3(json);
  console.log('[FatSecret Search] parsed', items.length, 'items for query:', q, '— first:', items[0]?.name ?? 'none');
  return items;
}

function normalizeProxySearchItems(payload: unknown): FoodSearchItem[] {
  if (!payload) return [];
  const root = payload as { items?: unknown; foods?: unknown; results?: unknown };
  const rawItems =
    (Array.isArray(root.items) && root.items) ||
    (Array.isArray(root.foods) && root.foods) ||
    (Array.isArray(root.results) && root.results) ||
    [];
  return rawItems
    .map((x) => x as Partial<FoodSearchItem>)
    .filter((x) => typeof x.name === 'string' && x.name.trim().length > 0)
    .map((x) => ({
      name: String(x.name ?? '').trim(),
      brand: x.brand ? String(x.brand) : null,
      calories: n(x.calories),
      protein_g: n(x.protein_g),
      carbs_g: n(x.carbs_g),
      fat_g: n(x.fat_g),
      serving_size: n(x.serving_size) || 100,
      serving_unit: String(x.serving_unit ?? 'g'),
      source: 'fatsecret' as const,
      image: x.image ? String(x.image) : null,
      raw: (x.raw as Record<string, unknown>) ?? {},
    }));
}

const SUPABASE_ANON_KEY = getExpoPublic('EXPO_PUBLIC_SUPABASE_ANON_KEY');

async function fatSecretProxySearch(query: string, maxResults = 10): Promise<FoodSearchItem[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(FATSECRET_SEARCH_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ query: q, maxResults }),
    });
    console.log('[FatSecret proxy] HTTP status:', res.status);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[FatSecret proxy] HTTP error', res.status, errText.slice(0, 200));
      return [];
    }
    const json = (await res.json()) as unknown;
    // Detect FatSecret API-level errors (returned as HTTP 200 by FatSecret)
    const apiErr = isFatSecretTopLevelError(json);
    if (apiErr) {
      console.warn('[FatSecret proxy] API error code', apiErr.code, apiErr.message);
      return [];
    }
    // Parse raw FatSecret foods.search.v3 response
    const direct = parseFoodsSearchV3(json);
    if (direct.length) {
      console.log('[FatSecret proxy] raw parse OK:', direct.length, 'results');
      return direct;
    }
    // Parse normalized wrapper format
    const items = normalizeProxySearchItems(json);
    if (items.length) {
      console.log('[FatSecret proxy] normalized parse OK:', items.length, 'results');
    } else {
      console.warn('[FatSecret proxy] 0 items parsed. Raw:', JSON.stringify(json).slice(0, 300));
    }
    return items;
  } catch (e) {
    console.warn('[FatSecret proxy] fetch error:', e);
    return [];
  }
}

function mapNlpFoodResponse(entry: Record<string, unknown>): FoodSearchItem | null {
  const eaten = entry.eaten as Record<string, unknown> | undefined;
  const label = String(entry.food_entry_name ?? '').trim();
  if (!label || !eaten) return null;
  const nut = eaten.total_nutritional_content as Record<string, unknown> | undefined;
  if (!nut) return null;
  const metricAmt = n(eaten.total_metric_amount) || n(eaten.per_unit_metric_amount) || 100;
  const metricUnit = String(eaten.metric_description ?? 'g').trim() || 'g';
  return {
    name: label,
    brand: null,
    calories: n(nut.calories),
    protein_g: n(nut.protein),
    carbs_g: n(nut.carbohydrate),
    fat_g: n(nut.fat),
    serving_size: metricAmt > 0 ? metricAmt : 1,
    serving_unit: metricUnit,
    source: 'fatsecret',
    image: null,
    raw: entry,
  };
}

async function fatSecretNaturalLanguage(userInput: string): Promise<FoodSearchItem[]> {
  const token = await getFatSecretAccessToken();
  if (!token) return [];
  try {
    const res = await fetch(NLP_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_input: userInput,
        include_food_data: false,
        region: 'US',
        language: 'en',
      }),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      console.warn('[FatSecret] NLP non-JSON', res.status, text.slice(0, 200));
      return [];
    }
    const apiErr = isFatSecretTopLevelError(json);
    if (apiErr) {
      console.warn('[FatSecret] NLP error', apiErr.code, apiErr.message);
      return [];
    }
    const root = json as Record<string, unknown>;
    const responses = toArray<Record<string, unknown>>(root.food_response as Record<string, unknown> | Record<string, unknown>[] | undefined);
    const out = responses.map(mapNlpFoodResponse).filter(Boolean) as FoodSearchItem[];
    console.log('[FatSecret] NLP food_response count=', out.length, out);
    return out;
  } catch (e) {
    console.warn('[FatSecret] NLP fetch error', e);
    return [];
  }
}

function toGtin13(barcode: string): string {
  const digits = barcode.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 13) return digits.padStart(13, '0');
  return digits.slice(-13);
}

async function fatSecretBarcodeLookup(cleaned: string): Promise<FoodSearchItem | null> {
  const gtin = toGtin13(cleaned);
  if (gtin.length !== 13) return null;
  const json = await fatSecretServerApi({
    method: 'food.find_id_for_barcode.v2',
    barcode: gtin,
    format: 'json',
    flag_default_serving: 'true',
    region: 'US',
  });
  if (!json || typeof json !== 'object') return null;
  const root = json as Record<string, unknown>;
  const food = root.food as Record<string, unknown> | undefined;
  if (!food) {
    console.log('[FatSecret] barcode no food in response', json);
    return null;
  }
  const serving = pickServingRecord(food.servings as Record<string, unknown> | undefined);
  const item = mapFatSecretFoodRow(food, serving);
  console.log('[FatSecret] barcode lookup', { gtin, item });
  return item;
}

function hasUsableMacros(items: FoodSearchItem[]): boolean {
  return items.some((item) => item.calories > 0 || item.protein_g > 0 || item.carbs_g > 0 || item.fat_g > 0);
}

/** Open Food Facts search — completely free, no API key, works in every build */
async function searchOpenFoodFacts(query: string): Promise<FoodSearchItem[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,nutriments,serving_size,image_front_small_url`;
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'SonaLife/1.0' } }, 8000);
  if (!res.ok) { console.warn('[OpenFoodFacts] HTTP', res.status); return []; }
  const j = (await res.json()) as { products?: Array<Record<string, unknown>> };
  const products = j.products ?? [];
  const out: FoodSearchItem[] = [];
  for (const p of products) {
    const name = String(p.product_name ?? '').trim();
    if (!name) continue;
    const nutr = (p.nutriments as Record<string, unknown> | undefined) ?? {};
    const cal  = n(nutr['energy-kcal_100g'] ?? nutr['energy_100g']);
    const pro  = n(nutr['proteins_100g']);
    const carb = n(nutr['carbohydrates_100g']);
    const fat  = n(nutr['fat_100g']);
    out.push({
      name,
      brand: String(p.brands ?? '').split(',')[0]?.trim() || null,
      calories: cal,
      protein_g: pro,
      carbs_g: carb,
      fat_g: fat,
      serving_size: 100,
      serving_unit: 'g',
      source: 'openfoodfacts',
      image: (p.image_front_small_url as string | null) ?? null,
      raw: p,
    });
  }
  return out.filter((x) => x.calories > 0 || x.protein_g > 0 || x.carbs_g > 0 || x.fat_g > 0);
}

/**
 * Food search pipeline — guaranteed to return results for common foods.
 *
 * Order:
 *  1. USDA FoodData Central (free, no IP restrictions, most reliable from device)
 *  2. Open Food Facts (completely free, no API key at all)
 *  3. FatSecret direct client call (OAuth bearer — may be IP-restricted)
 *  4. FatSecret proxy fallback (server-side, last resort)
 */
export async function searchFoodsInstant(query: string): Promise<FoodSearchItem[]> {
  const searchTerm = query.trim();
  if (!searchTerm) return [];

  console.log('[FoodSearch] ── searching:', JSON.stringify(searchTerm), '──');
  console.log('[FoodSearch] credentials — FS:', hasFatSecretCredentials(), 'USDA key len:', USDA_KEY.length);

  // Step 1: USDA FoodData Central — free, works from any IP, most reliable
  if (USDA_KEY) {
    try {
      console.log('[FoodSearch] 1. USDA...');
      const usda = await searchFoodsUsda(searchTerm);
      if (usda.length) {
        console.log('[FoodSearch] ✓ USDA:', usda.length, 'results. First:', usda[0]?.name);
        return usda.slice(0, 10);
      }
      console.warn('[FoodSearch] USDA returned 0 results');
    } catch (e) {
      console.warn('[FoodSearch] USDA threw:', e);
    }
  } else {
    console.warn('[FoodSearch] USDA_KEY missing — skipping');
  }

  // Step 2: Open Food Facts — completely free, no API key, works everywhere
  try {
    console.log('[FoodSearch] 2. Open Food Facts...');
    const off = await searchOpenFoodFacts(searchTerm);
    if (off.length) {
      console.log('[FoodSearch] ✓ Open Food Facts:', off.length, 'results. First:', off[0]?.name);
      return off;
    }
    console.warn('[FoodSearch] Open Food Facts returned 0 results');
  } catch (e) {
    console.warn('[FoodSearch] Open Food Facts threw:', e);
  }

  // Step 3: FatSecret direct (may be IP-restricted depending on account settings)
  if (hasFatSecretCredentials()) {
    try {
      console.log('[FoodSearch] 3. FatSecret direct...');
      const fs = await fatSecretFoodSearch(searchTerm, 10);
      if (fs.length && hasUsableMacros(fs)) {
        console.log('[FoodSearch] ✓ FatSecret:', fs.length, 'results. First:', fs[0]?.name);
        return fs;
      }
      console.log('[FoodSearch] FatSecret returned', fs.length, 'items — falling through');
    } catch (e) {
      console.warn('[FoodSearch] FatSecret threw:', e);
    }
  } else {
    console.warn('[FoodSearch] FatSecret credentials missing');
  }

  // Step 4: Proxy fallback
  try {
    console.log('[FoodSearch] 4. Proxy...');
    const proxy = await fatSecretProxySearch(searchTerm, 10);
    if (proxy.length && hasUsableMacros(proxy)) {
      console.log('[FoodSearch] ✓ Proxy:', proxy.length, 'results');
      return proxy;
    }
  } catch (e) {
    console.warn('[FoodSearch] Proxy threw:', e);
  }

  console.error('[FoodSearch] ✗ ALL sources failed for:', searchTerm);
  return [];
}

export async function parseNaturalLanguageMeal(text: string): Promise<FoodSearchItem[]> {
  const q = text.trim();
  if (!q) return [];

  // Primary: FatSecret NLP (Premier)
  if (hasFatSecretCredentials()) {
    const nlp = await fatSecretNaturalLanguage(q);
    if (nlp.length) return nlp;

    const search = await fatSecretFoodSearch(q, 10);
    if (search.length) {
      console.log('[FatSecret] parseNaturalLanguageMeal fallback foods.search.v3', search);
      return search;
    }
  }

  // Fallback: USDA word-split
  const parts = splitConversationalFoods(q).map((p) => p.phrase).filter(Boolean).slice(0, 8);
  const out: FoodSearchItem[] = [];
  for (const phrase of parts) {
    const rows = await searchFoodsUsda(phrase);
    if (rows[0]) out.push(rows[0]);
  }
  if (out.length) return out;

  return searchFoodsUsda(q);
}

async function lookupOpenFoodFacts(barcode: string): Promise<FoodSearchItem | null> {
  try {
    const off = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`);
    if (off.ok) {
      const j = (await off.json()) as { status?: number; product?: Record<string, unknown> };
      if (j.status === 1 && j.product) {
        const p = j.product;
        const nutr = (p.nutriments as Record<string, unknown> | undefined) ?? {};
        return {
          name: String(p.product_name ?? barcode),
          brand: String(p.brands ?? '').trim() || null,
          calories: n(nutr['energy-kcal_100g']),
          protein_g: n(nutr['proteins_100g']),
          carbs_g: n(nutr['carbohydrates_100g']),
          fat_g: n(nutr['fat_100g']),
          serving_size: 100,
          serving_unit: 'g',
          source: 'openfoodfacts',
          image: (p.image_front_small_url as string | undefined) ?? null,
          raw: p,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function lookupBarcodeFood(barcode: string): Promise<FoodSearchItem | null> {
  const cleaned = barcode.replace(/[^\dA-Za-z]/g, '').trim();
  if (!cleaned) return null;

  if (hasFatSecretCredentials()) {
    const fs = await fatSecretBarcodeLookup(cleaned);
    if (fs) return fs;
  }

  const off = await lookupOpenFoodFacts(cleaned);
  if (off) {
    console.log('[FatSecret] barcode fallback Open Food Facts', off.name);
    return off;
  }

  const usda = await searchFoodsUsda(cleaned);
  return usda[0] ?? null;
}

/** Resolve FDC search `foodNutrients` by id (preferred) or name substring. */
function fdcNutrientValue(nutrients: Array<Record<string, unknown>>, ids: number[], nameSubstrings: string[]): number {
  for (const id of ids) {
    const row = nutrients.find((x) => Number(x.nutrientId) === id);
    if (row && row.value != null && Number.isFinite(Number(row.value))) return n(row.value);
  }
  const lower = nameSubstrings.map((s) => s.toLowerCase());
  for (const sub of lower) {
    const row = nutrients.find((x) => String(x.nutrientName ?? '').toLowerCase().includes(sub));
    if (row && row.value != null && Number.isFinite(Number(row.value))) return n(row.value);
  }
  return 0;
}

/** Energy (kcal): FDC search often uses nutrientId 1008 or 2047; some rows use KJ. */
function fdcEnergyKcal(nutrients: Array<Record<string, unknown>>): number {
  const v = fdcNutrientValue(nutrients, [1008, 2047], ['energy']);
  if (v > 0) return v;
  const row = nutrients.find((x) => {
    const name = String(x.nutrientName ?? '').toLowerCase();
    const u = String(x.unitName ?? '').toLowerCase();
    return name.includes('energy') && (u === 'kcal' || u === 'kj') && Number(x.value) > 0;
  });
  if (!row || row.value == null) return 0;
  const val = n(row.value);
  if (String(row.unitName ?? '').toLowerCase() === 'kj') return Math.round(val / 4.184);
  return val;
}

export async function searchFoodsUsda(query: string): Promise<FoodSearchItem[]> {
  console.log('[USDA] searchFoodsUsda called with query:', query);
  console.log('[USDA] USDA_KEY present:', Boolean(USDA_KEY), 'length:', USDA_KEY?.length ?? 0);

  if (!USDA_KEY) {
    console.error('[USDA] EXPO_PUBLIC_USDA_API_KEY is missing — cannot search USDA');
    return [];
  }

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(USDA_KEY)}`;
  console.log('[USDA] fetching:', url.replace(USDA_KEY, '***'));

  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, pageSize: 20 }),
    }, 8000);
  } catch (e) {
    console.error('[USDA] fetch threw:', e);
    return [];
  }

  console.log('[USDA] HTTP status:', res.status, res.ok ? 'OK' : 'FAIL');

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[USDA] foods/search HTTP error', res.status, errText.slice(0, 200));
    return [];
  }

  let j: { foods?: Array<Record<string, unknown>> };
  try {
    j = (await res.json()) as typeof j;
  } catch (e) {
    console.error('[USDA] JSON parse failed:', e);
    return [];
  }

  console.log('[USDA] raw foods array length:', j.foods?.length ?? 0);

  const rows = (j.foods ?? []).map((f) => {
    const nutrients = (f.foodNutrients as Array<Record<string, unknown>> | undefined) ?? [];
    const calories = fdcEnergyKcal(nutrients);
    const protein_g = fdcNutrientValue(nutrients, [1003], ['protein']);
    const carbs_g   = fdcNutrientValue(nutrients, [1005], ['carbohydrate', 'carbohydrate, by difference']);
    const fat_g     = fdcNutrientValue(nutrients, [1004], ['total lipid', 'fat']);
    return {
      name: String(f.description ?? 'Food'),
      brand: String(f.brandName ?? '').trim() || null,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      serving_size: 100,
      serving_unit: 'g',
      source: 'usda' as const,
      image: null,
      raw: f,
    };
  });

  console.log('[USDA] parsed', rows.length, 'items. First:', rows[0]?.name, 'cal:', rows[0]?.calories);
  return rows;
}

function splitConversationalFoods(text: string): Array<{ phrase: string; quantity: number }> {
  const cleaned = text
    .toLowerCase()
    .replace(/\bi had\b/g, '')
    .replace(/\bi ate\b/g, '')
    .replace(/\bfor (breakfast|lunch|dinner)\b/g, '')
    .replace(/\bmy meal was\b/g, '')
    .trim();
  if (!cleaned) return [];

  const parts = cleaned
    .split(/\band\b|,|\+/g)
    .map((part) => part.replace(/\b(with|w\/)\b/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return parts.map((part) => {
    const qtyMatch = part.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!qtyMatch) return { phrase: part, quantity: 1 };
    const quantity = Number(qtyMatch[1]);
    return {
      phrase: qtyMatch[2].trim(),
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    };
  });
}

export async function parseConversationalFoodText(text: string): Promise<ConversationalFoodItem[]> {
  const candidates = splitConversationalFoods(text).slice(0, 8);
  const out: ConversationalFoodItem[] = [];
  for (const item of candidates) {
    const results = await searchFoodsInstant(item.phrase);
    const best = results[0];
    if (!best) continue;
    out.push({
      ...best,
      phrase: item.phrase,
      quantity: item.quantity,
      calories: n(best.calories * item.quantity),
      protein_g: n(best.protein_g * item.quantity),
      carbs_g: n(best.carbs_g * item.quantity),
      fat_g: n(best.fat_g * item.quantity),
      serving_size: n((best.serving_size || 100) * item.quantity) || 100,
    });
  }
  return out;
}
