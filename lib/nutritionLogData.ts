import { supabase } from '@/lib/supabase';

export type MealType =
  | 'breakfast'
  | 'pre_workout'
  | 'lunch'
  | 'post_workout'
  | 'dinner'
  | 'snack';

export type FoodLogRow = {
  id: string;
  food_name: string;
  brand: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: MealType;
  serving_size: number | null;
  serving_unit: string | null;
  source: string | null;
  created_at: string;
};

export async function fetchFoodLogsForDate(patientId: string, logDate: string): Promise<FoodLogRow[]> {
  const { data } = await supabase
    .from('food_log_entries')
    .select('id, food_name, brand, calories, protein_g, carbs_g, fat_g, meal_type, meal_slot, serving_size, serving_unit, source, created_at')
    .eq('patient_id', patientId)
    .eq('log_date', logDate)
    .eq('entry_type', 'actual')
    .order('created_at', { ascending: true });
  return (data ?? []).map((r) => ({
    id: String(r.id),
    food_name: String(r.food_name ?? ''),
    brand: r.brand ? String(r.brand) : null,
    calories: Number(r.calories ?? 0),
    protein_g: Number(r.protein_g ?? 0),
    carbs_g: Number(r.carbs_g ?? 0),
    fat_g: Number(r.fat_g ?? 0),
    meal_type: ((r.meal_type ?? r.meal_slot ?? 'snack') as MealType),
    serving_size: r.serving_size != null ? Number(r.serving_size) : null,
    serving_unit: r.serving_unit != null ? String(r.serving_unit) : null,
    source: r.source != null ? String(r.source) : null,
    created_at: String(r.created_at ?? ''),
  }));
}

export async function upsertFoodLogEntry(params: {
  id?: string;
  patient_id: string;
  log_date: string;
  meal_type: MealType;
  food_name: string;
  brand?: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size?: number | null;
  serving_unit?: string | null;
  source?: string | null;
  notes?: string | null;
}): Promise<string | null> {
  const payload = {
    patient_id: params.patient_id,
    log_date: params.log_date,
    meal_type: params.meal_type,
    meal_slot: params.meal_type,
    entry_type: 'actual',
    food_name: params.food_name,
    brand: params.brand ?? null,
    calories: params.calories,
    protein_g: params.protein_g,
    carbs_g: params.carbs_g,
    fat_g: params.fat_g,
    serving_size: params.serving_size ?? null,
    serving_unit: params.serving_unit ?? null,
    source: params.source ?? null,
    notes: params.notes ?? null,
  };
  if (params.id) {
    const { error } = await supabase.from('food_log_entries').update(payload).eq('id', params.id);
    return error?.message ?? null;
  }
  const { error } = await supabase.from('food_log_entries').insert(payload);
  return error?.message ?? null;
}

export async function deleteFoodLogEntry(id: string): Promise<string | null> {
  const { error } = await supabase.from('food_log_entries').delete().eq('id', id);
  return error?.message ?? null;
}

export async function fetchRecentFoods(patientId: string): Promise<FoodLogRow[]> {
  const { data } = await supabase
    .from('food_log_entries')
    .select('id, food_name, brand, calories, protein_g, carbs_g, fat_g, meal_type, meal_slot, serving_size, serving_unit, source, created_at')
    .eq('patient_id', patientId)
    .eq('entry_type', 'actual')
    .order('created_at', { ascending: false })
    .limit(80);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    food_name: String(r.food_name ?? ''),
    brand: r.brand ? String(r.brand) : null,
    calories: Number(r.calories ?? 0),
    protein_g: Number(r.protein_g ?? 0),
    carbs_g: Number(r.carbs_g ?? 0),
    fat_g: Number(r.fat_g ?? 0),
    meal_type: ((r.meal_type ?? r.meal_slot ?? 'snack') as MealType),
    serving_size: r.serving_size != null ? Number(r.serving_size) : null,
    serving_unit: r.serving_unit != null ? String(r.serving_unit) : null,
    source: r.source != null ? String(r.source) : null,
    created_at: String(r.created_at ?? ''),
  }));
}

export async function fetchFrequentFoods(patientId: string): Promise<Array<{ food_name: string; count: number }>> {
  const recent = await fetchRecentFoods(patientId);
  const m = new Map<string, number>();
  for (const r of recent) {
    const k = r.food_name.trim().toLowerCase();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([food_name, count]) => ({ food_name, count }));
}

export async function fetchWaterOzForDate(patientId: string, logDate: string): Promise<number> {
  const { data } = await supabase
    .from('water_logs')
    .select('amount_oz')
    .eq('patient_id', patientId)
    .eq('log_date', logDate);
  return (data ?? []).reduce((s, r) => s + Number(r.amount_oz ?? 0), 0);
}

export async function addWaterLog(patientId: string, logDate: string, amountOz: number): Promise<string | null> {
  const { error } = await supabase.from('water_logs').insert({
    patient_id: patientId,
    log_date: logDate,
    amount_oz: amountOz,
    logged_at: new Date().toISOString(),
  });
  return error?.message ?? null;
}

export async function fetchMealTemplates(patientId: string): Promise<
  Array<{
    id: string;
    name: string;
    foods_json: Array<Record<string, unknown>>;
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
  }>
> {
  const { data } = await supabase
    .from('patient_meal_templates')
    .select('id, name, foods_json, total_calories, total_protein, total_carbs, total_fat')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? 'Template'),
    foods_json: Array.isArray(r.foods_json) ? (r.foods_json as Array<Record<string, unknown>>) : [],
    total_calories: Number(r.total_calories ?? 0),
    total_protein: Number(r.total_protein ?? 0),
    total_carbs: Number(r.total_carbs ?? 0),
    total_fat: Number(r.total_fat ?? 0),
  }));
}

export async function saveMealTemplate(params: {
  patient_id: string;
  name: string;
  foods_json: Array<Record<string, unknown>>;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}): Promise<string | null> {
  const { error } = await supabase.from('patient_meal_templates').insert({
    patient_id: params.patient_id,
    name: params.name,
    foods_json: params.foods_json,
    total_calories: params.total_calories,
    total_protein: params.total_protein,
    total_carbs: params.total_carbs,
    total_fat: params.total_fat,
    updated_at: new Date().toISOString(),
  });
  return error?.message ?? null;
}
