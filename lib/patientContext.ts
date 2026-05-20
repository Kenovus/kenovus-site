/**
 * PART 1 — Complete patient context builder.
 * Assembles a full clinical briefing string from Supabase for every Sona call.
 * Every AI response knows everything about the patient.
 */
import { supabase } from '@/lib/supabase';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { fetchFoodLogsForDate } from '@/lib/nutritionLogData';
import { localDateKey } from '@/lib/patientSupplements';
import { fetchPatientGoals } from '@/lib/patientGoals';
import { fetchPatientMetabolicRow } from '@/lib/patientMetabolicProfile';
import { fetchTrainingLogs } from '@/lib/trainingLogs';
import { fetchLatestWeightLbs } from '@/lib/weightLogs';
import { fetchPatientNutritionTargets } from '@/lib/patientNutritionTargets';
import { fetchStreakInfo, fetchDailyWins } from '@/lib/dailyWins';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PatientFullContext {
  // Demographics
  fullName: string;
  ageYears: number | null;
  gender: string | null;
  daysSinceSignup: number | null;
  membershipTier: string;
  patientType: 'glp1' | 'non_glp1' | 'unknown';

  // Body composition
  currentWeightLbs: number | null;
  goalWeightLbs: number | null;
  startWeightLbs: number | null;
  bodyFatPct: number | null;
  muscleMassLbs: number | null;

  // Nutrition (today)
  caloriesConsumed: number;
  calorieGoal: number;
  proteinConsumed: number;
  proteinGoal: number;
  carbsConsumed: number;
  carbsGoal: number;
  fatConsumed: number;
  fatGoal: number;

  // GLP-1
  glp1Medication: string | null;
  glp1Dose: string | null;
  glp1InjectionDay: string | null;

  // Supplements
  activeSupplements: string[];

  // Training
  recentWorkouts: string[];

  // Appointments (within 14 days)
  upcomingAppointments: string[];

  // Treatments (within 30 days)
  recentTreatments: string[];

  // Labs
  latestLabs: string[];

  // Goals
  primaryGoal: string | null;
  targetDate: string | null;
}

