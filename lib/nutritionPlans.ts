/**
 * Nutrition Plans & Meal Templates data layer.
 * Plans = intended meals. Templates = named re-usable meal sets.
 */
import { supabase } from '@/lib/supabase';
import type { MealType } from '@/lib/nutritionLogData';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface NutritionPlanRow {
  id: string;
  patient_id: string;
  plan_date: string;
  meal_type: MealType;
  food_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  serving_size: number | null;
  serving_unit: string | null;
  source: string;
  created_at: string;
}

export interface TemplateMealItem {
  meal_type: MealType;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size: number;
  serving_unit: string;
}

export interface MealTemplateRow {
  id: string;
  patient_id: string;
  template_name: string;
  meals: TemplateMealItem[];
  total_calories: number | null;
  created_at: string;
}

// ── Plans CRUD ────────────────────────────────────────────────────────────────
export async function fetchPlansForDate(
  patientId: string,
  date: string,
): Promise<NutritionPlanRow[]> {
  const { data } = await supabase
    .from('nutrition_plans')
    .select('*')
    .eq('patient_id', patientId)
    .eq('plan_date', date)
    .order('created_at');
  return (data ?? []) as NutritionPlanRow[];
}

export async function upsertPlanEntry(
  entry: Omit<NutritionPlanRow, 'id' | 'created_at'>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('nutrition_plans').insert(entry);
  return { error: error?.message ?? null };
}

export async function deletePlanEntry(id: string): Promise<void> {
  await supabase.from('nutrition_plans').delete().eq('id', id);
}

export async function clearPlansForDate(
  patientId: string,
  date: string,
): Promise<void> {
  await supabase
    .from('nutrition_plans')
    .delete()
    .eq('patient_id', patientId)
    .eq('plan_date', date);
}

// ── Plan totals ───────────────────────────────────────────────────────────────
export function sumPlans(plans: NutritionPlanRow[]) {
  return plans.reduce(
    (a, p) => ({
      calories: a.calories + (p.calories ?? 0),
      protein:  a.protein  + (p.protein_g ?? 0),
      carbs:    a.carbs    + (p.carbs_g ?? 0),
      fat:      a.fat      + (p.fat_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// ── Meal Templates CRUD ───────────────────────────────────────────────────────
export async function fetchTemplates(patientId: string): Promise<MealTemplateRow[]> {
  const { data } = await supabase
    .from('meal_templates')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((r) => ({
    ...r,
    meals: (r.meals ?? []) as TemplateMealItem[],
  })) as MealTemplateRow[];
}

export async function saveTemplate(opts: {
  patientId: string;
  name: string;
  meals: TemplateMealItem[];
}): Promise<{ error: string | null }> {
  const totalCal = opts.meals.reduce((s, m) => s + m.calories, 0);
  const { error } = await supabase.from('meal_templates').insert({
    patient_id:     opts.patientId,
    template_name:  opts.name,
    meals:          opts.meals,
    total_calories: totalCal,
  });
  return { error: error?.message ?? null };
}

export async function deleteTemplate(id: string): Promise<void> {
  await supabase.from('meal_templates').delete().eq('id', id);
}

/** Save today's food logs as a named template */
export async function saveCurrentDayAsTemplate(opts: {
  patientId: string;
  name: string;
  foodLogs: Array<{
    meal_type: MealType;
    food_name: string;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    serving_size: number | null;
    serving_unit: string | null;
  }>;
}): Promise<{ error: string | null }> {
  const meals: TemplateMealItem[] = opts.foodLogs.map((f) => ({
    meal_type:    f.meal_type,
    food_name:    f.food_name,
    calories:     f.calories ?? 0,
    protein_g:    f.protein_g ?? 0,
    carbs_g:      f.carbs_g ?? 0,
    fat_g:        f.fat_g ?? 0,
    serving_size: f.serving_size ?? 100,
    serving_unit: f.serving_unit ?? 'g',
  }));
  return saveTemplate({ patientId: opts.patientId, name: opts.name, meals });
}

/** Apply a template — log all its meals as food_logs for a given date */
export async function applyTemplateToDate(opts: {
  patientId: string;
  template: MealTemplateRow;
  targetDate: string;
  asPlanned?: boolean;  // if true, insert into nutrition_plans instead
}): Promise<{ count: number; error: string | null }> {
  const table = opts.asPlanned ? 'nutrition_plans' : 'food_logs';
  const dateField = opts.asPlanned ? 'plan_date' : 'log_date';

  const rows = opts.template.meals.map((m) => ({
    patient_id:   opts.patientId,
    [dateField]:  opts.targetDate,
    meal_type:    m.meal_type,
    food_name:    m.food_name,
    calories:     m.calories,
    protein_g:    m.protein_g,
    carbs_g:      m.carbs_g,
    fat_g:        m.fat_g,
    serving_size: m.serving_size,
    serving_unit: m.serving_unit,
    source:       'template',
  }));

  const { error } = await supabase.from(table as 'food_logs').insert(rows as never);
  return { count: rows.length, error: error?.message ?? null };
}
