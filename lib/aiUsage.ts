import { supabase } from '@/lib/supabase';

function utcStartOfTodayIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString();
}

/** Counts user-authored coach messages today (UTC) across all conversations for this patient. */
export async function countUserCoachMessagesToday(patientId: string): Promise<number> {
  const since = utcStartOfTodayIso();
  const { data: convs, error: cErr } = await supabase.from('ai_conversations').select('id').eq('patient_id', patientId);
  if (cErr || !convs?.length) return 0;
  const ids = convs.map((c) => c.id as string);
  const { count, error } = await supabase
    .from('ai_messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', ids)
    .eq('role', 'user')
    .gte('created_at', since);
  if (error) {
    console.warn('[aiUsage] count failed', error.message);
    return 0;
  }
  return count ?? 0;
}