// ── Fetch from Supabase ───────────────────────────────────────────────────────
export async function buildPatientContext(patientId: string): Promise<PatientFullContext | null> {
  try {
    const today = localDateKey(new Date());

    const [
      patientRow,
      metabolic,
      foodLogs,
      goals,
      nutritionTargets,
      latestWeight,
      trainingLogs,
      supplements,
      inbody,
      appointments,
      treatments,
      labs,
    ] = await Promise.allSettled([
      supabase.from('patients').select('*, profiles(*)').eq('id', patientId).maybeSingle(),
      fetchPatientMetabolicRow(patientId),
      fetchFoodLogsForDate(patientId, today),
      fetchPatientGoals(patientId),
      fetchPatientNutritionTargets(patientId),
      fetchLatestWeightLbs(patientId),
      fetchTrainingLogs(patientId, 3),
      supabase
        .from('patient_supplements')
        .select('supplement_name, morning_dose, evening_dose, is_active')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .limit(10),
      supabase
        .from('inbody_results')
        .select('body_fat_pct, muscle_mass_lbs, test_date')
        .eq('patient_id', patientId)
        .order('test_date', { ascending: false })
        .limit(1),
      supabase
        .from('patient_appointments')
        .select('treatment_name, appointment_date, provider, status')
        .eq('patient_id', patientId)
        .eq('status', 'upcoming')
        .gte('appointment_date', today)
        .lte('appointment_date', addDays(today, 14))
        .order('appointment_date'),
      supabase
        .from('patient_treatments')
        .select('treatment_name, treatment_date, provider, notes')
        .eq('patient_id', patientId)
        .gte('treatment_date', addDays(today, -30))
        .order('treatment_date', { ascending: false }),
      supabase
        .from('patient_labs')
        .select('lab_name, value, units, lab_date')
        .eq('patient_id', patientId)
        .order('lab_date', { ascending: false })
        .limit(15),
    ]);

    // Extract values safely
    const patient = patientRow.status === 'fulfilled' ? patientRow.value.data : null;
    const profile = patient?.profiles as Record<string, unknown> | null;
    const meta = metabolic.status === 'fulfilled' ? metabolic.value : null;
    const food = foodLogs.status === 'fulfilled' ? foodLogs.value : [];
    const goalData = goals.status === 'fulfilled' ? goals.value : null;
    const targets = nutritionTargets.status === 'fulfilled' ? nutritionTargets.value : null;
    const weight = latestWeight.status === 'fulfilled' ? latestWeight.value : null;
    const workouts = trainingLogs.status === 'fulfilled' ? trainingLogs.value : [];
    const supps = supplements.status === 'fulfilled' ? (supplements.value.data ?? []) : [];
    const inbodyRow = inbody.status === 'fulfilled' ? (inbody.value.data?.[0] ?? null) : null;
    const appts = appointments.status === 'fulfilled' ? (appointments.value.data ?? []) : [];
    const treats = treatments.status === 'fulfilled' ? (treatments.value.data ?? []) : [];
    const labRows = labs.status === 'fulfilled' ? (labs.value.data ?? []) : [];

    // Compute nutrition totals for today
    let cal = 0, pro = 0, carb = 0, fat = 0;
    for (const e of food) {
      cal += e.calories ?? 0;
      pro += e.protein_g ?? 0;
      carb += e.carbs_g ?? 0;
      fat += e.fat_g ?? 0;
    }

    // Days on program
    const signupDate = (profile?.created_at ?? patient?.created_at) as string | null;
    const daysSinceSignup = signupDate
      ? Math.floor((Date.now() - new Date(signupDate).getTime()) / 86400000)
      : null;

    // Age
    const dob = meta?.date_of_birth;
    const ageYears = dob
      ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000))
      : null;

    // Patient type
    const tier = (patient?.consumer_tier ?? 'free') as string;
    const isGlp1 = tier === 'glp1_plus' || patient?.role === 'clinic_patient';
    const patientType: 'glp1' | 'non_glp1' | 'unknown' = isGlp1 ? 'glp1' : 'non_glp1';

    // Supplement list
    const activeSupplements = supps.map(
      (s: { supplement_name: string; morning_dose?: string; evening_dose?: string }) =>
        `${s.supplement_name}${s.morning_dose ? ` ${s.morning_dose}` : ''}`,
    );

    // Recent workouts
    const recentWorkouts = workouts.slice(0, 3).map((w) => {
      const date = new Date(w.workout_date ?? w.created_at ?? '').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const exercises = w.exercises ? JSON.stringify(w.exercises).slice(0, 80) : 'workout logged';
      return `${date}: ${exercises}`;
    });

    // Upcoming appointments
    const upcomingAppointments = appts.map(
      (a: { treatment_name: string; appointment_date: string; provider?: string }) =>
        `${a.treatment_name} on ${new Date(a.appointment_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${a.provider ? ` with ${a.provider}` : ''}`,
    );

    // Recent treatments
    const recentTreatments = treats.map(
      (t: { treatment_name: string; treatment_date: string }) => {
        const daysAgo = Math.floor((Date.now() - new Date(t.treatment_date).getTime()) / 86400000);
        return `${t.treatment_name} (${daysAgo} days ago)`;
      },
    );

    // Labs
    const latestLabs = labRows.map(
      (l: { lab_name: string; value: string | number; units?: string }) =>
        `${l.lab_name}: ${l.value}${l.units ? ` ${l.units}` : ''}`,
    );

    // GLP-1 data
    const glp1 = (patient?.glp1_medication_name ?? null) as string | null;
    const glp1Dose = (patient?.glp1_dose ?? null) as string | null;
    const glp1Day = (patient?.glp1_injection_day ?? null) as string | null;

    return {
      fullName: (profile?.full_name ?? patient?.full_name ?? 'Patient') as string,
      ageYears,
      gender: (meta?.biological_sex ?? null) as string | null,
      daysSinceSignup,
      membershipTier: tier,
      patientType,
      currentWeightLbs: weight,
      goalWeightLbs: null,  // not in PatientGoalsRow directly
      startWeightLbs: (patient?.start_weight_lbs ?? null) as number | null,
      bodyFatPct: (inbodyRow?.body_fat_pct ?? null) as number | null,
      muscleMassLbs: (inbodyRow?.muscle_mass_lbs ?? null) as number | null,
      caloriesConsumed: Math.round(cal),
      calorieGoal: targets?.calories_override ?? 2000,
      proteinConsumed: Math.round(pro),
      proteinGoal: targets?.protein_override_g ?? 150,
      carbsConsumed: Math.round(carb),
      carbsGoal: targets?.carbs_override_g ?? 200,
      fatConsumed: Math.round(fat),
      fatGoal: targets?.fat_override_g ?? 70,
      glp1Medication: glp1,
      glp1Dose,
      glp1InjectionDay: glp1Day,
      activeSupplements,
      recentWorkouts,
      upcomingAppointments,
      recentTreatments,
      latestLabs,
      primaryGoal: (goalData?.primary_goal ?? null) as string | null,
      targetDate: (goalData?.target_date ?? null) as string | null,
    };
  } catch (e) {
    console.warn('[patientContext] Failed to build context:', e);
    return null;
  }
}

