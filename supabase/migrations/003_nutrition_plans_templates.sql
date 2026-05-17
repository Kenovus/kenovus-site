-- ════════════════════════════════════════════════════════════════════
-- Migration 003 — Nutrition Plans and Meal Templates
-- ════════════════════════════════════════════════════════════════════

-- nutrition_plans: planned (intended) meals vs actual food_logs
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  plan_date    DATE NOT NULL,
  meal_type    TEXT NOT NULL,
  food_name    TEXT NOT NULL,
  calories     NUMERIC(8,2),
  protein_g    NUMERIC(8,2),
  carbs_g      NUMERIC(8,2),
  fat_g        NUMERIC(8,2),
  serving_size NUMERIC(8,2),
  serving_unit TEXT,
  source       TEXT DEFAULT 'manual',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_own" ON nutrition_plans FOR ALL
  USING (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_plans_patient_date ON nutrition_plans(patient_id, plan_date);

-- meal_templates: saved named meal sets the patient can re-apply
CREATE TABLE IF NOT EXISTS meal_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  -- JSONB array: [{ meal_type, food_name, calories, protein_g, carbs_g, fat_g, serving_size, serving_unit }]
  meals         JSONB NOT NULL DEFAULT '[]',
  total_calories NUMERIC(8,2),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE meal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_own" ON meal_templates FOR ALL
  USING (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_templates_patient ON meal_templates(patient_id, created_at DESC);

SELECT 'Migration 003 complete — nutrition_plans and meal_templates created.' AS status;
