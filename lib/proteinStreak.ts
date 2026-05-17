import { localDateKey } from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';

/** Consecutive calendar days (from today backward) where protein was below `fraction` of target. */
export async function consecutiveLowProteinDays(
  patientId: string,
  proteinTargetG: number,
  fraction = 0.9,
): Promise<number> {
  if (proteinTargetG <= 0) return 0;
  const threshold = proteinTargetG * fraction;
  let streak = 0;
  for (let i = 0; i < 14; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = localDateKey(d);
    const { data } = await supabase
      .from('food_log_entries')
      .select('protein_g')
      .eq('patient_id', patientId)
      .eq('log_date', dateKey)
      .eq('entry_type', 'actual');
    const total = (data ?? []).reduce((s, row) => s + Number((row as { protein_g: number | null }).protein_g ?? 0), 0);
    if (total >= threshold) break;
    streak += 1;
  }
  return streak;
}