/** Format context into a clinical briefing string for Sona's system prompt */
export function formatPatientContextBlock(ctx: PatientFullContext): string {
  const lines: string[] = [
    '═══ PATIENT CLINICAL BRIEFING ═══',
    `Patient: ${ctx.fullName}${ctx.ageYears ? `, ${ctx.ageYears}yo` : ''}${ctx.gender ? `, ${ctx.gender}` : ''}`,
    `Program: ${ctx.patientType === 'glp1' ? 'GLP-1 Program' : 'Aesthetic Wellness'} · Tier: ${ctx.membershipTier}${ctx.daysSinceSignup != null ? ` · Day ${ctx.daysSinceSignup} on program` : ''}`,
    '',
    '── BODY COMPOSITION ──',
  ];

  if (ctx.currentWeightLbs) lines.push(`Weight: ${ctx.currentWeightLbs} lbs${ctx.goalWeightLbs ? ` (goal: ${ctx.goalWeightLbs} lbs)` : ''}${ctx.startWeightLbs ? ` (start: ${ctx.startWeightLbs} lbs, lost ${Math.max(0, ctx.startWeightLbs - ctx.currentWeightLbs).toFixed(1)} lbs)` : ''}`);
  if (ctx.bodyFatPct) lines.push(`Body fat: ${ctx.bodyFatPct}%`);
  if (ctx.muscleMassLbs) lines.push(`Muscle mass: ${ctx.muscleMassLbs} lbs`);

  lines.push('', '── TODAY\'S NUTRITION ──');
  lines.push(`Calories: ${ctx.caloriesConsumed} / ${ctx.calorieGoal} kcal (${ctx.calorieGoal - ctx.caloriesConsumed} remaining)`);
  lines.push(`Protein: ${ctx.proteinConsumed}g / ${ctx.proteinGoal}g (${Math.max(0, ctx.proteinGoal - ctx.proteinConsumed)}g to go)`);
  lines.push(`Carbs: ${ctx.carbsConsumed}g / ${ctx.carbsGoal}g · Fat: ${ctx.fatConsumed}g / ${ctx.fatGoal}g`);

  if (ctx.glp1Medication) {
    lines.push('', '── GLP-1 PROGRAM ──');
    lines.push(`Medication: ${ctx.glp1Medication}${ctx.glp1Dose ? ` · Dose: ${ctx.glp1Dose}` : ''}${ctx.glp1InjectionDay ? ` · Injection day: ${ctx.glp1InjectionDay}` : ''}`);
  }

  if (ctx.activeSupplements.length) {
    lines.push('', '── ACTIVE SUPPLEMENTS ──');
    lines.push(ctx.activeSupplements.join(', '));
  }

  if (ctx.recentWorkouts.length) {
    lines.push('', '── RECENT TRAINING (last 3) ──');
    ctx.recentWorkouts.forEach((w) => lines.push(`• ${w}`));
  }

  if (ctx.upcomingAppointments.length) {
    lines.push('', '── UPCOMING APPOINTMENTS (14 days) ──');
    ctx.upcomingAppointments.forEach((a) => lines.push(`• ${a}`));
  }

  if (ctx.recentTreatments.length) {
    lines.push('', '── RECENT TREATMENTS (30 days) ──');
    ctx.recentTreatments.forEach((t) => lines.push(`• ${t}`));
  }

  if (ctx.latestLabs.length) {
    lines.push('', '── LATEST LABS ──');
    ctx.latestLabs.forEach((l) => lines.push(`• ${l}`));
  }

  if (ctx.primaryGoal) {
    lines.push('', `Goal: ${ctx.primaryGoal}${ctx.targetDate ? ` by ${ctx.targetDate}` : ''}`);
  }

  lines.push('═══ END BRIEFING ═══');
  return lines.join('\n');
}

