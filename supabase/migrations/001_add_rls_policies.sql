-- ════════════════════════════════════════════════════════════════════
-- SonaLife — Complete RLS Security Migration
-- Tables: patients (auth_user_id), user_profiles (auth_user_id)
-- ════════════════════════════════════════════════════════════════════

-- Helper: resolve patient_id from auth.uid() via auth_user_id column
CREATE OR REPLACE FUNCTION auth_patient_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM patients WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Helper: is current user super_admin?
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE auth_user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Helper: is current user a provider/clinic role?
CREATE OR REPLACE FUNCTION is_provider()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE auth_user_id = auth.uid()
    AND role IN ('provider','clinic_owner','clinic_admin')
  );
$$;

-- Helper: get clinic_id for current user
CREATE OR REPLACE FUNCTION auth_clinic_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT clinic_id FROM user_profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Helper: is patient in provider's clinic?
CREATE OR REPLACE FUNCTION patient_in_my_clinic(p_patient_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM patients p
    WHERE p.id = p_patient_id
      AND p.clinic_id = auth_clinic_id()
  );
$$;

-- ── patients ──────────────────────────────────────────────────────────────────
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patients_own"      ON patients;
DROP POLICY IF EXISTS "patients_admin"    ON patients;
DROP POLICY IF EXISTS "patients_provider" ON patients;
CREATE POLICY "patients_own"      ON patients FOR ALL    USING (auth_user_id = auth.uid());
CREATE POLICY "patients_admin"    ON patients FOR SELECT USING (is_super_admin());
CREATE POLICY "patients_provider" ON patients FOR SELECT USING (is_provider() AND clinic_id = auth_clinic_id());

-- ── user_profiles ─────────────────────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_own"   ON user_profiles;
DROP POLICY IF EXISTS "profiles_admin" ON user_profiles;
CREATE POLICY "profiles_own"   ON user_profiles FOR ALL    USING (auth_user_id = auth.uid());
CREATE POLICY "profiles_admin" ON user_profiles FOR SELECT USING (is_super_admin());

-- ── food_logs ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='food_logs') THEN
    ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "food_own" ON food_logs;
    DROP POLICY IF EXISTS "food_admin" ON food_logs;
    DROP POLICY IF EXISTS "food_provider" ON food_logs;
    CREATE POLICY "food_own"      ON food_logs FOR ALL    USING (patient_id = auth_patient_id());
    CREATE POLICY "food_admin"    ON food_logs FOR SELECT USING (is_super_admin());
    CREATE POLICY "food_provider" ON food_logs FOR SELECT USING (is_provider() AND patient_in_my_clinic(patient_id));
  END IF;
END $$;

-- ── weight_logs ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='weight_logs') THEN
    ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "wt_own" ON weight_logs;
    DROP POLICY IF EXISTS "wt_admin" ON weight_logs;
    DROP POLICY IF EXISTS "wt_provider" ON weight_logs;
    CREATE POLICY "wt_own"      ON weight_logs FOR ALL    USING (patient_id = auth_patient_id());
    CREATE POLICY "wt_admin"    ON weight_logs FOR SELECT USING (is_super_admin());
    CREATE POLICY "wt_provider" ON weight_logs FOR SELECT USING (is_provider() AND patient_in_my_clinic(patient_id));
  END IF;
END $$;

-- ── training_logs ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='training_logs') THEN
    ALTER TABLE training_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tl_own" ON training_logs;
    DROP POLICY IF EXISTS "tl_admin" ON training_logs;
    DROP POLICY IF EXISTS "tl_provider" ON training_logs;
    CREATE POLICY "tl_own"      ON training_logs FOR ALL    USING (patient_id = auth_patient_id());
    CREATE POLICY "tl_admin"    ON training_logs FOR SELECT USING (is_super_admin());
    CREATE POLICY "tl_provider" ON training_logs FOR SELECT USING (is_provider() AND patient_in_my_clinic(patient_id));
  END IF;
END $$;

-- ── patient_supplements ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='patient_supplements') THEN
    ALTER TABLE patient_supplements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "supp_own" ON patient_supplements;
    DROP POLICY IF EXISTS "supp_admin" ON patient_supplements;
    CREATE POLICY "supp_own"   ON patient_supplements FOR ALL    USING (patient_id = auth_patient_id());
    CREATE POLICY "supp_admin" ON patient_supplements FOR SELECT USING (is_super_admin());
  END IF;
END $$;

-- ── patient_macro_goals ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='patient_macro_goals') THEN
    ALTER TABLE patient_macro_goals ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "mg_own" ON patient_macro_goals;
    CREATE POLICY "mg_own" ON patient_macro_goals FOR ALL USING (patient_id = auth_patient_id());
  END IF;
END $$;

-- ── patient_nutrition_targets ─────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='patient_nutrition_targets') THEN
    ALTER TABLE patient_nutrition_targets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "nt_own" ON patient_nutrition_targets;
    CREATE POLICY "nt_own" ON patient_nutrition_targets FOR ALL USING (patient_id = auth_patient_id());
  END IF;
END $$;

