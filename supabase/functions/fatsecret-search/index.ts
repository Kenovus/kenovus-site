import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

interface FoodItem {
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
  source: "fatsecret" | "usda" | "openfoodfacts";
}

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
}

function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// ── FatSecret ─────────────────────────────────────────────────────────────────

async function getFatSecretToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth.fatsecret.com/connect/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const j = await res.json() as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

function parseFatSecretResults(json: unknown): FoodItem[] {
  if (!json || typeof json !== "object") return [];
  const root = json as Record<string, unknown>;
  if (root.error) {
    // IP restriction or other API error — return empty so we fall through
    console.warn("[FatSecret] API error:", JSON.stringify(root.error));
    return [];
  }
  const block = (root.foods_search ?? root.foodsSearch) as Record<string, unknown> | undefined;
  const rawFoods = block?.results ? (block.results as Record<string, unknown>).food : null;
  if (!rawFoods) return [];

  const foods = toArray<Record<string, unknown>>(rawFoods as never);
  const items: FoodItem[] = [];

  for (const food of foods) {
    const servings = food.servings as Record<string, unknown> | undefined;
    const servingRaw = servings?.serving;
    if (!servingRaw) continue;
    const servingArr = toArray<Record<string, unknown>>(servingRaw as never);
    const serving = servingArr.find((s) => String(s.is_default ?? "") === "1") ?? servingArr[0];
    if (!serving) continue;

    const brand = String(food.brand_name ?? "").trim();
    items.push({
      food_id: String(food.food_id ?? ""),
      food_name: String(food.food_name ?? "").trim(),
      brand_name: brand || null,
      serving_description: String(serving.serving_description ?? "100g"),
      calories: n(serving.calories),
      protein: n(serving.protein),
      carbs: n(serving.carbohydrate),
      fat: n(serving.fat),
      fiber: n(serving.fiber),
      sugar: n(serving.sugar),
      source: "fatsecret",
    });
  }
  return items;
}

