import { CLAUDE_MODEL } from '@/lib/aiModel';

const MODEL = CLAUDE_MODEL;

export type PlateEstimate = {
  foodName: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
  notes: string;
  raw: Record<string, unknown>;
};

export type PlateFoodLine = {
  name: string;
  estimated_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type PlateStructuredEstimate = {
  foods: PlateFoodLine[];
  confidence: number;
  notes: string;
};

export async function estimatePlateMacrosWithClaude(params: {
  base64: string;
  mediaType: string;
}): Promise<{ estimate: PlateEstimate; error: Error | null }> {
  const fallback: PlateEstimate = {
    foodName: 'Meal photo',
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    confidence: 0,
    notes: 'Sona AI is unavailable. Enter macros manually.',
    raw: {},
  };
  const key = (process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '').trim();
  if (!key) return { estimate: fallback, error: null };

  const prompt =
    'You are a nutrition estimation assistant. Analyze the food image and return JSON only with keys: ' +
    'food_name, calories, protein_g, carbs_g, fat_g, confidence (0-1), notes. ' +
    'Use realistic single-meal estimates. No markdown, no prose.';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 350,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: params.mediaType,
                  data: params.base64,
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { estimate: fallback, error: new Error(`Anthropic ${res.status}: ${body.slice(0, 180)}`) };
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const rawText = json.content?.find((c) => c.type === 'text')?.text ?? '{}';
    const match = rawText.match(/\{[\s\S]*\}/);
    const parsed = match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};

    const n = (v: unknown) => {
      const x = Number(v ?? 0);
      return Number.isFinite(x) ? Math.max(0, Math.round(x * 10) / 10) : 0;
    };
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0)));

    return {
      estimate: {
        foodName: String(parsed.food_name ?? 'Meal photo').trim() || 'Meal photo',
        calories: n(parsed.calories),
        protein_g: n(parsed.protein_g),
        carbs_g: n(parsed.carbs_g),
        fat_g: n(parsed.fat_g),
        confidence: Number.isFinite(confidence) ? confidence : 0,
        notes: String(parsed.notes ?? '').trim(),
        raw: parsed,
      },
      error: null,
    };
  } catch (e) {
    return { estimate: fallback, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function estimatePlateFoodsStructuredWithClaude(params: {
  base64: string;
  mediaType: string;
}): Promise<{ estimate: PlateStructuredEstimate; error: Error | null }> {
  const fallback: PlateStructuredEstimate = {
    foods: [],
    confidence: 0,
    notes: 'AI estimates — tap to adjust quantities.',
  };
  const key = (process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '').trim();
  if (!key) return { estimate: fallback, error: null };
  const prompt =
    'Analyze this meal photo and return JSON only with this exact schema: ' +
    '{"foods":[{"name":"","estimated_grams":0,"calories":0,"protein":0,"carbs":0,"fat":0}],"confidence":0,"notes":""}. ' +
    'Include 1-6 food lines. Values should be realistic meal estimates.';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: params.mediaType, data: params.base64 },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return { estimate: fallback, error: new Error(`Anthropic ${res.status}`) };
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const rawText = json.content?.find((c) => c.type === 'text')?.text ?? '{}';
    const match = rawText.match(/\{[\s\S]*\}/);
    const parsed = match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};
    const arr = Array.isArray(parsed.foods) ? parsed.foods : [];
    const foods: PlateFoodLine[] = arr.map((x) => {
      const o = x as Record<string, unknown>;
      return {
        name: String(o.name ?? 'Food'),
        estimated_grams: Number(o.estimated_grams ?? 0) || 0,
        calories: Number(o.calories ?? 0) || 0,
        protein: Number(o.protein ?? 0) || 0,
        carbs: Number(o.carbs ?? 0) || 0,
        fat: Number(o.fat ?? 0) || 0,
      };
    });
    return {
      estimate: {
        foods,
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0) || 0)),
        notes: String(parsed.notes ?? 'AI estimates — tap to adjust quantities.'),
      },
      error: null,
    };
  } catch (e) {
    return { estimate: fallback, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export const estimatePlateFoodsStructuredWithSona = estimatePlateFoodsStructuredWithClaude;
