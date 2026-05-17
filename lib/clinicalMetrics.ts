import { supabase } from '@/lib/supabase';

export type ClinicalMetricRow = {
  clinic_id: string | null;
  patients_count: number;
  avg_weight_loss_lbs_per_week: number | null;
  avg_body_fat_percent: number | null;
  avg_lean_mass_lbs: number | null;
  avg_protein_hit_rate: number | null;
  inactive_rate_7d: number | null;
  avg_supplement_consistency: number | null;
  avg_workout_sessions_per_week: number | null;
};

export async function fetchClinicalMetricsAggregate(clinicId?: string | null): Promise<ClinicalMetricRow[]> {
  const q = supabase.from('v_clinical_metrics_aggregate').select('*');
  const { data, error } = clinicId ? await q.eq('clinic_id', clinicId) : await q;
  if (error) {
    console.warn('[clinical metrics]', error.message);
    return [];
  }
  return (data ?? []) as ClinicalMetricRow[];
}