async function searchFatSecret(query: string, token: string): Promise<FoodItem[]> {
  const params = new URLSearchParams({
    method: "foods.search.v3",
    search_expression: query,
    format: "json",
    language: "en",
    country: "US",
    max_results: "20",
    flag_default_serving: "true",
    region: "US",
  });
  try {
    const res = await fetch(
      `https://platform.fatsecret.com/rest/server.api?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) { console.warn("[FatSecret] search HTTP", res.status); return []; }
    const json = await res.json();
    const items = parseFatSecretResults(json);
    console.log("[FatSecret] search:", query, "→", items.length, "items");
    return items;
  } catch (e) {
    console.warn("[FatSecret] search threw:", e);
    return [];
  }
}

// ── USDA FoodData Central ─────────────────────────────────────────────────────

function usdaNutrient(
  nutrients: Array<Record<string, unknown>>,
  ids: number[],
  nameSubstrings: string[],
): number {
  for (const id of ids) {
    const row = nutrients.find((x) => Number(x.nutrientId) === id);
    if (row?.value != null && Number.isFinite(Number(row.value))) return n(row.value);
  }
  const lower = nameSubstrings.map((s) => s.toLowerCase());
  for (const sub of lower) {
    const row = nutrients.find((x) =>
      String(x.nutrientName ?? "").toLowerCase().includes(sub)
    );
    if (row?.value != null && Number.isFinite(Number(row.value))) return n(row.value);
  }
  return 0;
}

function usdaEnergyKcal(nutrients: Array<Record<string, unknown>>): number {
  const v = usdaNutrient(nutrients, [1008, 2047], ["energy"]);
  if (v > 0) return v;
  const row = nutrients.find((x) => {
    const name = String(x.nutrientName ?? "").toLowerCase();
    const u = String(x.unitName ?? "").toLowerCase();
    return name.includes("energy") && (u === "kcal" || u === "kj") && Number(x.value) > 0;
  });
  if (!row) return 0;
  const val = n(row.value);
  return String(row.unitName ?? "").toLowerCase() === "kj" ? Math.round(val / 4.184) : val;
}

async function searchUSDA(query: string): Promise<FoodItem[]> {
  const apiKey = Deno.env.get("USDA_API_KEY");
  if (!apiKey) { console.warn("[USDA] USDA_API_KEY not set"); return []; }

  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, pageSize: 20 }),
      },
    );
    if (!res.ok) { console.warn("[USDA] HTTP", res.status); return []; }
    const j = await res.json() as { foods?: Array<Record<string, unknown>> };
    const foods = j.foods ?? [];
    console.log("[USDA] search:", query, "→", foods.length, "items");

    return foods.map((f) => {
      const nutrients = (f.foodNutrients as Array<Record<string, unknown>> | undefined) ?? [];
      return {
        food_id: `usda_${String(f.fdcId ?? "")}`,
        food_name: String(f.description ?? "Food").trim(),
        brand_name: String(f.brandName ?? "").trim() || null,
        serving_description: "100g",
        calories: usdaEnergyKcal(nutrients),
        protein: usdaNutrient(nutrients, [1003], ["protein"]),
        carbs: usdaNutrient(nutrients, [1005], ["carbohydrate", "carbohydrate, by difference"]),
        fat: usdaNutrient(nutrients, [1004], ["total lipid", "fat"]),
        fiber: usdaNutrient(nutrients, [1079], ["fiber"]),
        sugar: usdaNutrient(nutrients, [2000, 1063], ["sugar"]),
        source: "usda" as const,
      };
    }).filter((f) => f.calories > 0 || f.protein > 0 || f.carbs > 0 || f.fat > 0);
  } catch (e) {
    console.warn("[USDA] threw:", e);
    return [];
  }
}

// ── Open Food Facts ───────────────────────────────────────────────────────────

async function searchOpenFoodFacts(query: string): Promise<FoodItem[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,nutriments,serving_size`;
    const res = await fetch(url, { headers: { "User-Agent": "SonaLife/1.0" } });
    if (!res.ok) return [];
    const j = await res.json() as { products?: Array<Record<string, unknown>> };
    const products = j.products ?? [];
    const out: FoodItem[] = [];
    for (const p of products) {
      const name = String(p.product_name ?? "").trim();
      if (!name) continue;
      const nutr = (p.nutriments as Record<string, unknown> | undefined) ?? {};
      const cal = n(nutr["energy-kcal_100g"] ?? nutr["energy_100g"]);
      const pro = n(nutr["proteins_100g"]);
      const carb = n(nutr["carbohydrates_100g"]);
      const fat = n(nutr["fat_100g"]);
      if (cal === 0 && pro === 0 && carb === 0 && fat === 0) continue;
      out.push({
        food_id: `off_${name.toLowerCase().replace(/\s+/g, "_").slice(0, 30)}_${out.length}`,
        food_name: name,
        brand_name: String(p.brands ?? "").split(",")[0]?.trim() || null,
        serving_description: "100g",
        calories: cal,
        protein: pro,
        carbs: carb,
        fat,
        fiber: n(nutr["fiber_100g"]),
        sugar: n(nutr["sugars_100g"]),
        source: "openfoodfacts",
      });
    }
    console.log("[OpenFoodFacts] search:", query, "→", out.length, "items");
    return out;
  } catch (e) {
    console.warn("[OpenFoodFacts] threw:", e);
    return [];
  }
}

// ── Server ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json() as { query?: string };
    const query = (body.query ?? "").trim();
    if (!query) return new Response(JSON.stringify([]), { headers: CORS });

    const clientId = Deno.env.get("FATSECRET_CLIENT_ID");
    const clientSecret = Deno.env.get("FATSECRET_CLIENT_SECRET");

    // 1. Try FatSecret (best data, but requires no-IP-restriction setting in developer console)
    if (clientId && clientSecret) {
      const token = await getFatSecretToken(clientId, clientSecret);
      if (token) {
        const items = await searchFatSecret(query, token);
        if (items.length > 0) {
          return new Response(JSON.stringify(items), { headers: CORS });
        }
        console.log("[Search] FatSecret returned 0 (likely IP restricted) — trying USDA");
      }
    }

    // 2. USDA FoodData Central — free, no IP restrictions, excellent database
    const usdaItems = await searchUSDA(query);
    if (usdaItems.length > 0) {
      return new Response(JSON.stringify(usdaItems), { headers: CORS });
    }

    // 3. Open Food Facts — free, no API key
    const offItems = await searchOpenFoodFacts(query);
    if (offItems.length > 0) {
      return new Response(JSON.stringify(offItems), { headers: CORS });
    }

    console.warn("[Search] All sources returned 0 for:", query);
    return new Response(JSON.stringify([]), { headers: CORS });
  } catch (err) {
    console.error("[Search] Unhandled error:", err);
    return new Response(JSON.stringify([]), { headers: CORS });
  }
});
