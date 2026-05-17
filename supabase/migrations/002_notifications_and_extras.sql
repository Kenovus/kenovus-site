-- ════════════════════════════════════════════════════════════════════
-- Migration 002 — Notifications, push tokens, vitality logs
-- ════════════════════════════════════════════════════════════════════

-- Push token + GLP-1 fields on patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS expo_push_token     TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS glp1_medication_name TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS glp1_dose           TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS glp1_injection_day  TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS start_weight_lbs    NUMERIC(6,2);

-- Scheduled notifications queue
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  treatment_name    TEXT,
  scheduled_for     TIMESTAMPTZ NOT NULL,
  sent              BOOLEAN DEFAULT FALSE,
  sent_at           TIMESTAMPTZ,
  push_token        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, notification_type, treatment_name)
);
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifs_own"   ON scheduled_notifications;
DROP POLICY IF EXISTS "notifs_admin" ON scheduled_notifications;
CREATE POLICY "notifs_own" ON scheduled_notifications FOR SELECT USING (
  patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid())
);
CREATE POLICY "notifs_admin" ON scheduled_notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE auth_user_id = auth.uid() AND role = 'super_admin')
);
CREATE INDEX IF NOT EXISTS idx_sched_notifs_pending
  ON scheduled_notifications(scheduled_for, sent) WHERE sent = FALSE;

-- Vitality logs (wearable sync target)
CREATE TABLE IF NOT EXISTS vitality_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  log_date        DATE NOT NULL,
  source          TEXT NOT NULL DEFAULT 'apple_health',
  steps           INTEGER,
  active_calories INTEGER,
  resting_hr      INTEGER,
  hrv_ms          NUMERIC(6,2),
  sleep_hours     NUMERIC(4,2),
  sleep_score     INTEGER,
  readiness_score INTEGER,
  recovery_score  INTEGER,
  strain_score    NUMERIC(5,2),
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, log_date, source)
);
ALTER TABLE vitality_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vitality_own"      ON vitality_logs;
DROP POLICY IF EXISTS "vitality_provider" ON vitality_logs;
CREATE POLICY "vitality_own" ON vitality_logs FOR ALL USING (
  patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid())
);
CREATE POLICY "vitality_provider" ON vitality_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN patients p ON p.clinic_id = up.clinic_id
    WHERE up.auth_user_id = auth.uid()
      AND up.role IN ('provider','clinic_owner','clinic_admin')
      AND p.id = patient_id
  )
);
CREATE INDEX IF NOT EXISTS idx_vitality_patient ON vitality_logs(patient_id, log_date DESC);

SELECT 'Migration 002 complete — notifications and vitality tables created.' AS status;