-- ── inbody_results ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inbody_results') THEN
    ALTER TABLE inbody_results ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ib_own" ON inbody_results;
    DROP POLICY IF EXISTS "ib_admin" ON inbody_results;
    DROP POLICY IF EXISTS "ib_provider" ON inbody_results;
    CREATE POLICY "ib_own"      ON inbody_results FOR ALL    USING (patient_id = auth_patient_id());
    CREATE POLICY "ib_admin"    ON inbody_results FOR SELECT USING (is_super_admin());
    CREATE POLICY "ib_provider" ON inbody_results FOR SELECT USING (is_provider() AND patient_in_my_clinic(patient_id));
  END IF;
END $$;

-- ── patient_labs ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='patient_labs') THEN
    ALTER TABLE patient_labs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "labs_own" ON patient_labs;
    DROP POLICY IF EXISTS "labs_provider" ON patient_labs;
    CREATE POLICY "labs_own"      ON patient_labs FOR ALL    USING (patient_id = auth_patient_id());
    CREATE POLICY "labs_provider" ON patient_labs FOR SELECT USING (is_provider() AND patient_in_my_clinic(patient_id));
  END IF;
END $$;

-- ── ai_conversations / ai_messages ───────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ai_conversations') THEN
    ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ai_conv_own" ON ai_conversations;
    DROP POLICY IF EXISTS "ai_conv_admin" ON ai_conversations;
    CREATE POLICY "ai_conv_own"   ON ai_conversations FOR ALL    USING (patient_id = auth_patient_id());
    CREATE POLICY "ai_conv_admin" ON ai_conversations FOR SELECT USING (is_super_admin());
  END IF;
END $$;

-- ── patient_appointments / treatments / checkins ──────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='patient_appointments') THEN
    ALTER TABLE patient_appointments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "appts_own" ON patient_appointments;
    DROP POLICY IF EXISTS "appts_provider" ON patient_appointments;
    CREATE POLICY "appts_own"      ON patient_appointments FOR ALL USING (patient_id = auth_patient_id());
    CREATE POLICY "appts_provider" ON patient_appointments FOR ALL USING (is_provider() AND patient_in_my_clinic(patient_id));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='patient_treatments') THEN
    ALTER TABLE patient_treatments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "treats_own" ON patient_treatments;
    DROP POLICY IF EXISTS "treats_provider" ON patient_treatments;
    CREATE POLICY "treats_own"      ON patient_treatments FOR ALL USING (patient_id = auth_patient_id());
    CREATE POLICY "treats_provider" ON patient_treatments FOR ALL USING (is_provider() AND patient_in_my_clinic(patient_id));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='patient_checkins') THEN
    ALTER TABLE patient_checkins ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "checkins_own" ON patient_checkins;
    DROP POLICY IF EXISTS "checkins_provider" ON patient_checkins;
    CREATE POLICY "checkins_own"      ON patient_checkins FOR ALL USING (patient_id = auth_patient_id());
    CREATE POLICY "checkins_provider" ON patient_checkins FOR ALL USING (is_provider() AND patient_in_my_clinic(patient_id));
  END IF;
END $$;

-- ── expenses (new table) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor       TEXT NOT NULL,
  expense_date DATE NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  category     TEXT NOT NULL DEFAULT 'Other',
  description  TEXT,
  receipt_url  TEXT,
  tax_deductible BOOLEAN DEFAULT TRUE,
  notes        TEXT,
  extracted_by_ai BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exp_own"   ON expenses;
DROP POLICY IF EXISTS "exp_admin" ON expenses;
CREATE POLICY "exp_own"   ON expenses FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "exp_admin" ON expenses FOR SELECT USING (is_super_admin());
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id, expense_date DESC);

-- ── referrals (already exists — add RLS only) ────────────────────────────────
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ref_own"   ON referrals;
DROP POLICY IF EXISTS "ref_admin" ON referrals;
-- Use referring_patient_id which links to patients, not auth.users directly
CREATE POLICY "ref_own" ON referrals FOR ALL USING (
  referring_patient_id = auth_patient_id()
  OR referred_patient_id = auth_patient_id()
);
CREATE POLICY "ref_admin" ON referrals FOR ALL USING (is_super_admin());

-- ── clinical_notes (new) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinical_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_id   UUID NOT NULL REFERENCES auth.users(id),
  provider_name TEXT,
  note_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  content       TEXT NOT NULL,
  note_type     TEXT DEFAULT 'general',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notes_patient" ON clinical_notes;
DROP POLICY IF EXISTS "notes_provider" ON clinical_notes;
DROP POLICY IF EXISTS "notes_admin" ON clinical_notes;
CREATE POLICY "notes_patient"  ON clinical_notes FOR SELECT USING (patient_id = auth_patient_id());
CREATE POLICY "notes_provider" ON clinical_notes FOR ALL    USING (provider_id = auth.uid() OR (is_provider() AND patient_in_my_clinic(patient_id)));
CREATE POLICY "notes_admin"    ON clinical_notes FOR ALL    USING (is_super_admin());
CREATE INDEX IF NOT EXISTS idx_notes_patient ON clinical_notes(patient_id, note_date DESC);

-- ── staff_training_progress (new) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_training_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  module_id    TEXT NOT NULL,
  completed    BOOLEAN DEFAULT FALSE,
  score        INTEGER,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);
ALTER TABLE staff_training_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_own"   ON staff_training_progress;
DROP POLICY IF EXISTS "training_admin" ON staff_training_progress;
CREATE POLICY "training_own"   ON staff_training_progress FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "training_admin" ON staff_training_progress FOR SELECT USING (is_super_admin());

SELECT 'Migration 001 complete — RLS policies and new tables created.' AS status;
