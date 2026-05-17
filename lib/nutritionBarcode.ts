export type BarcodeMacroResult = {
  foodName: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: 'openfoodfacts' | 'fallback';
  raw: Record<string, unknown>;
};

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : 0;
}

export async function lookupBarcodeMacros(code: string): Promise<{ result: BarcodeMacroResult; error: Error | null }> {
  const cleaned = code.replace(/[^\dA-Za-z]/g, '').trim();
  const fallback: BarcodeMacroResult = {
    foodName: `Barcode ${cleaned || 'item'}`,
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    source: 'fallback',
    raw: {},
  };
  if (!cleaned) return { result: fallback, error: new Error('Invalid barcode') };

  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleaned)}.json`);
    if (!res.ok) {
      return { result: fallback, error: new Error(`OpenFoodFacts ${res.status}`) };
    }
    const json = (await res.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        nutriments?: {
          ['energy-kcal_100g']?: number | string;
          ['proteins_100g']?: number | string;
          ['carbohydrates_100g']?: number | string;
          ['fat_100g']?: number | string;
        };
      };
    };

    if (json.status !== 1 || !json.product) {
      return { result: fallback, error: new Error('Product not found in OpenFoodFacts') };
    }

    const nutr = json.product.nutriments ?? {};
    return {
      result: {
        foodName: String(json.product.product_name ?? `Barcode ${cleaned}`).trim() || `Barcode ${cleaned}`,
        calories: num(nutr['energy-kcal_100g']),
        protein_g: num(nutr['proteins_100g']),
        carbs_g: num(nutr['carbohydrates_100g']),
        fat_g: num(nutr['fat_100g']),
        source: 'openfoodfacts',
        raw: json as unknown as Record<string, unknown>,
      },
      error: null,
    };
  } catch (e) {
    return { result: fallback, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
