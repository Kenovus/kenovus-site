import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { fetchAppleHealthSnapshot, isAppleHealthNativeAvailable, requestAppleHealthAuthorization } from '@/lib/health/appleHealth';

export async function syncAppleHealthSnapshotToVitality(authUserId: string): Promise<{ synced: boolean; reason?: string }> {
  if (!isSupabaseConfigured) return { synced: false, reason: 'supabase_not_configured' };
  if (!isAppleHealthNativeAvailable()) return { synced: false, reason: 'healthkit_unavailable' };

  const auth = await requestAppleHealthAuthorization();
  if (!auth.ok) return { synced: false, reason: auth.message ?? 'healthkit_not_authorized' };

  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return { synced: false, reason: 'patient_not_found' };

  const snapshot = await fetchAppleHealthSnapshot();
  const updates: Record<string, number | string> = {
    patient_id: patientId,
    score_date: new Date().toISOString().slice(0, 10),
  };
  if (snapshot.weightLbs != null) updates.weight_lbs = Number(snapshot.weightLbs);
  if (snapshot.stepsToday != null) updates.steps_today = Number(snapshot.stepsToday);
  if (snapshot.sleepHoursLastNight != null) updates.sleep_hours = Number(snapshot.sleepHoursLastNight);
  if (snapshot.restingHeartRate != null) updates.notes = `Apple Health sync · RHR ${Math.round(snapshot.restingHeartRate)} bpm`;
  if (snapshot.hrvSdnnMs != null) {
    const hrv = Math.round(snapshot.hrvSdnnMs * 10) / 10;
    const prev = typeof updates.notes === 'string' ? `${updates.notes}; ` : 'Apple Health sync · ';
    updates.notes = `${prev}HRV ${hrv} ms`;
  }

  if (Object.keys(updates).length <= 2) return { synced: false, reason: 'no_health_data' };

  const { error } = await supabase.from('vitality_scores').upsert(updates, {
    onConflict: 'patient_id,score_date',
  });
  if (error) return { synced: false, reason: error.message };
  return { synced: true };
}
