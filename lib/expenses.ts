import { CLAUDE_MODEL } from '@/lib/aiModel';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/user';

const MODEL = CLAUDE_MODEL;
const EXPENSE_BUCKET = 'business-expense-receipts';
const EXPENSES_TABLE = 'clinic_expenses';

export type ExpenseDraft = {
  merchant: string;
  amount: number;
  category: string;
  notes: string;
  expenseDate: string;
  confidence: number;
  raw: Record<string, unknown>;
};

const VALID_CATEGORIES = new Set([
  'software',
  'travel',
  'meals',
  'education',
  'supplies',
  'equipment',
  'marketing',
  'contractor',
  'payroll',
  'professional_services',
  'utilities',
  'other',
]);

function normalizeCategory(v: string): string {
  const cleaned = String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return VALID_CATEGORIES.has(cleaned) ? cleaned : 'other';
}

export async function ensureExpenseReceiptBucket(): Promise<void> {
  const { data } = await supabase.storage.listBuckets();
  const exists = (data ?? []).some((b) => b.name === EXPENSE_BUCKET);
  if (exists) return;
  await supabase.storage.createBucket(EXPENSE_BUCKET, {
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  });
}

export async function uploadExpenseReceipt(params: {
  authUserId: string;
  base64: string;
  mimeType: string;
}): Promise<{ storagePath: string | null; signedUrl: string | null; error: Error | null }> {
  await ensureExpenseReceiptBucket();
  const ext =
    params.mimeType === 'image/png'
      ? 'png'
      : params.mimeType === 'image/webp'
        ? 'webp'
        : params.mimeType === 'image/heic' || params.mimeType === 'image/heif'
          ? 'heic'
          : 'jpg';
  const path = `${params.authUserId}/${Date.now()}.${ext}`;
  const dataUri = `data:${params.mimeType};base64,${params.base64}`;
  const dataRes = await fetch(dataUri);
  const bytes = await dataRes.arrayBuffer();
  const { error: upErr } = await supabase.storage.from(EXPENSE_BUCKET).upload(path, bytes, {
    contentType: params.mimeType,
    upsert: false,
  });
  if (upErr) return { storagePath: null, signedUrl: null, error: new Error(upErr.message) };

  const { data, error: signErr } = await supabase.storage.from(EXPENSE_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr) return { storagePath: path, signedUrl: null, error: new Error(signErr.message) };
  return { storagePath: path, signedUrl: data?.signedUrl ?? null, error: null };
}

export async function analyzeReceiptWithClaude(params: {
  base64: string;
  mediaType: string;
}): Promise<{ draft: ExpenseDraft; error: Error | null }> {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  const fallback: ExpenseDraft = {
    merchant: 'Unknown merchant',
    amount: 0,
    category: 'other',
    notes: 'Receipt captured. Claude key unavailable for auto-categorization.',
    expenseDate: new Date().toISOString().slice(0, 10),
    confidence: 0,
    raw: {},
  };
  if (!key) return { draft: fallback, error: null };

  const prompt =
    'Extract this receipt as JSON with keys: merchant, amount, category, expense_date(YYYY-MM-DD), notes, confidence(0-1). ' +
    'Category must be one of software,travel,meals,education,supplies,equipment,marketing,contractor,payroll,professional_services,utilities,other. ' +
    'Return JSON only.';

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
      return { draft: fallback, error: new Error(`Anthropic ${res.status}: ${body.slice(0, 180)}`) };
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const rawText = json.content?.find((c) => c.type === 'text')?.text ?? '{}';
    const match = rawText.match(/\{[\s\S]*\}/);
    const parsed = match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};

    const amountNum = Number(parsed.amount ?? 0);
    const confidenceNum = Number(parsed.confidence ?? 0);
    const date = String(parsed.expense_date ?? '').slice(0, 10);
    return {
      draft: {
        merchant: String(parsed.merchant ?? 'Unknown merchant').trim() || 'Unknown merchant',
        amount: Number.isFinite(amountNum) ? Math.max(0, amountNum) : 0,
        category: normalizeCategory(String(parsed.category ?? 'other')),
        notes: String(parsed.notes ?? '').trim(),
        expenseDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10),
        confidence: Number.isFinite(confidenceNum) ? Math.max(0, Math.min(1, confidenceNum)) : 0,
        raw: parsed,
      },
      error: null,
    };
  } catch (e) {
    return {
      draft: fallback,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

export async function saveBusinessExpense(input: {
  profile: UserProfile | null;
  merchant: string;
  amount: number;
  category: string;
  notes: string;
  expenseDate: string;
  confidence: number;
  receiptStoragePath: string | null;
  receiptImageUrl: string | null;
  rawExtraction: Record<string, unknown>;
}): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(EXPENSES_TABLE)
    .insert({
      clinic_id: input.profile?.clinic_id ?? null,
      submitted_by_auth_user_id: input.profile?.auth_user_id ?? null,
      submitted_by_name: input.profile?.full_name ?? null,
      merchant: input.merchant,
      amount: input.amount,
      category: normalizeCategory(input.category),
      notes: input.notes,
      expense_date: input.expenseDate,
      confidence: input.confidence,
      receipt_storage_path: input.receiptStoragePath,
      receipt_image_url: input.receiptImageUrl,
      source: 'receipt_scan',
      raw_extraction: input.rawExtraction,
    })
    .select('id')
    .maybeSingle();
  if (error) return { id: null, error: new Error(error.message) };
  return { id: (data?.id as string | undefined) ?? null, error: null };
}

export async function listBusinessExpenses(limit = 60): Promise<{
  rows: Array<{
    id: string;
    expense_date: string;
    merchant: string | null;
    amount: number | null;
    category: string | null;
    submitted_by_name: string | null;
    receipt_image_url: string | null;
  }>;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from(EXPENSES_TABLE)
    .select('id, expense_date, merchant, amount, category, submitted_by_name, receipt_image_url')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { rows: [], error: new Error(error.message) };
  return {
    rows: (data ?? []).map((r) => ({
      id: String(r.id),
      expense_date: String(r.expense_date),
      merchant: (r.merchant as string | null) ?? null,
      amount: r.amount != null ? Number(r.amount) : null,
      category: (r.category as string | null) ?? null,
      submitted_by_name: (r.submitted_by_name as string | null) ?? null,
      receipt_image_url: (r.receipt_image_url as string | null) ?? null,
    })),
    error: null,
  };
}
