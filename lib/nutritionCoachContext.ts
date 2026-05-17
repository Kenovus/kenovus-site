import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { canUseGlp1PatientFeatures } from '@/lib/consumerTier';
import { maybeFlagGlp1IntakeBelowFloor } from '@/lib/glp1NutritionIntakeFlags';
import { computeSevenDayMacroAdherence, sevenDayAverageCalories } from '@/lib/nutritionAdherence';
import {
  calorieGuardrailsForSex,
  computeMacroPlan,
  pickGoalWeightLb,
  pickReferenceWeightLb,
  resolveSexForNutritionFloors,
} from '@/lib/nutritionMacroTargets';
import { mergeNutritionOverrides, fetchPatientNutritionTargets } from '@/lib/patientNutritionTargets';
import { fetchPatientMetabolicRow } from '@/lib/patientMetabolicProfile';
import { fetchPatientGoals, daysUntilTargetDate, type PrimaryGoalId } from '@/lib/patientGoals';
import { localDateKey } from '@/lib/patientSupplements';
import { consecutiveLowProteinDays } from '@/lib/proteinStreak';
import { buildWeeklyNutritionSummary, fetchLast7DayMacros } from '@/lib/nutritionSummary';
import { fetchTrainingLogs } from '@/lib/trainingLogs';
import { muscleFocusesBelowMevThisWeek } from '@/lib/trainingVolumeLandmarks';
import { supabase } from '@/lib/supabase';
import { fetchLatestWeightLbs, fetchWeightLogsForPatient } from '@/lib/weightLogs';
import { latestWeightLbsByDate, rollingMeanWeightLbs } from '@/lib/weightRollingAverage';
import type { UserProfile } from '@/types/user';

export async function fetchPatientWeightsForMacros(patientId: string): Promise<{
  patientGoalWeightLbs: number | null;
  latestLoggedWeightLbs: number | null;
}> {
  const { data: patient } = await supabase
    .from('patients')
    .select('goal_weight_lbs')
    .eq('id', patientId)
    .maybeSingle();
  const fromLogs = await fetchLatestWeightLbs(patientId);
  if (fromLogs != null) {
    return {
      patientGoalWeightLbs: patient?.goal_weight_lbs != null ? Number(patient.goal_weight_lbs) : null,
      latestLoggedWeightLbs: fromLogs,
    };
  }
  const { data: lastW } = await supabase
    .from('vitality_scores')
    .select('weight_lbs')
    .eq('patient_id', patientId)
    .not('weight_lbs', 'is', null)
    .order('score_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    patientGoalWeightLbs: patient?.goal_weight_lbs != null ? Number(patient.goal_weight_lbs) : null,
    latestLoggedWeightLbs: lastW?.weight_lbs != null ? Number(lastW.weight_lbs) : null,
  };
}

