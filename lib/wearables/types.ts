export type WearableProvider = 'apple_health' | 'oura' | 'whoop' | 'fitbit';

export type WearableConnection = {
  id: string;
  provider: WearableProvider;
  status: 'pending' | 'connected' | 'disconnected' | 'error';
  external_user_id: string | null;
  scopes: string[];
  last_sync_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
};

export type WearableDailyMetric = {
  provider: WearableProvider;
  metric_date: string;
  steps: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  hrv_sdnn_ms: number | null;
  weight_lbs: number | null;
  source_payload?: Record<string, unknown>;
};
