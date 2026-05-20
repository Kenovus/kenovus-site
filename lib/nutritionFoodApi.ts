import { getExpoPublic } from '@/lib/expoPublicEnv';
import { supabase } from '@/lib/supabase';
import { fetchRecentFoods, fetchFrequentFoods } from '@/lib/nutritionLogData';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw shape returned by the FatSecret Edge Function and stored in food_cache */
export type FoodItem = {
  food_id: string;
  food_name: string;
  brand_name: string | null;
  serving_description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  source: 'fatsecret' | 'usda' | 'openfoodfacts';
};

/** Shape used throughout the app UI (existing callers depend on these field names) */
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

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = getExpoPublic('EXPO_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getExpoPublic('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const EDGE_URL = `${SUPABASE_URL}/functions/v1/fatsecret-search`;

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapFoodItemToSearchItem(item: FoodItem): FoodSearchItem {
  return {
    name: item.food_name,
    brand: item.brand_name,
    calories: item.calories,
    protein_g: item.protein,
    carbs_g: item.carbs,
    fat_g: item.fat,
    serving_size: 1,
    serving_unit: item.serving_description || '1 serving',
    source: item.source,
    image: null,
    raw: { food_id: item.food_id, fiber: item.fiber, sugar: item.sugar },
  };
}

function mapCacheRowToSearchItem(row: Record<string, unknown>): FoodSearchItem {
  return {
    name: String(row.food_name ?? ''),
    brand: row.brand_name ? String(row.brand_name) : null,
    calories: Number(row.calories ?? 0),
    protein_g: Number(row.protein ?? 0),
    carbs_g: Number(row.carbs ?? 0),
    fat_g: Number(row.fat ?? 0),
    serving_size: 1,
    serving_unit: String(row.serving_description ?? '1 serving'),
    source: (String(row.source ?? 'fatsecret') as FoodSearchItem['source']),
    image: null,
    raw: { food_id: row.food_id, fiber: row.fiber, sugar: row.sugar },
  };
}

// ─── Primary search ───────────────────────────────────────────────────────────

/**
 * Search for foods.
 * 1. Check Supabase food_cache (instant, free)
 * 2. Cache miss → FatSecret Edge Function
 * 3. Save result to cache
 */
export async function searchFoods(query: string): Promise<FoodSearchItem[]> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  // Step 1: Supabase cache
  try {
    const { data: cached, error } = await supabase
      .from('food_cache')
      .select('*')
      .textSearch('food_name', trimmed, { type: 'websearch', config: 'english' })
      .order('search_count', { ascending: false })
      .limit(20);

    if (!error && cached && cached.length > 0) {
      console.log('[FoodSearch] Food cache hit:', cached.length, 'results for:', trimmed);

      // Update last_searched_at (fire-and-forget)
      void supabase
        .from('food_cache')
        .update({ last_searched_at: new Date().toISOString() })
        .in('food_id', cached.map((r) => r.food_id));

      return cached.map((r) => mapCacheRowToSearchItem(r as Record<string, unknown>));
    }
  } catch (cacheErr) {
    console.warn('[FoodSearch] Cache lookup failed, falling through:', cacheErr);
  }

  // Step 2: FatSecret Edge Function
  try {
    const { data: session } = await supabase.auth.getSession();
    const authToken = session?.session?.access_token ?? SUPABASE_ANON_KEY;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    let res: Response;
    try {
      res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ query: trimmed }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      console.error('[FoodSearch] Edge Function HTTP error:', res.status);
      return [];
    }

    const foods = (await res.json()) as FoodItem[];
    console.log('[FoodSearch] FatSecret returned:', foods.length, 'results for:', trimmed);

    if (!Array.isArray(foods) || foods.length === 0) return [];

    // Step 3: Save to cache (fire-and-forget)
    const cacheRows = foods.map((f) => ({
      food_id: f.food_id,
      food_name: f.food_name,
      brand_name: f.brand_name ?? null,
      serving_description: f.serving_description ?? '1 serving',
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      fiber: f.fiber ?? 0,
      sugar: f.sugar ?? 0,
      source: f.source,
      search_count: 1,
    }));

    void supabase
      .from('food_cache')
      .upsert(cacheRows, { onConflict: 'food_id' })
      .then(() => console.log('[FoodSearch] Cached', cacheRows.length, 'foods to Supabase'));

    return foods.map(mapFoodItemToSearchItem);
  } catch (err) {
    console.error('[FoodSearch] Edge Function failed:', err);
    return [];
  }
}

/** Alias for backward compatibility with existing callers */
export const searchFoodsInstant = searchFoods;