/** Factual nutrition block for My Coach (TDEE-based targets + GLP-1 priority stack + trends). */
export async function buildNutritionCoachContextBlock(
  authUserId: string,
  profile: UserProfile | null,
): Promise<string> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return '';

  let prof = profile;
  if (!prof) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    prof = (data as UserProfile | null) ?? null;
  }

  const [goalsRow, weights, nutritionOverrides, metabolic] = await Promise.all([
    fetchPatientGoals(patientId),
    fetchPatientWeightsForMacros(patientId),
    fetchPatientNutritionTargets(patientId),
    fetchPatientMetabolicRow(patientId),
  ]);

  const refLb = pickReferenceWeightLb({
    goalWeightFromGoals: goalsRow?.target_weight != null ? Number(goalsRow.target_weight) : null,
    patientGoalWeightLbs: weights.patientGoalWeightLbs,
    latestLoggedWeightLbs: weights.latestLoggedWeightLbs,
  });
  const goalLb = pickGoalWeightLb({
    goalWeightFromGoals: goalsRow?.target_weight != null ? Number(goalsRow.target_weight) : null,
    patientGoalWeightLbs: weights.patientGoalWeightLbs,
    referenceBodyLb: refLb,
  });
  const bodyLb = weights.latestLoggedWeightLbs ?? goalLb ?? refLb;

  const primary = (goalsRow?.primary_goal as PrimaryGoalId | undefined) ?? undefined;
  const isGlp1Program =
    primary === 'glp1_journey' || canUseGlp1PatientFeatures(prof);
  const daysStage =
    primary === 'stage_ready' ? daysUntilTargetDate(goalsRow?.target_date ?? null) : null;

  const metabolicForPlan =
    metabolic != null
      ? {
          heightInches: metabolic.height_inches,
          dateOfBirth: metabolic.date_of_birth,
          ageYearsSnapshot: metabolic.age,
          biologicalSex: metabolic.biological_sex,
          legacySex: metabolic.sex,
          activityLevel: metabolic.activity_level,
        }
      : null;

  const computed = computeMacroPlan({
    primaryGoal: primary,
    bodyWeightLb: bodyLb,
    goalWeightLb: goalLb,
    metabolic: metabolicForPlan,
    isGlp1Program,
    daysUntilStageShow: daysStage,
  });

  const recommended = {
    calories: computed.calories,
    protein: computed.protein_g,
    carbs: computed.carbs_g,
    fat: computed.fat_g,
  };
  const { effective, custom } = mergeNutritionOverrides(recommended, nutritionOverrides);

  const [days, { rows: weightHist }, logs14, adherence, intake7, proteinStreak] = await Promise.all([
    fetchLast7DayMacros(patientId),
    fetchWeightLogsForPatient(patientId, 60),
    fetchTrainingLogs(patientId, 40),
    computeSevenDayMacroAdherence(patientId, {
      protein: effective.protein,
      carbs: effective.carbs,
      fat: effective.fat,
      calories: effective.calories,
    }),
    sevenDayAverageCalories(patientId),
    consecutiveLowProteinDays(patientId, effective.protein, 0.9),
  ]);

  const summary = buildWeeklyNutritionSummary(days, effective.protein);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const iso = cutoff.toISOString().slice(0, 10);
  const trainingSessions14 = logs14.filter((l) => l.workout_date >= iso).length;

  const best = summary.bestDay ? `best protein day ${summary.bestDay}` : 'no clear best day yet';
  const worst = summary.worstDay ? `lightest protein day ${summary.worstDay}` : 'no contrast day yet';
  const vs = summary.avgProteinVsTargetPct != null ? `${Math.round(summary.avgProteinVsTargetPct)}% of protein target` : 'insufficient logs';
  const customNote =
    custom.protein || custom.carbs || custom.fat || custom.calories
      ? 'Member has customized one or more macro targets from the AI recommendation.'
      : '';

  const tdeeLine =
    computed.used_metabolic_tdee && computed.bmr_kcal != null && computed.tdee_maintenance_kcal != null
      ? `TDEE model: BMR ~${computed.bmr_kcal} kcal (Mifflin–St Jeor), maintenance TDEE ~${computed.tdee_maintenance_kcal} kcal, prescribed intake ~${computed.calorie_target_kcal ?? computed.calories} kcal after goal adjustment.`
      : 'TDEE model: incomplete demographics (height/activity/age)—using legacy bodyweight macro estimate until profile is completed.';

  const sex = resolveSexForNutritionFloors(metabolicForPlan);
  const { hardMin, softFlagBelow } = calorieGuardrailsForSex(sex);
  const floorLine = `Calorie floors: hard minimum for this sex profile ≈ ${hardMin} kcal/day; soft review band if prescribed intake stays below ~${softFlagBelow} kcal. Prescribed plan ${computed.calorie_floor_bumped ? 'was raised to the hard floor (carbs adjusted)' : 'respects hard floor'}. ${computed.calorie_soft_flag ? 'Prescribed intake is still in the soft-flag band—check appetite and escalation to Simi if intake feels unsustainably low.' : ''}`;

  const rollLb = rollingMeanWeightLbs(weightHist, 7);
  const todayLb = latestWeightLbsByDate(weightHist).get(localDateKey(new Date()));
  const wLine = `Bodyweight decisions: use 7-day rolling mean (not a single weigh-in). Same-calendar-day latest ≈ ${todayLb != null ? `${todayLb.toFixed(1)} lb` : 'no log today'}; 7d mean ≈ ${rollLb != null ? `${rollLb.toFixed(1)} lb` : 'insufficient weigh-ins'}.`;

  const adherenceGate =
    adherence.score < 0.85
      ? `Macro adherence (±10% of protein, carbs, fat, calories vs targets, scored over 7 calendar days): ~${Math.round(adherence.score * 100)}% (${adherence.daysHit}/7 days hit). ADHERENCE GATE: below 85% — do NOT recommend lowering calories; coach consistency first with language like: "Let's focus on consistency before we change your targets."`
      : `Macro adherence (±10% all macros, 7d): ~${Math.round(adherence.score * 100)}% (${adherence.daysHit}/7 days hit) — adherence gate OK (≥85%) for discussing small, single-lever calorie adjustments if weight trend + recovery support it.`;

  const adjustmentRules =
    'Weekly adjustment discipline: at most one primary lever per week and never more than ~250 kcal from prior prescription in a single step. Slow loss with good adherence → reduce ~150–250 kcal preferentially from carbs only. Fast loss with performance dropping → add ~100–200 kcal via carbs. Plateau after adherence is fixed → first recommend +2,000–3,000 steps/day OR ~20–30 min low-intensity cardio for ~1 week before any calorie cut.';

  const proteinTiming =
    'Protein timing guidance: 3–5 protein feedings/day; aim ~30–50g protein per feeding when feasible; pre-workout = protein + carbs; post-workout = protein + carbs (priority); pre-sleep protein encouraged for overnight MPS when it fits their digestion.';

  const glpProteinCoach =
    isGlp1Program && proteinStreak >= 2
      ? `GLP-1 active protein coaching: protein goal missed ${proteinStreak}+ consecutive days—appetite is likely suppressed. Proactively suggest liquid protein, protein-first meal sequencing, and smaller, more frequent protein hits. Empathetic template: "Your appetite is suppressed from your GLP-1 — let's find easier ways to hit protein without feeling full."`
      : '';

  const carbCycling =
    prof?.carb_cycling_enabled === true
      ? 'Member enabled optional carb cycling: training days bias higher carbs around workouts; rest days slightly lower carbs / higher fat while keeping weekly calories roughly flat—keep language optional and habit-based.'
      : '';

  const lowVol = muscleFocusesBelowMevThisWeek(logs14);
  const volLine =
    lowVol.length > 0
      ? `Hypertrophy volume: this week’s logged sets for ${lowVol.join(', ')} are under ~MEV (~8 hard sets/week for that focus) despite training—note as a recoverable volume opportunity, not a failure.`
      : '';

  const priorityStack =
    isGlp1Program
      ? 'GLP-1 clinical macro priority: (1) Protein daily — non-negotiable; (2) Resistance training; (3) Fat floor for hormonal health; (4) Carbs are the flexible lever. Never cut protein to chase calories—adjust carbs first after adherence ≥85%.'
      : 'Macro priority: protein first, fat minimum, carbs flexible. Fix logging adherence before calorie cuts.';

  const stageMacro =
    primary === 'stage_ready'
      ? 'Stage-prep: tighter adherence framing only—no medical nutrition therapy; peak-week manipulation deferred to Simi in person.'
      : '';

  const triangle =
    isGlp1Program
      ? `GLP-1 results triangle context: protein pattern above, resistance sessions last 14d ≈ ${trainingSessions14}. If all three (protein + training + medication) appear solid but weight stalls multiple weeks, it is appropriate to suggest discussing GLP-1 dose with Simi at the next visit—never suggest specific dose changes.`
      : '';

  const cal = Math.max(1, effective.calories);
  const pPct = (4 * effective.protein) / cal;
  const fPct = (9 * effective.fat) / cal;
  const cPct = (4 * effective.carbs) / cal;

  const internalKg = Math.max(40, bodyLb) * 0.45359237;
  const gPerKg = effective.protein / internalKg;
  const gPerLb = effective.protein / Math.max(40, bodyLb);
  const unitLine = `Macro math uses g/kg internally (~${gPerKg.toFixed(2)} g/kg protein on current reference weight ≈ ${gPerLb.toFixed(2)} g/lb).`;

  if (isGlp1Program) {
    void maybeFlagGlp1IntakeBelowFloor({
      patientId,
      clinicId: prof?.clinic_id ?? null,
      profile: prof,
      hardCalorieFloorKcal: hardMin,
      avgIntake7d: intake7.avg,
      daysWithLogs: intake7.daysWithLogs,
    });
  }

  return [
    tdeeLine,
    floorLine,
    wLine,
    adherenceGate,
    adjustmentRules,
    proteinTiming,
    unitLine,
    `Prescribed macro targets (coaching): ~${effective.protein}g protein (${Math.round(pPct * 100)}% kcal), ~${effective.fat}g fat (${Math.round(fPct * 100)}% kcal), ~${effective.carbs}g carbs (${Math.round(cPct * 100)}% kcal), ~${effective.calories} kcal/day.`,
    customNote,
    `7-day protein pattern: avg ${Math.round(summary.avgProtein)}g/day vs target, ${vs}; ${best}; ${worst}.`,
    `7-day mean logged intake ≈ ${intake7.avg != null ? `${Math.round(intake7.avg)} kcal/day` : 'n/a'} across days (coarse).`,
    priorityStack,
    triangle,
    stageMacro,
    volLine,
    glpProteinCoach,
    carbCycling,
    'Weekly Monday review (when relevant): ask in order — macro adherence? weight trend vs goal rate? strength stable/up? hunger/energy? — then offer only ONE primary recommendation for the next week (no stacked conflicting changes).',
    'Cravings: ask what specifically they want; offer macro-friendly swaps; no shame; if the same craving repeats, suggest a planned treat meal.',
    'You may reference protein vs targets in plain language—no medical claims.',
  ]
    .filter(Boolean)
    .join(' ');
}
