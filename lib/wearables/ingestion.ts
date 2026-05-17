import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';
import type { WearableDailyMetric, WearableProvider } from '@/lib/wearables/types';

function toInsertRow(patientId: string, metric: WearableDailyMetric) {
  return {
    patient_id: patientId,
    provider: metric.provider,
    metric_date: metric.metric_date,
    steps: metric.steps,
    sleep_hours: metric.sleep_hours,
    resting_hr: metric.resting_hr,
    hrv_sdnn_ms: metric.hrv_sdnn_ms,
    weight_lbs: metric.weight_lbs,
    source_payload: metric.source_payload ?? {},
  };
}

export async function upsertWearableDailyMetricsForAuthUser(
  authUserId: string,
  metrics: WearableDailyMetric[],
): Promise<{ inserted: number; error: Error | null }> {
  try {
    if (!metrics.length) return { inserted: 0, error: null };
    const patientId = await fetchPatientIdForAuthUser(authUserId);
    if (!patientId) return { inserted: 0, error: new Error('Patient profile missing.') };

    const { error } = await supabase
      .from('wearable_daily_metrics')
      .upsert(metrics.map((m) => toInsertRow(patientId, m)), { onConflict: 'patient_id,provider,metric_date' });
    if (error) return { inserted: 0, error: new Error(error.message) };

    const latestByDate = [...metrics].sort((a, b) => (a.metric_date > b.metric_date ? -1 : 1))[0];
    const noteParts = [`${latestByDate.provider} sync`];
    if (latestByDate.resting_hr != null) noteParts.push(`RHR ${Math.round(latestByDate.resting_hr)} bpm`);
    if (latestByDate.hrv_sdnn_ms != null) noteParts.push(`HRV ${Math.round(latestByDate.hrv_sdnn_ms * 10) / 10} ms`);

    await supabase.from('vitality_scores').upsert(
      {
        patient_id: patientId,
        score_date: latestByDate.metric_date,
        steps_today: latestByDate.steps ?? undefined,
        sleep_hours: latestByDate.sleep_hours ?? undefined,
        weight_lbs: latestByDate.weight_lbs ?? undefined,
        notes: noteParts.join(' · '),
      },
      { onConflict: 'patient_id,score_date' },
    );

    return { inserted: metrics.length, error: null };
  } catch (err) {
    return { inserted: 0, error: err instanceof Error ? err : new Error('Unable to upsert wearable metrics') };
  }
}

type IngestResult = {
  metrics: WearableDailyMetric[];
  externalUserId?: string | null;
};

async function ingestFromEdge(input: {
  provider: Exclude<WearableProvider, 'apple_health'>;
  oauthCode: string;
  redirectUri: string;
}): Promise<IngestResult> {
  const { data, error } = await supabase.functions.invoke('wearables-ingest', { body: input });
  if (error) throw new Error(error.message);
  const payload = data as { metrics?: WearableDailyMetric[]; external_user_id?: string | null } | null;
  if (!payload?.metrics?.length) throw new Error('No metrics returned from wearables-ingest function.');
  return { metrics: payload.metrics, externalUserId: payload.external_user_id ?? null };
}

export async function ingestWearableProviderForAuthUser(input: {
  authUserId: string;
  provider: Exclude<WearableProvider, 'apple_health'>;
  oauthCode: string;
  redirectUri: string;
}): Promise<{ inserted: number; error: Error | null }> {
  try {
    const patientId = await fetchPatientIdForAuthUser(input.authUserId);
    if (!patientId) return { inserted: 0, error: new Error('Patient profile missing.') };

    const ingested = await ingestFromEdge({
      provider: input.provider,
      oauthCode: input.oauthCode,
      redirectUri: input.redirectUri,
    });

    const upsert = await upsertWearableDailyMetricsForAuthUser(input.authUserId, ingested.metrics);
    if (upsert.error) {
      await supabase
        .from('wearable_connections')
        .upsert(
          {
            patient_id: patientId,
            provider: input.provider,
            status: 'error',
            last_error: upsert.error.message,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'patient_id,provider' },
        )
        .throwOnError();
      return upsert;
    }

    await supabase
      .from('wearable_connections')
      .upsert(
        {
          patient_id: patientId,
          provider: input.provider,
          status: 'connected',
          external_user_id: ingested.externalUserId ?? null,
          last_sync_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'patient_id,provider' },
      )
      .throwOnError();

    return { inserted: upsert.inserted, error: null };
  } catch (err) {
    return {
      inserted: 0,
      error:
        err instanceof Error
          ? err
          : new Error('Wearable ingest failed. Ensure the wearables-ingest Edge Function is deployed.'),
    };
  }
}
