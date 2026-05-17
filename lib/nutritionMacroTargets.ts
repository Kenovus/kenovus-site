import type { PrimaryGoalId } from '@/lib/patientGoals';

export type ActivityLevelId =
  | 'sedentary'
  | 'lightly_active'
  | 'active'
  | 'very_active'
  | 'extremely_active';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevelId, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevelId, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly active',
  active: 'Active (train 3–4×/week)',
  very_active: 'Very active (hard training 5–6×/week)',
  extremely_active: 'Extremely active (2× daily / physical job)',
};

export const ACTIVITY_LEVEL_ORDER: ActivityLevelId[] = [
  'sedentary',
  'lightly_active',
  'active',
  'very_active',
  'extremely_active',
];

export type BiologicalSexForBmr = 'male' | 'female';

export type MacroTargets = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  planKind: 'tdee_clinical' | 'legacy_fallback';
  bmr_kcal?: number;
  tdee_maintenance_kcal?: number;
  calorie_target_kcal?: number;
  protein_pct_cal: number;
  fat_pct_cal: number;
  carbs_pct_cal: number;
  used_metabolic_tdee: boolean;
  /** Raised intake to sex-based hard calorie floor. */
  calorie_floor_bumped?: boolean;
  /** Intake is at/above hard floor but still below clinician soft-review threshold. */
  calorie_soft_flag?: boolean;
};

export type MetabolicForPlan = {
  heightInches: number | null;
  dateOfBirth: string | null;
  ageYearsSnapshot: number | null;
  biologicalSex: BiologicalSexForBmr | null;
  legacySex: string | null;
  activityLevel: ActivityLevelId | null;
};

export type MacroPlanInput = {
  primaryGoal: PrimaryGoalId | null | undefined;
  bodyWeightLb: number;
  goalWeightLb: number;
  metabolic: MetabolicForPlan | null | undefined;
  /** GLP-1 program member (clinic GLP-1 or GLP-1+ consumer) — drives 1.0–1.2 g/lb protein tier. */
  isGlp1Program: boolean;
  daysUntilStageShow: number | null;
};

