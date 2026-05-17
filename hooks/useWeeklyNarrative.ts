import { useCallback, useEffect, useState } from 'react';

import { anthropicMessages } from '@/lib/anthropic';
import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  COACHING_FREQUENCY_LABELS,
  daysUntilTargetDate,
  fetchPatientGoals,
  type PrimaryGoalId,
} from '@/lib/patientGoals';
import { fetchAdherenceSummary, fetchPatientSupplements } from '@/lib/patientSupplements';
import { fetchPatientNutritionTargets, mergeNutritionOverrides } from '@/lib/patientNutritionTargets';
import { fetchPatientMetabolicRow } from '@/lib/patientMetabolicProfile';
import { computeSevenDayMacroAdherence } from '@/lib/nutritionAdherence';
import { computeMacroPlan, pickGoalWeightLb, pickReferenceWeightLb } from '@/lib/nutritionMacroTargets';
import { fetchLast7DayMacros } from '@/lib/nutritionSummary';
import { fetchPatientTrainingPrefs } from '@/lib/patientTrainingPrefs';
import { fetchPatientWeightsForMacros } from '@/lib/nutritionCoachContext';
import { supabase } from '@/lib/supabase';
import { toPounds, type WeightLogRow } from '@/lib/weightLogs';
import { rollingMeanWeightLbs } from '@/lib/weightRollingAverage';

