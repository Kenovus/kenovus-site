/**
 * PART 7 — Wearable sync infrastructure.
 * Fetches Apple Health, Oura, Whoop data and saves to vitality_logs.
 * Called on app open; data is surfaced in Progress tab and Sona context.
 */
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface WearableDailySnapshot {
  date: string;                 // YYYY-MM-DD
  source: 'apple_health' | 'oura' | 'whoop' | 'manual';
  steps: number | null;
  activeCalories: number | null;
  restingHr: number | null;
  hrv: number | null;          // SDNN ms (Apple) or rMSSD (Oura/Whoop)
  sleepHours: number | null;
  sleepScore: number | null;   // Oura/Whoop 0-100
  readinessScore: number | null; // Oura
  recoveryScore: number | null;  // Whoop
  strainScore: number | null;    // Whoop
}

export interface ConnectedWearable {
  provider: 'apple_health' | 'oura' | 'whoop';
  connected: boolean;
  lastSync: string | null;
}

// ── Supabase persistence ──────────────────────────────────────────────────────
export async function saveWearableSnapshot(
  patientId: string,
  snapshot: WearableDailySnapshot,
): Promise<void> {
  await supabase.from('vitality_logs').upsert(
    {
      patient_id: patientId,
      log_date: snapshot.date,
      source: snapshot.source,
      steps: snapshot.steps,
      active_calories: snapshot.activeCalories,
      resting_hr: snapshot.restingHr,
      hrv_ms: snapshot.hrv,
      sleep_hours: snapshot.sleepHours,
      sleep_score: snapshot.sleepScore,
      readiness_score: snapshot.readinessScore,
      recovery_score: snapshot.recoveryScore,
      strain_score: snapshot.strainScore,
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'patient_id,log_date,source' },
  );
}

export async function fetchLatestWearableData(
  patientId: string,
  days = 7,
): Promise<WearableDailySnapshot[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from('vitality_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('log_date', since)
    .order('log_date', { ascending: false });

  return (data ?? []).map((r) => ({
    date: r.log_date,
    source: r.source,
    steps: r.steps,
    activeCalories: r.active_calories,
    restingHr: r.resting_hr,
    hrv: r.hrv_ms,
    sleepHours: r.sleep_hours,
    sleepScore: r.sleep_score,
    readinessScore: r.readiness_score,
    recoveryScore: r.recovery_score,
    strainScore: r.strain_score,
  }));
}

// ── Apple Health sync ──────────────────────────────────────────────────────────
// Uses the existing Apple Health integration in lib/health/
export async function syncAppleHealth(patientId: string): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    // The existing wearables/ingestion.ts handles HealthKit — we just ensure
    // the latest data is surfaced in vitality_logs
    const { syncAppleHealthSnapshotToVitality } = await import('@/lib/health/appleHealthSync');
    await syncAppleHealthSnapshotToVitality(patientId);
  } catch (e) {
    console.warn('[wearableSync] Apple Health sync failed:', e);
  }
}

