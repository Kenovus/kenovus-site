import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';

export type RoutineType = 'am' | 'pm';

export async function fetchSkincareRoutine(authUserId: string, routineType: RoutineType): Promise<string[]> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return [];
  const { data } = await supabase
    .from('skincare_routines')
    .select('steps_json')
    .eq('patient_id', patientId)
    .eq('routine_type', routineType)
    .maybeSingle();
  return Array.isArray(data?.steps_json) ? (data?.steps_json as string[]) : [];
}

export async function upsertSkincareRoutine(authUserId: string, routineType: RoutineType, steps: string[]): Promise<void> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return;
  await supabase.from('skincare_routines').upsert({
    patient_id: patientId,
    routine_type: routineType,
    steps_json: steps,
    updated_at: new Date().toISOString(),
  });
}

export async function saveSkincareLog(params: {
  authUserId: string;
  date: string;
  routineType: RoutineType;
  completed: boolean;
  stepsCompleted: string[];
}): Promise<void> {
  const patientId = await fetchPatientIdForAuthUser(params.authUserId);
  if (!patientId) return;
  await supabase.from('skincare_logs').upsert({
    patient_id: patientId,
    log_date: params.date,
    routine_type: params.routineType,
    completed: params.completed,
    steps_completed_json: params.stepsCompleted,
  });
}

export async function fetchSkincareStreak(authUserId: string): Promise<number> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return 0;
  const { data } = await supabase
    .from('skincare_logs')
    .select('log_date, completed')
    .eq('patient_id', patientId)
    .eq('completed', true)
    .order('log_date', { ascending: false })
    .limit(60);
  const days = new Set((data ?? []).map((d) => String(d.log_date)));
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 60; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