export function ageFromDateOfBirth(dobIso: string | null | undefined): number | null {
  if (!dobIso) return null;
  const d = new Date(`${dobIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 10 && age <= 120 ? age : null;
}

function resolveAgeYears(m: MetabolicForPlan | null | undefined): number | null {
  if (!m) return null;
  if (m.ageYearsSnapshot != null && Number.isFinite(m.ageYearsSnapshot)) {
    const a = Math.round(m.ageYearsSnapshot);
    if (a >= 14 && a <= 120) return a;
  }
  return ageFromDateOfBirth(m.dateOfBirth);
}

export function resolveSexForNutritionFloors(m: MetabolicForPlan | null | undefined): 'male' | 'female' | 'average' {
  if (!m) return 'average';
  if (m.biologicalSex === 'male' || m.biologicalSex === 'female') return m.biologicalSex;
  const s = (m.legacySex ?? '').toLowerCase();
  if (s === 'male') return 'male';
  if (s === 'female') return 'female';
  return 'average';
}

function resolveSexForBmr(m: MetabolicForPlan | null | undefined): 'male' | 'female' | 'average' {
  return resolveSexForNutritionFloors(m);
}

/** Evidence-based calorie floors / soft-flag thresholds (kcal/day). */
export function calorieGuardrailsForSex(sex: 'male' | 'female' | 'average'): { hardMin: number; softFlagBelow: number } {
  if (sex === 'male') return { hardMin: 1600, softFlagBelow: 1800 };
  if (sex === 'female') return { hardMin: 1200, softFlagBelow: 1400 };
  return { hardMin: 1400, softFlagBelow: 1600 };
}

export function computeBmrMifflinStJeor(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female' | 'average'): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return (base + 5 + (base - 161)) / 2;
}

function metabolicInputsComplete(m: MetabolicForPlan | null | undefined): boolean {
  if (!m) return false;
  if (m.heightInches == null || !Number.isFinite(m.heightInches) || m.heightInches <= 36) return false;
  if (!m.activityLevel) return false;
  if (resolveAgeYears(m) == null) return false;
  return true;
}

function legacyMacroTargetsFromBodyweight(
  primaryGoal: PrimaryGoalId | null | undefined,
  bodyWeightLb: number,
  goalWeightLb: number,
  metabolic: MetabolicForPlan | null | undefined,
): Pick<
  MacroTargets,
  | 'calories'
  | 'protein_g'
  | 'carbs_g'
  | 'fat_g'
  | 'planKind'
  | 'protein_pct_cal'
  | 'fat_pct_cal'
  | 'carbs_pct_cal'
  | 'calorie_floor_bumped'
  | 'calorie_soft_flag'
> {
  const body = Math.max(90, Math.min(400, bodyWeightLb));
  const goalW = Math.max(90, Math.min(400, goalWeightLb));
  let protein_g: number;
  let carbs_g: number;
  let fat_g: number;

  if (primaryGoal === 'stage_ready' || primaryGoal === 'build_muscle_recomp') {
    protein_g = Math.round(1.2 * body);
    carbs_g = Math.round(2 * body);
    fat_g = Math.round(0.4 * body);
  } else if (primaryGoal === 'lose_body_fat' || primaryGoal === 'glp1_journey') {
    const w = goalW;
    protein_g = Math.round(1 * w);
    carbs_g = Math.round(0.75 * w);
    fat_g = Math.round(0.35 * w);
  } else {
    protein_g = Math.round(0.8 * body);
    carbs_g = Math.round(1.8 * body);
    fat_g = Math.round(0.45 * body);
  }
  const planKind: MacroTargets['planKind'] = 'legacy_fallback';
  let calories = Math.round(4 * protein_g + 4 * carbs_g + 9 * fat_g);
  const sex = resolveSexForNutritionFloors(metabolic ?? null);
  const { hardMin, softFlagBelow } = calorieGuardrailsForSex(sex);
  let calorie_floor_bumped = false;
  if (calories < hardMin) {
    calorie_floor_bumped = true;
    calories = hardMin;
    carbs_g = Math.max(20, Math.round((calories - (4 * protein_g + 9 * fat_g)) / 4));
  }
  const calorie_soft_flag = calories < softFlagBelow;
  const protein_pct_cal = (4 * protein_g) / Math.max(1, calories);
  const fat_pct_cal = (9 * fat_g) / Math.max(1, calories);
  const carbs_pct_cal = (4 * carbs_g) / Math.max(1, calories);
  return {
    calories,
    protein_g,
    carbs_g,
    fat_g,
    planKind,
    protein_pct_cal,
    fat_pct_cal,
    carbs_pct_cal,
    calorie_floor_bumped,
    calorie_soft_flag,
  };
}

function stageDeficitKcal(daysUntilShow: number | null): number {
  if (daysUntilShow == null || !Number.isFinite(daysUntilShow)) return 300;
  if (daysUntilShow > 42) return 300;
  if (daysUntilShow > 21) return 350;
  if (daysUntilShow > 7) return 400;
  return 450;
}

function goalCalorieDelta(primary: PrimaryGoalId | null | undefined, daysUntilStage: number | null): number {
  if (primary === 'lose_body_fat' || primary === 'glp1_journey') return -350;
  if (primary === 'build_muscle_recomp') return 250;
  if (primary === 'stage_ready') return -stageDeficitKcal(daysUntilStage);
  return 0;
}

function proteinGPerGoal(
  primary: PrimaryGoalId | null | undefined,
  bodyLb: number,
  goalLb: number,
  isGlp1Program: boolean,
): number {
  const b = Math.max(90, Math.min(420, bodyLb));
  const g = Math.max(90, Math.min(420, goalLb));
  if (isGlp1Program || primary === 'glp1_journey') {
    return Math.round(1.1 * g);
  }
  if (primary === 'stage_ready' || primary === 'build_muscle_recomp') {
    return Math.round(1.35 * b);
  }
  if (primary === 'lose_body_fat') {
    return Math.round(1.0 * g);
  }
  return Math.round(0.9 * g);
}

function fatFloorG(bodyLb: number): number {
  const b = Math.max(90, Math.min(420, bodyLb));
  return Math.round(0.35 * b);
}

function macroPercents(protein_g: number, carbs_g: number, fat_g: number, calories: number): Pick<MacroTargets, 'protein_pct_cal' | 'fat_pct_cal' | 'carbs_pct_cal'> {
  const c = Math.max(1, calories);
  return {
    protein_pct_cal: (4 * protein_g) / c,
    fat_pct_cal: (9 * fat_g) / c,
    carbs_pct_cal: (4 * carbs_g) / c,
  };
}

/**
 * TDEE-first macro prescription (Mifflin–St Jeor + activity), then protein + fat floor + carbs as lever.
 * Falls back to legacy bodyweight formulas if height/activity/age are incomplete.
 */
export function computeMacroPlan(input: MacroPlanInput): MacroTargets {
  const bodyLb = Math.max(90, Math.min(420, input.bodyWeightLb));
  const goalLb = Math.max(90, Math.min(420, input.goalWeightLb));
  const weightKg = bodyLb * 0.45359237;
  const m = input.metabolic;

  if (!metabolicInputsComplete(m)) {
    const leg = legacyMacroTargetsFromBodyweight(input.primaryGoal, bodyLb, goalLb, m);
    return { ...leg, planKind: 'legacy_fallback', used_metabolic_tdee: false };
  }

  const heightCm = Number(m!.heightInches) * 2.54;
  const age = resolveAgeYears(m)!;
  const sex = resolveSexForBmr(m);
  const bmr = computeBmrMifflinStJeor(weightKg, heightCm, age, sex);
  const mult = ACTIVITY_MULTIPLIERS[m!.activityLevel!];
  const tdeeM = bmr * mult;
  const delta = goalCalorieDelta(input.primaryGoal, input.daysUntilStageShow ?? null);
  const { hardMin, softFlagBelow } = calorieGuardrailsForSex(resolveSexForNutritionFloors(m));
  const rawCalorieTarget = Math.round(tdeeM + delta);
  const calorie_floor_bumped = rawCalorieTarget < hardMin;
  let calorieTarget = Math.max(hardMin, Math.min(6000, rawCalorieTarget));

  const protein_g = proteinGPerGoal(input.primaryGoal, bodyLb, goalLb, input.isGlp1Program);
  const fat_g = fatFloorG(bodyLb);

  const fromProteinFatKcal = 4 * protein_g + 9 * fat_g;
  let carbs_g = Math.round((calorieTarget - fromProteinFatKcal) / 4);
  let guard = 0;
  while (carbs_g < 20 && guard < 40) {
    calorieTarget += 25;
    carbs_g = Math.round((calorieTarget - fromProteinFatKcal) / 4);
    guard += 1;
  }
  carbs_g = Math.max(20, carbs_g);

  const calorie_soft_flag = calorieTarget < softFlagBelow;

  const pcts = macroPercents(protein_g, carbs_g, fat_g, calorieTarget);
  return {
    calories: calorieTarget,
    protein_g,
    carbs_g,
    fat_g,
    planKind: 'tdee_clinical',
    bmr_kcal: Math.round(bmr),
    tdee_maintenance_kcal: Math.round(tdeeM),
    calorie_target_kcal: calorieTarget,
    ...pcts,
    used_metabolic_tdee: true,
    calorie_floor_bumped,
    calorie_soft_flag,
  };
}

/** @deprecated Prefer `computeMacroPlan` — kept for call sites passing positional args during migration. */
export function computeMacroTargets(
  primaryGoal: PrimaryGoalId | null | undefined,
  bodyWeightLb: number,
  goalWeightLb: number,
  opts?: Partial<Omit<MacroPlanInput, 'primaryGoal' | 'bodyWeightLb' | 'goalWeightLb'>>,
): MacroTargets {
  return computeMacroPlan({
    primaryGoal,
    bodyWeightLb,
    goalWeightLb,
    metabolic: opts?.metabolic,
    isGlp1Program: opts?.isGlp1Program ?? false,
    daysUntilStageShow: opts?.daysUntilStageShow ?? null,
  });
}

export function pickReferenceWeightLb(params: {
  goalWeightFromGoals: number | null;
  patientGoalWeightLbs: number | null;
  latestLoggedWeightLbs: number | null;
  fallbackLb?: number;
}): number {
  const fb = params.fallbackLb ?? 170;
  return (
    (params.goalWeightFromGoals != null && Number.isFinite(params.goalWeightFromGoals)
      ? params.goalWeightFromGoals
      : null) ??
    (params.patientGoalWeightLbs != null && Number.isFinite(params.patientGoalWeightLbs)
      ? params.patientGoalWeightLbs
      : null) ??
    (params.latestLoggedWeightLbs != null && Number.isFinite(params.latestLoggedWeightLbs)
      ? params.latestLoggedWeightLbs
      : null) ??
    fb
  );
}

export function pickGoalWeightLb(params: {
  goalWeightFromGoals: number | null;
  patientGoalWeightLbs: number | null;
  referenceBodyLb: number;
}): number {
  return (
    (params.goalWeightFromGoals != null && Number.isFinite(params.goalWeightFromGoals)
      ? params.goalWeightFromGoals
      : null) ??
    (params.patientGoalWeightLbs != null && Number.isFinite(params.patientGoalWeightLbs)
      ? params.patientGoalWeightLbs
      : null) ??
    params.referenceBodyLb
  );
}

export function formatMacroGramsWithPct(grams: number, pct: number, unit = 'g'): string {
  const p = Math.round(pct * 100);
  return `${Math.round(grams)}${unit} | ${p}%`;
}

/** Display helper: grams plus g/kg and g/lb vs reference bodyweight (lb). */
export function formatProteinMassPerBodyweight(proteinG: number, bodyWeightLb: number): string {
  const lb = Math.max(40, bodyWeightLb);
  const kg = lb * 0.45359237;
  const pkg = proteinG / kg;
  const plb = proteinG / lb;
  return `${Math.round(proteinG)}g protein (${pkg.toFixed(2)} g/kg | ${plb.toFixed(2)} g/lb)`;
}