// ── Oura Ring sync ─────────────────────────────────────────────────────────────
export async function syncOura(patientId: string, accessToken: string): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const [readiness, sleep, activity] = await Promise.all([
      fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${yesterday}&end_date=${today}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json()).catch(() => null),
      fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${yesterday}&end_date=${today}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json()).catch(() => null),
      fetch(`https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${yesterday}&end_date=${today}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json()).catch(() => null),
    ]);

    const readRow = readiness?.data?.[0];
    const sleepRow = sleep?.data?.[0];
    const actRow = activity?.data?.[0];

    if (!readRow && !sleepRow && !actRow) return;

    const snapshot: WearableDailySnapshot = {
      date: readRow?.day ?? sleepRow?.day ?? actRow?.day ?? today,
      source: 'oura',
      steps: actRow?.steps ?? null,
      activeCalories: actRow?.active_calories ?? null,
      restingHr: sleepRow?.average_breath_rate ?? null,
      hrv: sleepRow?.average_hrv ?? null,
      sleepHours: sleepRow ? (sleepRow.total_sleep_duration ?? 0) / 3600 : null,
      sleepScore: sleepRow?.score ?? null,
      readinessScore: readRow?.score ?? null,
      recoveryScore: null,
      strainScore: null,
    };
    await saveWearableSnapshot(patientId, snapshot);
  } catch (e) {
    console.warn('[wearableSync] Oura sync failed:', e);
  }
}

// ── Whoop sync ─────────────────────────────────────────────────────────────────
export async function syncWhoop(patientId: string, accessToken: string): Promise<void> {
  try {
    const [recovery, sleep] = await Promise.all([
      fetch('https://api.prod.whoop.com/developer/v1/recovery?limit=1', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json()).catch(() => null),
      fetch('https://api.prod.whoop.com/developer/v1/activity/sleep?limit=1', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json()).catch(() => null),
    ]);

    const recRow = recovery?.records?.[0];
    const sleepRow = sleep?.records?.[0];

    if (!recRow && !sleepRow) return;

    const snapshot: WearableDailySnapshot = {
      date: new Date().toISOString().slice(0, 10),
      source: 'whoop',
      steps: null,
      activeCalories: recRow?.kilojoule ? Math.round(recRow.kilojoule * 239.006) : null,
      restingHr: recRow?.resting_heart_rate ?? null,
      hrv: recRow?.hrv_rmssd_milli ?? null,
      sleepHours: sleepRow ? (sleepRow.score?.total_in_bed_time_milli ?? 0) / 3600000 : null,
      sleepScore: sleepRow?.score?.sleep_performance_percentage ?? null,
      readinessScore: null,
      recoveryScore: recRow?.score?.recovery_score ?? null,
      strainScore: recRow?.score?.strain ?? null,
    };
    await saveWearableSnapshot(patientId, snapshot);
  } catch (e) {
    console.warn('[wearableSync] Whoop sync failed:', e);
  }
}

// ── Master sync (called on app open) ─────────────────────────────────────────
export async function syncAllWearables(patientId: string): Promise<void> {
  // Fetch connected providers from DB
  const { data: connections } = await supabase
    .from('wearable_connections')
    .select('provider, status, metadata')
    .eq('patient_id', patientId)
    .eq('status', 'connected');

  const connected = connections ?? [];

  await Promise.allSettled([
    // Apple Health always attempted (uses HealthKit, no OAuth token needed here)
    syncAppleHealth(patientId),
    // OAuth-based providers
    ...connected.map((c: { provider: string; metadata: Record<string, unknown> }) => {
      const token = c.metadata?.access_token as string | undefined;
      if (!token) return Promise.resolve();
      if (c.provider === 'oura') return syncOura(patientId, token);
      if (c.provider === 'whoop') return syncWhoop(patientId, token);
      return Promise.resolve();
    }),
  ]);
}

/** Format wearable data for Sona context injection */
export function formatWearableContextBlock(data: WearableDailySnapshot[]): string {
  if (!data.length) return '';
  const latest = data[0];
  const lines = ['── WEARABLE DATA ──'];

  if (latest.readinessScore != null) lines.push(`Oura readiness: ${latest.readinessScore}/100`);
  if (latest.recoveryScore != null)  lines.push(`Whoop recovery: ${latest.recoveryScore}%`);
  if (latest.hrv != null)            lines.push(`HRV: ${latest.hrv}ms${latest.hrv < 35 ? ' (low — recovery day recommended)' : latest.hrv > 60 ? ' (excellent)' : ''}`);
  if (latest.sleepHours != null)     lines.push(`Sleep: ${latest.sleepHours.toFixed(1)} hrs${latest.sleepScore != null ? ` (score: ${latest.sleepScore}/100)` : ''}`);
  if (latest.steps != null)          lines.push(`Steps: ${latest.steps.toLocaleString()}`);
  if (latest.restingHr != null)      lines.push(`Resting HR: ${latest.restingHr} bpm`);

  return lines.join('\n');
}