/** Build the full Sona system prompt with patient context injected */
export function buildFullSystemPrompt(basePrompt: string, ctx: PatientFullContext | null): string {
  if (!ctx) return basePrompt;

  const isGlp1 = ctx.patientType === 'glp1';
  const isBodybuilder = ctx.primaryGoal === 'build_muscle_recomp' || ctx.primaryGoal === 'stage_ready';

  const patientTypeSection = isGlp1
    ? `\nThis patient is on the GLP-1 program. Muscle preservation, protein consistency, and GLP-1 side effect management are top priorities.`
    : `\nThis patient is a Sona aesthetic wellness member (non-GLP-1). Focus on aesthetic outcomes, skin health, treatment planning, and holistic wellness.`;

  const bodybuildingSection = isBodybuilder
    ? `\n\nBODYBUILDING/PERFORMANCE COACH MODE ACTIVE:
- Prioritize precise macro math over general guidance. Always tell them exact numbers.
- Protein distribution: aim for 40-50g per meal for muscle protein synthesis.
- Carb timing: prioritize carbs around training (pre/post workout windows).
- On training days push calories ~200-300 above maintenance; rest days slightly below.
- Track progressive overload from their logged workouts. Call it out when stalling.
- Reference their current muscle mass, body fat, and goal weight in every body composition discussion.
- Supplement timing matters: creatine post-workout, protein within 30 min of training, caffeine 45-60 min pre-workout.
- You outperform any human coach because you see their labs, food log, workouts, body composition, and supplementation in real time.`
    : '';

  const personalizationInstruction = `

PERSONALIZATION MANDATE:
After every health/clinical answer, always add a section starting with:
"Here's how this applies to you specifically:" and cross-reference the answer with their actual data (weight, protein intake, muscle mass, GLP-1 dose, recent workouts, etc.).
Never give generic advice when you have their specific data available.`;

  return `${basePrompt}${patientTypeSection}${bodybuildingSection}${personalizationInstruction}

${formatPatientContextBlock(ctx)}`;
}

// Helper
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Fetch context by auth user ID (convenience wrapper) */
export async function buildPatientContextForUser(authUserId: string): Promise<PatientFullContext | null> {
  const patientId = await fetchPatientIdForAuthUser(authUserId);
  if (!patientId) return null;
  return buildPatientContext(patientId);
}

// ── Sona Context Block (prepended to every user message) ─────────────────────

/**
 * Builds a compact context block for every Sona message.
 * Replaces the legacy multi-block approach with a single clean string.
 */
