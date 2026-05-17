-- Mileage log for IRS-compliant trip tracking
CREATE TABLE IF NOT EXISTS mileage_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  trip_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  start_location    TEXT NOT NULL DEFAULT '',
  end_location      TEXT NOT NULL DEFAULT '',
  miles             NUMERIC(8,2) NOT NULL DEFAULT 0,
  purpose           TEXT NOT NULL DEFAULT 'Business',
  category          TEXT NOT NULL DEFAULT 'other',
  deductible_amount NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_mileage" ON mileage_logs
  FOR ALL USING (user_id = auth.uid());