function weekEndingSunday(date = new Date()): string {
  const d = new Date(date);
  const add = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useWeeklyNarrative() {
  const { user } = useAuth();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const patientId = await fetchPatientIdForAuthUser(user.id);
      if (!patientId) return;
      const weekEnding = weekEndingSunday();

      const { data: existing } = await supabase
        .from('weekly_narratives')
        .select('narrative_text')
        .eq('patient_id', patientId)
        .eq('week_ending', weekEnding)
        .maybeSingle();
      if (existing?.narrative_text) {
        setText(existing.narrative_text);
        return;
      }

      const weekStart = new Date(weekEnding);
      weekStart.setDate(weekStart.getDate() - 6);
      const weekStartIso = weekStart.toISOString().slice(0, 10);

      const [
        { data: wlogs },
        { data: scores },
        { data: checklist },
        { data: foods },
        { data: trainings },
        goals,
        prefs,
        macroTargets,
        weights,
        dayMacros,
        metabolic,
        { data: profRow },
      ] = await Promise.all([
        supabase
          .from('weight_logs')
          .select('weight_value, unit, log_date, logged_at')
          .eq('patient_id', patientId)
          .gte('log_date', addDaysIso(weekStartIso, -14))
          .lte('log_date', weekEnding)
          .order('log_date', { ascending: true }),
        supabase
          .from('vitality_scores')
          .select('weight_lbs')
          .eq('patient_id', patientId)
          .gte('score_date', weekStartIso)
          .lte('score_date', weekEnding)
          .order('score_date', { ascending: true }),
        supabase
          .from('daily_checklist_items')
          .select('completed')
          .eq('patient_id', patientId)
          .gte('checklist_date', weekStartIso)
          .lte('checklist_date', weekEnding),
        supabase
          .from('food_log_entries')
          .select('log_date, protein_g')
          .eq('patient_id', patientId)
          .eq('entry_type', 'actual')
          .gte('log_date', weekStartIso)
          .lte('log_date', weekEnding),
        supabase
          .from('training_logs')
          .select('id')
          .eq('patient_id', patientId)
          .gte('workout_date', weekStartIso)
          .lte('workout_date', weekEnding),
        fetchPatientGoals(patientId),
        fetchPatientTrainingPrefs(patientId),
        fetchPatientNutritionTargets(patientId),
        fetchPatientWeightsForMacros(patientId),
        fetchLast7DayMacros(patientId),
        fetchPatientMetabolicRow(patientId),
        supabase.from('user_profiles').select('role, consumer_tier').eq('auth_user_id', user.id).maybeSingle(),
      ]);

      const wl = (wlogs ?? []) as {
        weight_value: number;
        unit: string;
        log_date: string;
        logged_at: string;
      }[];
      const weightRows: WeightLogRow[] = wl.map((r, i) => ({
        id: `w-${i}`,
        patient_id: patientId,
        weight_value: Number(r.weight_value),
        unit: r.unit === 'kg' ? 'kg' : 'lb',
        logged_at: r.logged_at ?? `${r.log_date}T12:00:00.000Z`,
        log_date: r.log_date,
      }));
      const rollEnd = rollingMeanWeightLbs(weightRows, 7, new Date(`${weekEnding}T12:00:00`));
      const rollStart = rollingMeanWeightLbs(weightRows, 7, new Date(`${weekStartIso}T12:00:00`));
      const weightChangeRolling =
        rollEnd != null && rollStart != null ? rollEnd - rollStart : null;

      let weightChange: number | null = weightChangeRolling;
      if (weightChange == null && wl.length >= 2) {
        const first = toPounds(Number(wl[0]!.weight_value), wl[0]!.unit === 'kg' ? 'kg' : 'lb');
        const last = toPounds(
          Number(wl[wl.length - 1]!.weight_value),
          wl[wl.length - 1]!.unit === 'kg' ? 'kg' : 'lb',
        );
        weightChange = last - first;
      } else if (weightChange == null) {
        const weightsVit = (scores ?? []).map((s) => Number(s.weight_lbs)).filter((n) => Number.isFinite(n));
        weightChange =
          weightsVit.length >= 2 ? weightsVit[weightsVit.length - 1]! - weightsVit[0]! : null;
      }

      const checklistTotal = (checklist ?? []).length;
      const checklistDone = (checklist ?? []).filter((c) => c.completed === true).length;
      const checklistRate = checklistTotal ? checklistDone / checklistTotal : 0;

      const primary = (goals?.primary_goal as PrimaryGoalId | undefined) ?? 'unsure';
      const refLb = pickReferenceWeightLb({
        goalWeightFromGoals: goals?.target_weight != null ? Number(goals.target_weight) : null,
        patientGoalWeightLbs: weights.patientGoalWeightLbs,
        latestLoggedWeightLbs: weights.latestLoggedWeightLbs,
      });
      const goalLb = pickGoalWeightLb({
        goalWeightFromGoals: goals?.target_weight != null ? Number(goals.target_weight) : null,
        patientGoalWeightLbs: weights.patientGoalWeightLbs,
        referenceBodyLb: refLb,
      });
      const bodyLb = weights.latestLoggedWeightLbs ?? goalLb ?? refLb;
      const prof = profRow as { role?: string; consumer_tier?: string } | null;
      const isGlp1Program =
        primary === 'glp1_journey' ||
        prof?.role === 'clinic_patient' ||
        (prof?.role === 'consumer' && prof?.consumer_tier === 'glp1_plus');
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
        daysUntilStageShow:
          primary === 'stage_ready' ? daysUntilTargetDate(goals?.target_date ?? null) : null,
      });
      const { effective } = mergeNutritionOverrides(
        {
          calories: computed.calories,
          protein: computed.protein_g,
          carbs: computed.carbs_g,
          fat: computed.fat_g,
        },
        macroTargets,
      );
      const macroAdherence = await computeSevenDayMacroAdherence(patientId, {
        protein: effective.protein,
        carbs: effective.carbs,
        fat: effective.fat,
        calories: effective.calories,
      });
      const pTarget = Math.max(1, effective.protein);
      const byDayProtein = new Map<string, number>();
      for (const f of foods ?? []) {
        const k = String((f as { log_date: string }).log_date);
        byDayProtein.set(k, (byDayProtein.get(k) ?? 0) + Number((f as { protein_g: number | null }).protein_g ?? 0));
      }
      let proteinDaysHit = 0;
      for (const d of dayMacros) {
        const p = byDayProtein.get(d.date) ?? d.protein;
        if (p >= pTarget * 0.88) proteinDaysHit += 1;
      }

      const proteinTotal = (foods ?? []).reduce((sum, f) => sum + Number(f.protein_g ?? 0), 0);
      const proteinAdherence = Math.min(1, proteinTotal / (pTarget * 7));

      const trainingSessionsCompleted = (trainings ?? []).length;
      const trainingSessionsGoal = prefs?.training_days_per_week ?? 4;

      const supRows = await fetchPatientSupplements(patientId);
      const activeIds = supRows.filter((r) => r.is_active).map((r) => r.id);
      let supplementConsistencyScore: number | null = null;
      if (activeIds.length) {
        const adh = await fetchAdherenceSummary(patientId, activeIds, 7);
        const ratios = activeIds.map((id) => {
          const x = adh[id];
          if (!x || x.loggedDays <= 0) return null;
          return x.takenDays / x.loggedDays;
        });
        const ok = ratios.filter((x): x is number => x != null);
        supplementConsistencyScore = ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
      }

      const cadence =
        goals?.coaching_frequency != null
          ? COACHING_FREQUENCY_LABELS[goals.coaching_frequency] ?? goals.coaching_frequency
          : 'unknown';

      const fallback1 =
        weightChange != null && weightChange < 0
          ? `You created a real win this week: your trend moved ${Math.abs(weightChange).toFixed(1)} lbs in the right direction while staying engaged.`
          : `You showed up this week and kept momentum alive, which matters more than perfection.`;
      const fallback2 = `Checklist completion ${(checklistRate * 100).toFixed(0)}%. Protein goal hit ${proteinDaysHit} of 7 days. Training: ${trainingSessionsCompleted} sessions vs ~${trainingSessionsGoal}/wk goal.`;
      const fallback3 =
        trainingSessionsCompleted < trainingSessionsGoal - 1
          ? 'Next week: add one more quality session if recovery allows, and keep protein steady on training days.'
          : 'Next week: keep the same rhythm and tighten one weak spot so your baseline keeps climbing.';
      const fallback = `${fallback1}\n\n${fallback2}\n\n${fallback3}`;

      const { data: onboard } = await supabase
        .from('patient_onboarding_context')
        .select('past_struggle, success_definition')
        .eq('patient_id', patientId)
        .maybeSingle();

      const prompt = `Write My Coach's weekly summary for a fitness-aware member (3 short paragraphs max).
This is the Monday-style weekly review: internally reason through the checklist in order, but write naturally for the member (do not paste the checklist as bullets).
Decision order (use only what the data supports):
1) Did they hit macros? Full macro adherence (±10% protein/carbs/fat/calories same day) last 7d ≈ ${(macroAdherence.score * 100).toFixed(0)}% (${macroAdherence.daysHit}/7 days). If <85%, prioritize consistency coaching — do NOT suggest lowering calories.
2) Is weight moving at a sensible rate? Prefer 7-day rolling average change across this week ≈ ${weightChangeRolling != null ? `${weightChangeRolling > 0 ? '+' : ''}${weightChangeRolling.toFixed(2)} lb` : 'unknown'} (not single weigh-ins). Raw week-first-vs-last change (if shown separately) can be noisy.
3) Strength / training: sessions completed vs goal.
4) Hunger / energy: infer cautiously from checklist and protein pattern—no medical claims.

Rules:
- Paragraph 1: one specific win (weight trend, training frequency, or protein consistency).
- Paragraph 2: concrete pattern from the numbers below (no diagnosis).
- Paragraph 3: exactly ONE primary actionable recommendation for the next 7 days (no stacked calorie + training + supplement overhaul in the same week).
- Match coaching tone to their preference: "${cadence}" (e.g. daily check-in style vs weekly summary vs light touch).
- If primary goal is stage-ready or phase is stage prep, tighten accountability slightly but stay educational—no medical directives.
- No fluff, no medical claims.

Data (week ending ${weekEnding}):
- Weight change (lbs, prefer rolling-7d mean shift across week): ${weightChange ?? 'unknown'}
- Macro adherence score (±10% all macros / 7d): ${(macroAdherence.score * 100).toFixed(0)}%
- Protein goal days hit (of 7): ${proteinDaysHit}
- Protein rolling adherence vs target: ${(proteinAdherence * 100).toFixed(0)}%
- Training sessions completed: ${trainingSessionsCompleted} vs goal ${trainingSessionsGoal}/week
- Supplement consistency score (0-1, null if none): ${supplementConsistencyScore?.toFixed(2) ?? 'n/a'}
- Checklist completion rate: ${(checklistRate * 100).toFixed(0)}%
- Training phase (if any): ${goals?.training_phase ?? 'not set'}
- Prior struggle: ${onboard?.past_struggle ?? 'unknown'}
- Success definition: ${onboard?.success_definition ?? 'unknown'}`;

      const ai = await anthropicMessages({
        system:
          'You are SonaLife My Coach: high-accountability, warm, concise weekly summaries for training and nutrition habits. Obey adherence and calorie-adjustment guardrails in the user prompt. Never prescribe multiple simultaneous major changes.',
        user: prompt,
        maxTokens: 320,
      });
      const narrative = ai.text?.trim() || fallback;
      const paragraphs = narrative.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      const actionable_recommendation = paragraphs[paragraphs.length - 1] ?? null;

      await supabase.from('weekly_narratives').upsert(
        {
          patient_id: patientId,
          week_ending: weekEnding,
          narrative_text: narrative,
          weight_change_lbs: weightChange,
          protein_adherence_rate: proteinAdherence,
          checklist_completion_rate: checklistRate,
          supplement_consistency_score: supplementConsistencyScore,
          protein_goal_days_hit: proteinDaysHit,
          training_sessions_completed: trainingSessionsCompleted,
          training_sessions_goal: trainingSessionsGoal,
          actionable_recommendation,
        },
        { onConflict: 'patient_id,week_ending' },
      );
      setText(narrative);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { text, loading, refresh };
}