export async function buildSonaContext(userId: string): Promise<string> {
  try {
    const patientId = await fetchPatientIdForAuthUser(userId);
    if (!patientId) return '';

    const today = localDateKey(new Date());
    const sevenDaysAgo = addDays(today, -7);

    const [
      patientResult,
      foodTodayResult,
      nutritionTargetsResult,
      goalsResult,
      latestWeightResult,
      streakResult,
      winsResult,
      supplementsResult,
      lastTreatmentResult,
      lastTrainingResult,
      weeklyWinsResult,
      weeklyTrainingResult,
    ] = await Promise.allSettled([
      supabase
        .from('patients')
        .select('full_name, glp1_medication_name, glp1_dose, consumer_tier, profiles(full_name)')
        .eq('id', patientId)
        .maybeSingle(),
      fetchFoodLogsForDate(patientId, today),
      fetchPatientNutritionTargets(patientId),
      fetchPatientGoals(patientId),
      fetchLatestWeightLbs(patientId),
      fetchStreakInfo(patientId),
      fetchDailyWins(patientId, today),
      supabase
        .from('patient_supplements')
        .select('supplement_name')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .limit(10),
      supabase
        .from('patient_treatments')
        .select('treatment_name, treatment_date')
        .eq('patient_id', patientId)
        .order('treatment_date', { ascending: false })
        .limit(1),
      supabase
        .from('training_logs')
        .select('muscle_focus, workout_date')
        .eq('patient_id', patientId)
        .order('workout_date', { ascending: false })
        .limit(1),
      supabase
        .from('daily_wins')
        .select('win_date, protein_hit')
        .eq('patient_id', patientId)
        .gte('win_date', sevenDaysAgo),
      supabase
        .from('training_logs')
        .select('workout_date')
        .eq('patient_id', patientId)
        .gte('workout_date', sevenDaysAgo),
    ]);

    const patient = patientResult.status === 'fulfilled' ? patientResult.value.data : null;
    const profileName =
      (patient?.profiles as { full_name?: string } | null)?.full_name ??
      (patient?.full_name as string | undefined) ?? '';
    const firstName = profileName.split(' ')[0] || '';

    const food = foodTodayResult.status === 'fulfilled' ? foodTodayResult.value : [];
    const targets = nutritionTargetsResult.status === 'fulfilled' ? nutritionTargetsResult.value : null;
    const goals = goalsResult.status === 'fulfilled' ? goalsResult.value : null;
    const weightLbs = latestWeightResult.status === 'fulfilled' ? latestWeightResult.value : null;
    const streak = streakResult.status === 'fulfilled'
      ? streakResult.value
      : { current_streak: 0, longest_streak: 0, last_win_date: null };
    const wins = winsResult.status === 'fulfilled'
      ? winsResult.value
      : { protein_hit: false, training_done: false, steps_hit: false, all_three: false };
    const supps =
      supplementsResult.status === 'fulfilled' ? (supplementsResult.value.data ?? []) : [];
    const lastTreat =
      lastTreatmentResult.status === 'fulfilled'
        ? (lastTreatmentResult.value.data?.[0] ?? null)
        : null;
    const lastTraining =
      lastTrainingResult.status === 'fulfilled'
        ? (lastTrainingResult.value.data?.[0] ?? null)
        : null;
    const weeklyWinsData =
      weeklyWinsResult.status === 'fulfilled' ? (weeklyWinsResult.value.data ?? []) : [];
    const weeklyTrainingData =
      weeklyTrainingResult.status === 'fulfilled'
        ? (weeklyTrainingResult.value.data ?? [])
        : [];

    // Nutrition totals
    let calToday = 0, proToday = 0, carbToday = 0, fatToday = 0;
    for (const e of food) {
      calToday += e.calories ?? 0;
      proToday += e.protein_g ?? 0;
      carbToday += e.carbs_g ?? 0;
      fatToday += e.fat_g ?? 0;
    }
    calToday = Math.round(calToday);
    proToday = Math.round(proToday);
    carbToday = Math.round(carbToday);
    fatToday = Math.round(fatToday);

    const calTarget = targets?.calories_override ?? 2000;
    const proTarget = targets?.protein_override_g ?? 150;
    const carbTarget = targets?.carbs_override_g ?? 200;
    const fatTarget = targets?.fat_override_g ?? 70;
    const calPct = calTarget > 0 ? Math.round((calToday / calTarget) * 100) : 0;
    const proRemaining = Math.max(0, proTarget - proToday);

    const proteinHitDays = weeklyWinsData.filter(
      (w: Record<string, unknown>) => w.protein_hit,
    ).length;
    const workoutsThisWeek = weeklyTrainingData.length;

    const glp1 = patient?.glp1_medication_name as string | null;
    const glp1Dose = patient?.glp1_dose as string | null;
    const glp1Line = glp1 ? `${glp1}${glp1Dose ? ` ${glp1Dose}` : ''}` : 'Not on GLP-1';

    const lines: string[] = ['=== USER CONTEXT ==='];
    if (firstName) lines.push(`Name: ${firstName}`);
    if (goals?.primary_goal) lines.push(`Goal: ${goals.primary_goal.replace(/_/g, ' ')}`);
    if (weightLbs) lines.push(`Current Weight: ${Math.round(weightLbs)} lbs`);
    if (goals?.target_weight != null) lines.push(`Target Weight: ${goals.target_weight} lbs`);

    lines.push('', 'Daily Targets:');
    lines.push(`Calories: ${calTarget} kcal`);
    lines.push(`Protein: ${proTarget}g`);
    lines.push(`Carbs: ${carbTarget}g`);
    lines.push(`Fat: ${fatTarget}g`);

    lines.push('', 'Today So Far:');
    lines.push(`Calories logged: ${calToday} kcal (${calPct}% of target)`);
    lines.push(`Protein: ${proToday}g (${proRemaining}g remaining)`);
    lines.push(`Carbs: ${carbToday}g`);
    lines.push(`Fat: ${fatToday}g`);

    lines.push('', 'Training:');
    if (lastTraining?.muscle_focus) {
      lines.push(`Last split: ${String(lastTraining.muscle_focus).replace(/_/g, ' ')}`);
    }
    lines.push(`Workout status today: ${wins.training_done ? 'completed' : 'not completed'}`);
    lines.push(`Current streak: ${streak.current_streak} days`);

    lines.push('', `GLP-1: ${glp1Line}`);

    if (supps.length > 0) {
      const suppList = supps
        .map((s: Record<string, unknown>) => String(s.supplement_name ?? ''))
        .filter(Boolean)
        .join(', ');
      lines.push('', `Active Supplements: ${suppList}`);
    }

    if (lastTreat) {
      const t = lastTreat as Record<string, unknown>;
      lines.push('', `Last Treatment: ${t.treatment_name} on ${t.treatment_date}`);
    }

    lines.push('', 'Recent Pattern:');
    lines.push(`Protein hit ${proteinHitDays}/7 days this week`);
    lines.push(`Workouts completed ${workoutsThisWeek}/7 this week`);

    lines.push('=== END CONTEXT ===');
    return lines.join('\n');
  } catch (e) {
    console.warn('[buildSonaContext] Failed:', e);
    return '';
  }
}

