/**
 * Meal copy / repeat intent detection and execution for Sona.
 * Intercepts messages before Claude API to handle them at Supabase speed.
 */
import { supabase } from '@/lib/supabase';
import type { MealType } from '@/lib/nutritionLogData';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';

// ── Day name resolution ────────────────────────────────────────────────────────
const DAY_NAMES: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function dateForDayName(name: string): string {
  const today = new Date();
  const target = DAY_NAMES[name.toLowerCase()];
  if (target == null) return '';
  const current = today.getDay();
  let daysBack = current - target;
  if (daysBack <= 0) daysBack += 7;           // go back to last occurrence
  const d = new Date(today);
  d.setDate(today.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── Intent detection ───────────────────────────────────────────────────────────
export type MealCopyIntent =
  | { kind: 'copy_day';  sourceDate: string }
  | { kind: 'copy_meal'; sourceDate: string; mealType: MealType }
  | { kind: 'apply_template'; templateName: string }
  | null;

const MEAL_TYPE_KEYWORDS: Record<string, MealType> = {
  breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner',
  snack: 'snack', snacks: 'snack',
  'pre-workout': 'pre_workout', preworkout: 'pre_workout', 'pre workout': 'pre_workout',
  'post-workout': 'post_workout', postworkout: 'post_workout', 'post workout': 'post_workout',
};

function extractMealType(text: string): MealType | null {
  const lower = text.toLowerCase();
  for (const [kw, mt] of Object.entries(MEAL_TYPE_KEYWORDS)) {
    if (lower.includes(kw)) return mt;
  }
  return null;
}

// Required trigger words — message must contain at least one before any pattern matching.
// This prevents plain food names ("egg", "frosted flakes") from accidentally matching.
const COPY_TRIGGER_WORDS = [
  'repeat', 'copy', 'same as', 'same meal', 'yesterday', 'template',
  'days ago', 'my usual', 'my typical', 'my regular', 'repeat my', 'use my',
];

export function detectMealCopyIntent(text: string): MealCopyIntent {
  const lower = text.toLowerCase().trim();

  // Hard gate — must contain an explicit copy/repeat trigger word
  if (!COPY_TRIGGER_WORDS.some(w => lower.includes(w))) return null;

  // Template application: "use my high protein day template" / "apply [name] template"
  const templateMatch = lower.match(/(?:use|apply|load)\s+(?:my\s+)?(.+?)\s+template/i);
  if (templateMatch) {
    return { kind: 'apply_template', templateName: templateMatch[1].trim() };
  }

  // Copy whole day
  const copyDayPhrases = [
    'repeat yesterday', 'copy yesterday', "yesterday's meals", "yesterday's food",
    'same as yesterday', 'same meals as yesterday', "add yesterday's",
    'copy last', 'repeat last', 'same as last',
  ];
  if (copyDayPhrases.some(p => lower.includes(p))) {
    return { kind: 'copy_day', sourceDate: yesterdayStr() };
  }

  // Day name: "repeat my monday meals" / "copy my tuesday food"
  for (const [dayName] of Object.entries(DAY_NAMES)) {
    if (lower.includes(dayName)) {
      const date = dateForDayName(dayName);
      if (!date) continue;
      const hasActionWord = ['repeat', 'copy', 'same', 'meal', 'food', 'eat'].some(w => lower.includes(w));
      if (!hasActionWord) continue;
      const mealType = extractMealType(lower);
      if (mealType) return { kind: 'copy_meal', sourceDate: date, mealType };
      return { kind: 'copy_day', sourceDate: date };
    }
  }

  // "X days ago"
  const daysAgoMatch = lower.match(/(\d+)\s+days?\s+ago/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1], 10);
    if (!isNaN(n) && n > 0 && n <= 30) {
      const mealType = extractMealType(lower);
      const date = daysAgoStr(n);
      if (mealType) return { kind: 'copy_meal', sourceDate: date, mealType };
      return { kind: 'copy_day', sourceDate: date };
    }
  }

  // Specific meal copy: "my usual breakfast" / "repeat my post-workout"
  const usualPhrases = ['my usual', 'my typical', 'my regular', 'repeat my'];
  const hasMealKeyword = usualPhrases.some(p => lower.includes(p));
  if (hasMealKeyword) {
    const mealType = extractMealType(lower);
    if (mealType) {
      return { kind: 'copy_meal', sourceDate: yesterdayStr(), mealType };
    }
  }

  return null;
}

// ── Execution ─────────────────────────────────────────────────────────────────
interface FoodLogEntry {
  meal_type: MealType;
  food_name: string;
  brand: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  serving_size: number | null;
  serving_unit: string | null;
  source: string | null;
}

