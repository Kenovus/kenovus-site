import { CLAUDE_MODEL } from '@/lib/aiModel';

export type InBodyExtract = {
  weight_lbs: number | null;
  body_fat_percent: number | null;
  skeletal_muscle_lbs: number | null;
  visceral_fat_level: number | null;
  bmi: number | null;
  lean_mass_lbs: number | null;
  confidence: number;
  notes: string;
  raw: Record<string, unknown>;
};

function n(v: unknown): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : null;
}

export async function extractInBodyOrDexaWithClaude(params: {
  base64: string;
  mediaType: string;
  modality: 'inbody' | 'dexa';
}): Promise<{ data: InBodyExtract; error: Error | null }> {
  const fallback: InBodyExtract = {
    weight_lbs: null,
    body_fat_percent: null,
    skeletal_muscle_lbs: null,
    visceral_fat_level: null,
    bmi: null,
    lean_mass_lbs: null,
    confidence: 0,
    notes: 'AI extraction unavailable. Please enter values manually.',
    raw: {},
  };
  const key = (process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '').trim();
  if (!key) return { data: fallback, error: null };
  const prompt = `Extract body composition values from this ${params.modality.toUpperCase()} report.
Return JSON only with keys:
weight_lbs, body_fat_percent, skeletal_muscle_lbs, visceral_fat_level, bmi, lean_mass_lbs, confidence, notes.
Use null for unknowns; confidence 0-1.`;

  try {
    const body: Record<string, unknown> = {
      model: CLAUDE_MODEL,
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: [
            ...(params.mediaType === 'application/pdf'
              ? [
                  {
                    type: 'document',
                    source: {
                      type: 'base64',
                      media_type: 'application/pdf',
                      data: params.base64,
                    },
                  } as Record<string, unknown>,
                ]
              : [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: params.mediaType,
                      data: params.base64,
                    },
                  } as Record<string, unknown>,
                ]),
            { type: 'text', text: prompt },
          ],
        },
      ],
    };
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { data: fallback, error: new Error(`Anthropic ${res.status}`) };
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const rawText = json.content?.find((c) => c.type === 'text')?.text ?? '{}';
    const match = rawText.match(/\{[\s\S]*\}/);
    const parsed = match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};
    return {
      data: {
        weight_lbs: n(parsed.weight_lbs),
        body_fat_percent: n(parsed.body_fat_percent),
        skeletal_muscle_lbs: n(parsed.skeletal_muscle_lbs),
        visceral_fat_level: n(parsed.visceral_fat_level),
        bmi: n(parsed.bmi),
        lean_mass_lbs: n(parsed.lean_mass_lbs),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0) || 0)),
        notes: String(parsed.notes ?? ''),
        raw: parsed,
      },
      error: null,
    };
  } catch (e) {
    return { data: fallback, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export const extractInBodyOrDexaWithSona = extractInBodyOrDexaWithClaude;
