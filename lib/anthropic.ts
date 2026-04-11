/**
 * Anthropic Claude for onboarding / coach (brief §2).
 * When EXPO_PUBLIC_ANTHROPIC_API_KEY is unset, callers should use scripted fallbacks.
 */
const MODEL = 'claude-sonnet-4-5-20251022';

export async function anthropicMessages(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ text: string | null; error: Error | null }> {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!key) {
    return { text: null, error: null };
  }

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
        max_tokens: params.maxTokens ?? 256,
        system: params.system,
        messages: [{ role: 'user', content: params.user }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        text: null,
        error: new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`),
      };
    }

    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const block = json.content?.find((c) => c.type === 'text');
    return { text: block?.text?.trim() ?? null, error: null };
  } catch (e) {
    return { text: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