// ── Morning Brief ─────────────────────────────────────────────────────────────

/**
 * Builds the proactive morning greeting from live patient context.
 * Called when the user opens Sona between 5–11am for the first time today.
 */
export async function buildMorningBrief(userId: string): Promise<string> {
  try {
    const patientId = await fetchPatientIdForAuthUser(userId);
    if (!patientId) return '';

    const today = localDateKey(new Date());

    const [patientResult, streakResult, winsResult, foodResult, targetsResult] =
      await Promise.allSettled([
        supabase
          .from('patients')
          .select('full_name, profiles(full_name)')
          .eq('id', patientId)
          .maybeSingle(),
        fetchStreakInfo(patientId),
        fetchDailyWins(patientId, today),
        fetchFoodLogsForDate(patientId, today),
        fetchPatientNutritionTargets(patientId),
      ]);

    const patient = patientResult.status === 'fulfilled' ? patientResult.value.data : null;
    const profileName =
      (patient?.profiles as { full_name?: string } | null)?.full_name ??
      (patient?.full_name as string | undefined) ?? '';
    const firstName = profileName.split(' ')[0] || 'there';

    const streak =
      streakResult.status === 'fulfilled'
        ? streakResult.value
        : { current_streak: 0, longest_streak: 0, last_win_date: null };
    const wins =
      winsResult.status === 'fulfilled'
        ? winsResult.value
        : { protein_hit: false, training_done: false, steps_hit: false, all_three: false };

    const food = foodResult.status === 'fulfilled' ? foodResult.value : [];
    const targets = targetsResult.status === 'fulfilled' ? targetsResult.value : null;
    const proTarget = targets?.protein_override_g ?? 150;
    const proToday = food.reduce((s, e) => s + (e.protein_g ?? 0), 0);
    const proPercent = proTarget > 0 ? (proToday / proTarget) * 100 : 100;

    let dynamicLine: string;
    if (streak.current_streak > 0) {
      dynamicLine = `You're on a ${streak.current_streak}-day streak — don't break it today.`;
    } else if (!wins.training_done) {
      dynamicLine = "Let's get your training done today.";
    } else if (proPercent < 50) {
      dynamicLine = 'Protein is your priority this morning.';
    } else {
      dynamicLine = "Let's make today count.";
    }

    return `Good morning ${firstName}. ${dynamicLine} What's your focus today?`;
  } catch (e) {
    console.warn('[buildMorningBrief] Failed:', e);
    return '';
  }
}