// ─── Barcode lookup ───────────────────────────────────────────────────────────

export async function lookupBarcodeFood(barcode: string): Promise<FoodSearchItem | null> {
  const cleaned = barcode.replace(/[^\dA-Za-z]/g, '').trim();
  if (!cleaned) return null;

  // Try Open Food Facts (no API key, works everywhere)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    let res: Response;
    try {
      res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(cleaned)}.json`,
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.ok) {
      const j = (await res.json()) as { status?: number; product?: Record<string, unknown> };
      if (j.status === 1 && j.product) {
        const p = j.product;
        const nutr = (p.nutriments as Record<string, unknown> | undefined) ?? {};
        const name = String(p.product_name ?? cleaned).trim();
        if (name) {
          return {
            name,
            brand: String(p.brands ?? '').split(',')[0]?.trim() || null,
            calories: Number(nutr['energy-kcal_100g'] ?? nutr['energy_100g'] ?? 0),
            protein_g: Number(nutr['proteins_100g'] ?? 0),
            carbs_g: Number(nutr['carbohydrates_100g'] ?? 0),
            fat_g: Number(nutr['fat_100g'] ?? 0),
            serving_size: 100,
            serving_unit: 'g',
            source: 'openfoodfacts',
            image: (p.image_front_small_url as string | null) ?? null,
            raw: p,
          };
        }
      }
    }
  } catch {
    // fall through
  }

  // Fall back to text search on the barcode (FatSecret may index some barcodes)
  const results = await searchFoods(cleaned);
  return results[0] ?? null;
}

// ─── Natural-language parsing ─────────────────────────────────────────────────

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
    .map((p) => p.replace(/\b(with|w\/)\b/g, ' ').replace(/\s+/g, ' ').trim())
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
    const results = await searchFoods(item.phrase);
    const best = results[0];
    if (!best) continue;
    out.push({
      ...best,
      phrase: item.phrase,
      quantity: item.quantity,
      calories: Math.round(best.calories * item.quantity * 10) / 10,
      protein_g: Math.round(best.protein_g * item.quantity * 10) / 10,
      carbs_g: Math.round(best.carbs_g * item.quantity * 10) / 10,
      fat_g: Math.round(best.fat_g * item.quantity * 10) / 10,
      serving_size: (best.serving_size || 1) * item.quantity,
    });
  }
  return out;
}

export async function parseNaturalLanguageMeal(text: string): Promise<FoodSearchItem[]> {
  const q = text.trim();
  if (!q) return [];

  const parts = splitConversationalFoods(q).map((p) => p.phrase).filter(Boolean).slice(0, 8);
  if (parts.length === 0) return searchFoods(q);

  const out: FoodSearchItem[] = [];
  for (const phrase of parts) {
    const results = await searchFoods(phrase);
    if (results[0]) out.push(results[0]);
  }
  return out.length > 0 ? out : searchFoods(q);
}

// ─── Recent + Favorites ───────────────────────────────────────────────────────

/** Last 10 unique foods the patient has logged */
export async function getRecentFoods(patientId: string): Promise<FoodSearchItem[]> {
  const rows = await fetchRecentFoods(patientId);
  const seen = new Set<string>();
  const out: FoodSearchItem[] = [];
  for (const r of rows) {
    const key = r.food_name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: r.food_name,
      brand: r.brand,
      calories: r.calories,
      protein_g: r.protein_g,
      carbs_g: r.carbs_g,
      fat_g: r.fat_g,
      serving_size: r.serving_size ?? 1,
      serving_unit: r.serving_unit ?? '1 serving',
      source: 'fatsecret',
      image: null,
      raw: {},
    });
    if (out.length >= 10) break;
  }
  return out;
}

/** Top 10 most-logged foods (≥ 3 times) */
export async function getFavoriteFoods(patientId: string): Promise<FoodSearchItem[]> {
  const frequent = await fetchFrequentFoods(patientId);
  const rows = await fetchRecentFoods(patientId);

  return frequent.slice(0, 10).map((f) => {
    const match = rows.find((r) => r.food_name.trim().toLowerCase() === f.food_name);
    return {
      name: f.food_name,
      brand: match?.brand ?? null,
      calories: match?.calories ?? 0,
      protein_g: match?.protein_g ?? 0,
      carbs_g: match?.carbs_g ?? 0,
      fat_g: match?.fat_g ?? 0,
      serving_size: match?.serving_size ?? 1,
      serving_unit: match?.serving_unit ?? '1 serving',
      source: 'fatsecret' as const,
      image: null,
      raw: {},
    };
  });
}