async function fetchLogsForDate(patientId: string, date: string, mealType?: MealType): Promise<FoodLogEntry[]> {
  let q = supabase
    .from('food_logs')
    .select('meal_type,food_name,brand,calories,protein_g,carbs_g,fat_g,serving_size,serving_unit,source')
    .eq('patient_id', patientId)
    .eq('log_date', date);
  if (mealType) q = q.eq('meal_type', mealType);
  const { data } = await q;
  return (data ?? []) as FoodLogEntry[];
}

async function insertLogsForToday(patientId: string, entries: FoodLogEntry[]): Promise<void> {
  if (!entries.length) return;
  const today = todayStr();
  await supabase.from('food_logs').insert(
    entries.map(e => ({
      patient_id:   patientId,
      log_date:     today,
      meal_type:    e.meal_type,
      food_name:    e.food_name,
      brand:        e.brand,
      calories:     e.calories,
      protein_g:    e.protein_g,
      carbs_g:      e.carbs_g,
      fat_g:        e.fat_g,
      serving_size: e.serving_size,
      serving_unit: e.serving_unit,
      source:       'sona_copy',
    })),
  );
}

function summarise(entries: FoodLogEntry[]): string {
  const cal  = Math.round(entries.reduce((s, e) => s + (e.calories ?? 0), 0));
  const pro  = Math.round(entries.reduce((s, e) => s + (e.protein_g ?? 0), 0));
  const names = [...new Set(entries.map(e => e.food_name))].slice(0, 3).join(', ');
  return `${cal} cal · ${pro}g protein${names ? ` (${names}${entries.length > 3 ? '…' : ''})` : ''}`;
}

function formatDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const today = new Date(); today.setHours(12,0,0,0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 1) return 'yesterday';
  if (diff === 0) return 'today';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function mealLabel(mt: MealType): string {
  const MAP: Record<MealType, string> = {
    breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner',
    snack: 'snacks', pre_workout: 'pre-workout', post_workout: 'post-workout',
  };
  return MAP[mt] ?? mt;
}

export async function executeMealCopyIntent(opts: {
  intent: MealCopyIntent;
  patientId: string;
  userId: string;
}): Promise<string | null> {
  const { intent, patientId } = opts;
  if (!intent) return null;

  if (intent.kind === 'copy_day') {
    const entries = await fetchLogsForDate(patientId, intent.sourceDate);
    if (!entries.length) {
      return `I couldn't find any meals logged for ${formatDate(intent.sourceDate)}. Try logging some meals first!`;
    }
    await insertLogsForToday(patientId, entries);
    return `Done! I've copied your ${formatDate(intent.sourceDate)} meals to today.\n\n${summarise(entries)}\n\nWant me to make any adjustments?`;
  }

  if (intent.kind === 'copy_meal') {
    // Try the source date first, fall back through last 7 days
    let entries: FoodLogEntry[] = [];
    let usedDate = intent.sourceDate;
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${intent.sourceDate}T12:00:00`);
      d.setDate(d.getDate() - i);
      const candidate = d.toISOString().slice(0, 10);
      entries = await fetchLogsForDate(patientId, candidate, intent.mealType);
      if (entries.length) { usedDate = candidate; break; }
    }
    if (!entries.length) {
      return `I couldn't find any ${mealLabel(intent.mealType)} entries from ${formatDate(intent.sourceDate)} or the past week. Try logging one first!`;
    }
    await insertLogsForToday(patientId, entries);
    return `Done! I've added your ${mealLabel(intent.mealType)} from ${formatDate(usedDate)} to today.\n\n${summarise(entries)}\n\nWant to adjust anything?`;
  }

  if (intent.kind === 'apply_template') {
    const { data } = await supabase
      .from('meal_templates')
      .select('*')
      .eq('patient_id', patientId)
      .ilike('template_name', `%${intent.templateName}%`)
      .limit(1)
      .single();

    if (!data) {
      const { data: all } = await supabase
        .from('meal_templates').select('template_name').eq('patient_id', patientId).limit(5);
      const names = (all ?? []).map((t: { template_name: string }) => t.template_name).join(', ');
      return `I couldn't find a template called "${intent.templateName}".${names ? ` Your saved templates are: ${names}.` : ' You haven\'t saved any templates yet.'}`;
    }

    const meals = (data.meals ?? []) as FoodLogEntry[];
    await insertLogsForToday(patientId, meals.map(m => ({ ...m, brand: null, source: 'template' })));
    return `Done! I've loaded your "${data.template_name}" template into today.\n\n${summarise(meals)}\n\nWant me to make any changes?`;
  }

  return null;
}
