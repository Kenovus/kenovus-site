-- Daily wins per-day tracking (protein, training, steps)
CREATE TABLE IF NOT EXISTS daily_wins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL,
  win_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  protein_hit   BOOLEAN NOT NULL DEFAULT FALSE,
  training_done BOOLEAN NOT NULL DEFAULT FALSE,
  steps_hit     BOOLEAN NOT NULL DEFAULT FALSE,
  all_three     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (patient_id, win_date)
);

-- Streak rollup per patient
CREATE TABLE IF NOT EXISTS patient_streaks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_win_date  DATE,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: patients can only read/write their own rows
ALTER TABLE daily_wins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_streaks ENABLE ROW LEVEL SECURITY;

-- daily_wins policies
CREATE POLICY "patients_own_daily_wins" ON daily_wins
  FOR ALL USING (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );

-- patient_streaks policies
CREATE POLICY "patients_own_streaks" ON patient_streaks
  FOR ALL USING (
    patient_id IN (
      SELECT id FROM patients WHERE auth_user_id = auth.uid()
    )
  );
