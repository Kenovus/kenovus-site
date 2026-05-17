/**
 * Anthropic Claude — coach + vision.
 * Reads key from process.env (Metro dev) OR Constants.expoConfig.extra (EAS build).
 * 30-second timeout. 1 automatic retry on network failure.
 */
import Constants from 'expo-constants';
import { CLAUDE_MODEL } from '@/lib/aiModel';

const VISION_MODEL = 'claude-opus-4-7';
const MODEL = CLAUDE_MODEL;
export const ACTIVE_ANTHROPIC_MODEL = MODEL;

const API_TIMEOUT_MS = 30_000;

function getAnthropicKey(): string | null {
  // Metro dev: process.env is inlined by bundler
  const fromEnv = (process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '').trim();
  if (fromEnv && fromEnv.startsWith('sk-ant-')) return fromEnv;

  // EAS / production: key mirrored into app.config.ts extra field
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const fromExtra = (extra?.['EXPO_PUBLIC_ANTHROPIC_API_KEY'] ?? '').trim();
  if (fromExtra && fromExtra.startsWith('sk-ant-')) return fromExtra;

  console.error('[Anthropic] Key missing from both process.env and Constants.expoConfig.extra');
  return null;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callMessages(key: string, body: object, attempt: number): Promise<Response> {
  try {
    return await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (attempt < 2) {
      console.warn('[Anthropic] attempt', attempt, 'failed, retrying in 1 s:', (e as Error).message);
      await new Promise((r) => setTimeout(r, 1000));
      return callMessages(key, body, attempt + 1);
    }
    throw e;
  }
}

export async function anthropicMessages(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{
  text: string | null;
  error: Error | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}> {
  const key = getAnthropicKey();
  if (!key) {
    return {
      text: null,
      error: new Error('Sona is having trouble connecting. Check your internet and try again.'),
      model: null,
      inputTokens: null,
      outputTokens: null,
    };
  }

  const reqBody = {
    model: MODEL,
    max_tokens: params.maxTokens ?? 512,
    system: params.system,
    messages: [{ role: 'user', content: [{ type: 'text', text: params.user }] }],
  };

  try {
    const res = await callMessages(key, reqBody, 1);
    if (!res.ok) {
      const body = await res.text();
      console.error('[Anthropic] HTTP', res.status, body.slice(0, 200));
      return {
        text: null,
        error: new Error(`Sona is having trouble connecting. Check your internet and try again.`),
        model: MODEL,
        inputTokens: null,
        outputTokens: null,
      };
    }
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      model?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const block = json.content?.find((c) => c.type === 'text');
    return {
      text: block?.text?.trim() ?? null,
      error: null,
      model: json.model ?? MODEL,
      inputTokens: json.usage?.input_tokens ?? null,
      outputTokens: json.usage?.output_tokens ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes('abort') || msg.includes('timed out') || msg.includes('timeout');
    console.error('[Anthropic] call failed:', msg);
    return {
      text: null,
      error: new Error(
        isTimeout
          ? 'Sona took too long to respond. Check your connection and try again.'
          : 'Sona is having trouble connecting. Check your internet and try again.',
      ),
      model: MODEL,
      inputTokens: null,
      outputTokens: null,
    };
  }
}

export async function anthropicVision(params: {
  system: string;
  images: string[];
  prompt: string;
  maxTokens?: number;
}): Promise<{ text: string | null; error: Error | null }> {
  const key = getAnthropicKey();
  if (!key) return { text: null, error: new Error('Anthropic API key missing.') };

  const imageBlocks = params.images.map((img) => {
    const base64 = img.startsWith('data:') ? img.split(',')[1] : img;
    const mediaType = img.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } } as const;
  });

  try {
    const res = await callMessages(key, {
      model: VISION_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: params.prompt }] }],
    }, 1);
    if (!res.ok) {
      const body = await res.text();
      return { text: null, error: new Error(`Vision API ${res.status}: ${body.slice(0, 200)}`) };
    }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const block = json.content?.find((c) => c.type === 'text');
    return { text: block?.text?.trim() ?? null, error: null };
  } catch (e) {
    return { text: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
