import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const BG_LIGHT = require('../../../assets/images/sona-light-bg.png');
const BG_DARK  = require('../../../assets/images/sona-bg-dark.png');
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { canUseGlp1PatientFeatures, canUseNutritionPremium } from '@/lib/consumerTier';
import { fetchFoodLogsForDate, type FoodLogRow, type MealType } from '@/lib/nutritionLogData';
import { fetchPatientWeightsForMacros } from '@/lib/nutritionCoachContext';
import { fetchPatientMetabolicRow, type PatientMetabolicRow } from '@/lib/patientMetabolicProfile';
import {
  calorieGuardrailsForSex,
  computeMacroPlan,
  pickGoalWeightLb,
  pickReferenceWeightLb,
  resolveSexForNutritionFloors,
  type MacroTargets,
} from '@/lib/nutritionMacroTargets';
import { upsertFoodLogEntry } from '@/lib/nutritionLogData';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  fetchPatientNutritionTargets,
  hasAnyNutritionCustom,
  mergeNutritionOverrides,
  resetPatientNutritionOverrides,
  setNutritionOverrideField,
  syncPatientMacroGoalsFromEffective,
  type NutritionCustomFlags,
} from '@/lib/patientNutritionTargets';
import {
  daysUntilTargetDate,
  fetchPatientGoals,
  PRIMARY_GOAL_LABELS,
  type PrimaryGoalId,
} from '@/lib/patientGoals';
import { parseConversationalFoodText, type ConversationalFoodItem } from '@/lib/nutritionFoodApi';
import { localDateKey } from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { standardTextInputProps } from '@/lib/textInputStandard';
import {
  fetchPlansForDate, upsertPlanEntry, type NutritionPlanRow,
  fetchTemplates, saveCurrentDayAsTemplate, applyTemplateToDate, deleteTemplate,
  type MealTemplateRow,
} from '@/lib/nutritionPlans';

type Goals = { calories: number; protein: number; carbs: number; fat: number };
type Totals = { calories: number; protein: number; carbs: number; fat: number };
type MacroField = 'protein' | 'carbs' | 'fat' | 'calories';
type EditableLineItem = ConversationalFoodItem & { id: string };

const MEAL_ORDER: MealType[] = [
  'breakfast',
  'pre_workout',
  'lunch',
  'post_workout',
  'dinner',
  'snack',
];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  pre_workout: 'Pre-Workout',
  lunch: 'Lunch',
  post_workout: 'Post-Workout',
  dinner: 'Dinner',
  snack: 'Snacks',
};

// ── Calorie ring (large, left side of summary card) ─────────────────────────
function KcalRing({ goal, actual }: { goal: number; actual: number }) {
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const sz = 130; const r = 52; const cx = sz / 2; const cy = sz / 2;
  const circ = 2 * Math.PI * r;
  const p = goal > 0 ? Math.min(1, actual / goal) : 0;
  const remaining = Math.max(0, goal - actual);
  return (
    <View style={{ width: sz, height: sz, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={sz} height={sz} style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={r} stroke={isDark ? 'rgba(191,141,54,0.25)' : '#ede5d5'} strokeWidth={9} fill={isDark ? tokens.colors.surface : 'white'} />
        <Circle cx={cx} cy={cy} r={r} stroke={GOLD} strokeWidth={9} fill="none"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - p)}
          strokeLinecap="round" rotation={-90} origin={`${cx},${cy}`} />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 26, fontWeight: '700', color: tokens.colors.text, lineHeight: 30 }}>
          {Math.round(remaining)}
        </Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: tokens.colors.textMuted, textAlign: 'center', lineHeight: 13 }}>
          kcal{'\n'}left
        </Text>
      </View>
    </View>
  );
}

// ── Small macro metric circle ─────────────────────────────────────────────────
function MacroCircle({ label, val, max, color }: { label: string; val: number; max: number; color: string }) {
  const { tokens } = useAppTheme();
  const sz = 72; const r = 30; const cx = sz / 2; const cy = sz / 2;
  const circ = 2 * Math.PI * r;
  const p = max > 0 ? Math.min(1, val / max) : 0;
  const remaining = Math.max(0, max - val);
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <View style={{ width: sz, height: sz, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={sz} height={sz} style={StyleSheet.absoluteFill}>
          <Circle cx={cx} cy={cy} r={r} stroke={color + '28'} strokeWidth={6} fill="none" />
          <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={6} fill="none"
            strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - p)}
            strokeLinecap="round" rotation={-90} origin={`${cx},${cy}`} />
        </Svg>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, fontWeight: '700', color: tokens.colors.text }}>
            {Math.round(remaining)}
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 8, color: tokens.colors.textMuted }}>left</Text>
        </View>
      </View>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: tokens.colors.textMuted }}>{label}</Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: color, fontWeight: '600' }}>
        {Math.round(val)}/{max}g
      </Text>
    </View>
  );
}

function metabolicToPlan(m: PatientMetabolicRow | null) {
  if (!m) return null;
  return {
    heightInches: m.height_inches,
    dateOfBirth: m.date_of_birth,
    ageYearsSnapshot: m.age,
    biologicalSex: m.biological_sex,
    legacySex: m.sex,
    activityLevel: m.activity_level,
  };
}

function clampMacro(field: MacroField, n: number, metabolic: PatientMetabolicRow | null): number {
  switch (field) {
    case 'protein':
      return Math.min(400, Math.max(40, Math.round(n)));
    case 'carbs':
      return Math.min(700, Math.max(20, Math.round(n)));
    case 'fat':
      return Math.min(200, Math.max(15, Math.round(n)));
    case 'calories': {
      const { hardMin } = calorieGuardrailsForSex(resolveSexForNutritionFloors(metabolicToPlan(metabolic)));
      return Math.min(6000, Math.max(hardMin, Math.round(n)));
    }
    default:
      return Math.round(n);
  }
}

export default function NutritionIndex() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const styles = createStyles(tokens, isDark);
  const { user, profile } = useAuth();
  const premiumNutrition = canUseNutritionPremium(profile);
  const tier = profile?.consumer_tier ?? 'free';
  const [goals, setGoals] = useState<Goals>({ calories: 1800, protein: 130, carbs: 150, fat: 56 });
  const [recommendedGoals, setRecommendedGoals] = useState<Goals>({ calories: 1800, protein: 130, carbs: 150, fat: 56 });
  const [customFlags, setCustomFlags] = useState<NutritionCustomFlags>({
    protein: false,
    carbs: false,
    fat: false,
    calories: false,
  });
  const [totals, setTotals] = useState<Totals>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [primaryGoalId, setPrimaryGoalId] = useState<PrimaryGoalId | null>(null);
  const [todaysFood, setTodaysFood] = useState<FoodLogRow[]>([]);
  const [prescribedPlan, setPrescribedPlan] = useState<MacroTargets | null>(null);
  const [adjustField, setAdjustField] = useState<MacroField | null>(null);
  const [adjustDraft, setAdjustDraft] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [metabolicRow, setMetabolicRow] = useState<PatientMetabolicRow | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [convoInput, setConvoInput] = useState('');
  const [convoBusy, setConvoBusy] = useState(false);
  const [convoLogging, setConvoLogging] = useState(false);
  const [parsedItems, setParsedItems] = useState<EditableLineItem[]>([]);
  // Plan vs Actual mode
  const [viewMode, setViewMode] = useState<'actual' | 'plan'>('actual');
  const [plannedMeals, setPlannedMeals] = useState<NutritionPlanRow[]>([]);
  // Meal templates
  const [templates, setTemplates] = useState<MealTemplateRow[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const detectMealTypeFromText = useCallback((text: string): MealType => {
    const lower = text.toLowerCase();
    if (lower.includes('pre') && (lower.includes('workout') || lower.includes('work out') || lower.includes('gym'))) {
      return 'pre_workout';
    }
    if (lower.includes('post') && (lower.includes('workout') || lower.includes('work out') || lower.includes('gym'))) {
      return 'post_workout';
    }
    if (lower.includes('breakfast')) return 'breakfast';
    if (lower.includes('lunch')) return 'lunch';
    if (lower.includes('dinner')) return 'dinner';
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 16) return 'lunch';
    if (hour >= 16 && hour < 22) return 'dinner';
    return 'snack';
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      setPatientId(pid);
      if (!pid) return;
      const today = localDateKey(new Date());
      const [goalsRow, weights, metabolic, { data: goalRow }, nutritionOverrides, todaysEntries] = await Promise.all([
        fetchPatientGoals(pid),
        fetchPatientWeightsForMacros(pid),
        fetchPatientMetabolicRow(pid),
        supabase.from('patient_macro_goals').select('*').eq('patient_id', pid).maybeSingle(),
        fetchPatientNutritionTargets(pid),
        fetchFoodLogsForDate(pid, today),
      ]);

      setMetabolicRow(metabolic);

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
      const defaultBodyLb = weights.latestLoggedWeightLbs ?? goalLb ?? refLb;
      let recommended: Goals;
      if (goalsRow?.primary_goal) {
        const bodyLb = defaultBodyLb;
        const primary = goalsRow.primary_goal as PrimaryGoalId;
        const isGlp1Program =
          primary === 'glp1_journey' || canUseGlp1PatientFeatures(profile);
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
        const t = computeMacroPlan({
          primaryGoal: primary,
          bodyWeightLb: bodyLb,
          goalWeightLb: goalLb,
          metabolic: metabolicForPlan,
          isGlp1Program,
          daysUntilStageShow:
            primary === 'stage_ready' ? daysUntilTargetDate(goalsRow.target_date) : null,
        });
        setPrescribedPlan(t);
        recommended = { calories: t.calories, protein: t.protein_g, carbs: t.carbs_g, fat: t.fat_g };
      } else if (goalRow) {
        setPrescribedPlan(null);
        recommended = {
          calories: Number(goalRow.calories_goal ?? 1800),
          protein: Number(goalRow.protein_goal_g ?? 130),
          carbs: Number(goalRow.carbs_goal_g ?? 150),
          fat: Number(goalRow.fat_goal_g ?? 56),
        };
      } else {
        setPrescribedPlan(null);
        await supabase.from('patient_macro_goals').upsert({ patient_id: pid }, { onConflict: 'patient_id' });
        recommended = { calories: 1800, protein: 130, carbs: 150, fat: 56 };
      }

      const { effective, custom } = mergeNutritionOverrides(recommended, nutritionOverrides);
      setRecommendedGoals(recommended);
      setGoals(effective);
      setCustomFlags(custom);
      setPrimaryGoalId(goalsRow?.primary_goal ?? null);

      await syncPatientMacroGoalsFromEffective(pid, effective);

      setTodaysFood(todaysEntries);

      // Load planned meals and templates in parallel
      const [plans, tmpl] = await Promise.all([
        fetchPlansForDate(pid, today),
        fetchTemplates(pid),
      ]);
      setPlannedMeals(plans);
      setTemplates(tmpl);

      const sum = todaysEntries.reduce(
        (acc, e) => ({
          calories: acc.calories + e.calories,
          protein: acc.protein + e.protein_g,
          carbs: acc.carbs + e.carbs_g,
          fat: acc.fat + e.fat_g,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      setTotals(sum);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const macroRows = useMemo(() => {
    const cal = Math.max(1, goals.calories);
    const pct = (g: number, kcalPerG: number) => (kcalPerG * g) / cal;
    return [
      {
        field: 'protein' as const,
        label: 'Protein',
        unit: 'g',
        planned: goals.protein,
        actual: totals.protein,
        plannedPct: pct(goals.protein, 4),
        actualPct: pct(totals.protein, 4),
        star: true,
      },
      {
        field: 'carbs' as const,
        label: 'Carbs',
        unit: 'g',
        planned: goals.carbs,
        actual: totals.carbs,
        plannedPct: pct(goals.carbs, 4),
        actualPct: pct(totals.carbs, 4),
      },
      {
        field: 'fat' as const,
        label: 'Fat',
        unit: 'g',
        planned: goals.fat,
        actual: totals.fat,
        plannedPct: pct(goals.fat, 9),
        actualPct: pct(totals.fat, 9),
      },
    ];
  }, [goals, totals]);

  const anyCustom = hasAnyNutritionCustom(customFlags);

  const mealGroups = useMemo(() => {
    const by = new Map<MealType, FoodLogRow[]>();
    for (const e of todaysFood) {
      const k = e.meal_type;
      if (!by.has(k)) by.set(k, []);
      by.get(k)!.push(e);
    }
    return MEAL_ORDER.filter((m) => (by.get(m)?.length ?? 0) > 0).map((m) => ({
      meal: m,
      label: MEAL_LABEL[m],
      items: by.get(m)!,
    }));
  }, [todaysFood]);

  const openAdjust = (field: MacroField) => {
    const v = goals[field];
    setAdjustDraft(String(Math.round(v)));
    setAdjustField(field);
  };

  const closeAdjust = () => {
    setAdjustField(null);
    setAdjustDraft('');
    Keyboard.dismiss();
  };

  const saveAdjustCustom = async () => {
    if (!patientId || !adjustField) return;
    const raw = adjustDraft.trim().replace(/,/g, '');
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      Alert.alert('Invalid number', 'Enter a whole number for this target.');
      return;
    }
    const clamped = clampMacro(adjustField, n, metabolicRow);
    setSavingAdjust(true);
    try {
      const { error } = await setNutritionOverrideField(patientId, adjustField, clamped);
      if (error) {
        Alert.alert('Could not save', error);
        return;
      }
      closeAdjust();
      await refresh();
    } finally {
      setSavingAdjust(false);
    }
  };

  const clearAdjustField = async () => {
    if (!patientId || !adjustField) return;
    setSavingAdjust(true);
    try {
      const { error } = await setNutritionOverrideField(patientId, adjustField, null);
      if (error) {
        Alert.alert('Could not update', error);
        return;
      }
      closeAdjust();
      await refresh();
    } finally {
      setSavingAdjust(false);
    }
  };

  const resetAllToRecommended = async () => {
    if (!patientId) return;
    const { error } = await resetPatientNutritionOverrides(patientId);
    if (error) {
      Alert.alert('Could not reset', error);
      return;
    }
    await refresh();
  };

  const goalLine =
    primaryGoalId != null ? PRIMARY_GOAL_LABELS[primaryGoalId] : 'Not set yet — choose a primary goal in My Goals';

  const adjustTitle =
    adjustField === 'protein'
      ? 'Protein (g)'
      : adjustField === 'carbs'
        ? 'Carbs (g)'
        : adjustField === 'fat'
          ? 'Fat (g)'
          : adjustField === 'calories'
            ? 'Calories (kcal)'
            : 'Adjust target';

  const parseConversationInput = useCallback(async () => {
    const input = convoInput.trim();
    if (!input) return;
    setConvoBusy(true);
    try {
      const items = await parseConversationalFoodText(input);
      setParsedItems(items.map((item, idx) => ({ ...item, id: `${Date.now()}-${idx}` })));
      if (items.length === 0) {
        Alert.alert('No foods found', 'Try a clearer message like "I had 2 eggs and toast for breakfast".');
      }
    } finally {
      setConvoBusy(false);
    }
  }, [convoInput]);

  const updateParsedItem = useCallback((id: string, patch: Partial<EditableLineItem>) => {
    setParsedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const confirmParsedItems = useCallback(async () => {
    if (!patientId || parsedItems.length === 0) return;
    const mealType = detectMealTypeFromText(convoInput);
    const logDate = localDateKey(new Date());
    setConvoLogging(true);
    try {
      for (const item of parsedItems) {
        await upsertFoodLogEntry({
          patient_id: patientId,
          log_date: logDate,
          meal_type: mealType,
          food_name: item.name,
          brand: item.brand,
          calories: Number(item.calories) || 0,
          protein_g: Number(item.protein_g) || 0,
          carbs_g: Number(item.carbs_g) || 0,
          fat_g: Number(item.fat_g) || 0,
          serving_size: Number(item.serving_size) || 100,
          serving_unit: item.serving_unit || 'g',
          source: 'coach_nlp',
        });
      }
      setConvoInput('');
      setParsedItems([]);
      await refresh();
      Alert.alert('Logged', `Saved ${parsedItems.length} item${parsedItems.length === 1 ? '' : 's'} to ${MEAL_LABEL[mealType]}.`);
    } finally {
      setConvoLogging(false);
    }
  }, [convoInput, detectMealTypeFromText, parsedItems, patientId, refresh]);

  const macroColor = (field: MacroField) =>
    field === 'protein' ? BLUE : field === 'carbs' ? GREEN : PINK;

  return (
    <View style={styles.root}>
      <Image source={isDark ? BG_DARK : BG_LIGHT} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

    {/* ── Adjust target modal ──────────────────────────────────────────── */}
    <Modal visible={adjustField != null} transparent animationType="fade" onRequestClose={closeAdjust}>
      <Pressable style={styles.modalBackdrop} onPress={closeAdjust}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{adjustTitle}</Text>
          <Text style={styles.modalHint}>Suggested: {adjustField != null ? Math.round(recommendedGoals[adjustField]) : '—'}</Text>
          <TextInput value={adjustDraft} onChangeText={setAdjustDraft} keyboardType="number-pad"
            placeholder="Target" placeholderTextColor={tokens.colors.textCaption}
            style={styles.modalInput}
            {...standardTextInputProps({ onSubmit: () => void saveAdjustCustom() })} />
          <View style={styles.modalActions}>
            <Button variant="ghost" onPress={closeAdjust} disabled={savingAdjust}>Cancel</Button>
            {adjustField && customFlags[adjustField] ? (
              <Button variant="ghost" onPress={() => void clearAdjustField()} loading={savingAdjust}>Reset</Button>
            ) : null}
            <Button variant="primary" onPress={() => void saveAdjustCustom()} loading={savingAdjust}>Save</Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>

    {/* ── Sticky header with Plan/Actual toggle ──────────────────────── */}
    <View style={{ paddingTop: 8, paddingHorizontal: 16, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.title}>Nutrition</Text>
        {/* Plan / Actual segmented toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 3 }}>
          {(['actual', 'plan'] as const).map((mode) => (
            <Pressable key={mode} onPress={() => setViewMode(mode)}
              style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8,
                backgroundColor: viewMode === mode ? GOLD : 'transparent' }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12,
                color: viewMode === mode ? '#fff' : tokens.colors.textMuted }}>
                {mode === 'actual' ? 'Actual' : 'Plan'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.dateSubtitle}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      {loading ? <Text style={styles.loadingText}>Loading…</Text> : null}
    </View>

    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>

      {/* ── Daily Summary Card: ring + macro circles ──────────────────── */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <KcalRing goal={goals.calories} actual={totals.calories} />
            <Pressable onPress={() => openAdjust('calories')}>
              <Text style={styles.adjustLink}>Adjust goal</Text>
            </Pressable>
          </View>
          <View style={styles.macroCirclesRow}>
            <MacroCircle label="Protein" val={totals.protein} max={goals.protein} color={BLUE} />
            <MacroCircle label="Carbs"   val={totals.carbs}   max={goals.carbs}   color={GREEN} />
            <MacroCircle label="Fat"     val={totals.fat}     max={goals.fat}     color={PINK} />
          </View>
        </View>
        <View style={styles.summaryFooter}>
          <Text style={styles.goalLabel}>Goal: <Text style={styles.goalValue}>{goalLine}</Text></Text>
          {anyCustom && (
            <Pressable onPress={() => void resetAllToRecommended()}>
              <Text style={styles.adjustLink}>Reset to plan</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Quick-add meal row — all 6 meals ─────────────────────────── */}
      <View style={styles.quickAddCard}>
        <Text style={styles.sectionLabel}>QUICK ADD</Text>
        <View style={styles.quickAddRow}>
          {MEAL_ORDER.map((slot) => (
            <Pressable key={slot} style={styles.quickAddBtn}
              onPress={() => router.push({ pathname: '/patient/nutrition/log', params: { meal: slot } } as never)}>
              <Text style={styles.quickAddMeal} numberOfLines={1}>{MEAL_LABEL[slot]}</Text>
              <Text style={styles.quickAddPlus}>+</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Meal Templates horizontal scroll ─────────────────────────── */}
      {(templates.length > 0 || true) && (
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>MEAL TEMPLATES</Text>
            <Pressable
              disabled={savingTemplate}
              onPress={() => {
                if (!patientId || todaysFood.length === 0) {
                  Alert.alert('No meals logged', 'Log some meals today first, then save them as a template.');
                  return;
                }
                Alert.prompt(
                  'Name this template',
                  'e.g. "High Protein Day", "Rest Day", "Competition Prep"',
                  async (name) => {
                    if (!name?.trim()) return;
                    setSavingTemplate(true);
                    await saveCurrentDayAsTemplate({ patientId, name: name.trim(), foodLogs: todaysFood });
                    setSavingTemplate(false);
                    await refresh();
                    Alert.alert('Saved!', `Template "${name.trim()}" saved.`);
                  },
                  'plain-text',
                );
              }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: GOLD }}>
                {savingTemplate ? 'Saving…' : '+ Save today'}
              </Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {templates.length === 0 && (
              <View style={{ backgroundColor: GOLD + '12', borderRadius: 12, borderWidth: 1, borderColor: GOLD + '30',
                paddingHorizontal: 14, paddingVertical: 10, opacity: 0.6 }}>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: tokens.colors.textMuted }}>
                  No templates yet — log meals and tap "+ Save today"
                </Text>
              </View>
            )}
            {templates.map((tmpl) => (
              <Pressable key={tmpl.id}
                onLongPress={() => Alert.alert('Delete template', `Remove "${tmpl.template_name}"?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTemplate(tmpl.id); await refresh(); } },
                ])}
                onPress={() => Alert.alert(
                  tmpl.template_name,
                  `Load ${tmpl.meals.length} meals (~${Math.round(tmpl.total_calories ?? 0)} cal) into today's ${viewMode === 'plan' ? 'plan' : 'log'}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Load', onPress: async () => {
                      if (!patientId) return;
                      const { error } = await applyTemplateToDate({
                        patientId, template: tmpl,
                        targetDate: localDateKey(new Date()),
                        asPlanned: viewMode === 'plan',
                      });
                      if (error) Alert.alert('Error', error);
                      else { await refresh(); Alert.alert('Done!', `"${tmpl.template_name}" applied to today.`); }
                    }},
                  ],
                )}
                style={{ backgroundColor: GOLD + '18', borderRadius: 12, borderWidth: 1, borderColor: GOLD + '40',
                  paddingHorizontal: 14, paddingVertical: 10, maxWidth: 160 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: GOLD }} numberOfLines={1}>
                  {tmpl.template_name}
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: tokens.colors.textMuted, marginTop: 2 }}>
                  {tmpl.meals.length} items · {Math.round(tmpl.total_calories ?? 0)} cal
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── AI food logger ────────────────────────────────────────────── */}
      <View style={styles.aiCard}>
        <View style={styles.aiHeader}>
          <Text style={styles.sectionLabel}>✦ TELL SONA WHAT YOU ATE</Text>
          <Pressable onPress={() => router.push('/patient/nutrition/log' as never)}>
            <Text style={styles.adjustLink}>Search foods</Text>
          </Pressable>
        </View>
        <TextInput
          value={convoInput}
          onChangeText={setConvoInput}
          placeholder="e.g. 2 eggs and toast for breakfast"
          placeholderTextColor={tokens.colors.textCaption}
          style={[styles.aiInput, { marginBottom: 8 }]}
          returnKeyType="done"
          onSubmitEditing={() => void parseConversationInput()}
          {...standardTextInputProps({ multiline: false, onSubmit: () => void parseConversationInput() })}
        />
        <Pressable
          style={[styles.confirmBtn, convoBusy && { opacity: 0.6 }]}
          onPress={() => void parseConversationInput()}
          disabled={convoBusy}>
          <Text style={styles.confirmBtnTxt}>{convoBusy ? 'Parsing…' : 'Review & add →'}</Text>
        </Pressable>
        {parsedItems.length > 0 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            {parsedItems.map((item) => (
              <View key={item.id} style={styles.parsedRow}>
                <TextInput value={item.name}
                  onChangeText={(t) => updateParsedItem(item.id, { name: t })}
                  style={styles.parsedNameInput} />
                <View style={styles.parsedMacroRow}>
                  {([['Cal', 'calories'], ['P', 'protein_g'], ['C', 'carbs_g'], ['F', 'fat_g']] as const).map(([lbl, key]) => (
                    <View key={lbl} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={styles.parsedMacroLbl}>{lbl}</Text>
                      <TextInput value={String(item[key])}
                        onChangeText={(t) => updateParsedItem(item.id, { [key]: Number(t) || 0 } as Partial<EditableLineItem>)}
                        keyboardType="decimal-pad" style={styles.parsedMacroInput} />
                    </View>
                  ))}
                </View>
              </View>
            ))}
            <Pressable style={styles.confirmBtn} onPress={() => void confirmParsedItems()}>
              <Text style={styles.confirmBtnTxt}>{convoLogging ? 'Logging…' : `Log ${parsedItems.length} item${parsedItems.length > 1 ? 's' : ''}`}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Meal sections — Plan mode or Actual mode ──────────────────── */}
      <View style={styles.mealsCard}>
        <View style={styles.mealsHeader}>
          <Text style={styles.sectionLabel}>
            {viewMode === 'plan' ? 'MEAL PLAN' : "TODAY'S LOG"}
          </Text>
          <Pressable onPress={() => router.push({
            pathname: '/patient/nutrition/log',
            params: viewMode === 'plan' ? { mode: 'plan' } : {},
          } as never)}>
            <Text style={styles.addFoodLink}>
              {viewMode === 'plan' ? '+ Add to plan' : '+ Add food'}
            </Text>
          </Pressable>
        </View>

        {MEAL_ORDER.map((slot) => {
          const actualItems = mealGroups.find((g) => g.meal === slot)?.items ?? [];
          const planItems   = plannedMeals.filter((p) => p.meal_type === slot);
          const displayItems = viewMode === 'plan' ? planItems : actualItems;
          const planCals   = planItems.reduce((s, p) => s + (p.calories ?? 0), 0);
          const actualCals = actualItems.reduce((s, e) => s + (e.calories ?? 0), 0);
          const showBoth   = viewMode === 'actual' && planItems.length > 0;

          return (
            <View key={slot} style={styles.mealSection}>
              {/* Meal header */}
              <Pressable style={styles.mealHeader}
                onPress={() => router.push({ pathname: '/patient/nutrition/log', params: { meal: slot } } as never)}>
                <Text style={styles.mealName}>{MEAL_LABEL[slot]}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {/* Show plan cal in muted style when in actual mode */}
                  {showBoth && (
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: tokens.colors.textCaption }}>
                      Plan {Math.round(planCals)}
                    </Text>
                  )}
                  {(viewMode === 'plan' ? planCals : actualCals) > 0 && (
                    <Text style={styles.mealCals}>
                      {Math.round(viewMode === 'plan' ? planCals : actualCals)} kcal
                    </Text>
                  )}
                  <Text style={styles.mealPlus}>+</Text>
                </View>
              </Pressable>

              {/* Plan items (shown as muted / dashed in actual mode when no actual yet) */}
              {viewMode === 'actual' && planItems.length > 0 && actualItems.length === 0 && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                  {planItems.map((p) => (
                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, opacity: 0.5 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.foodName, { fontStyle: 'italic', fontSize: 12 }]} numberOfLines={1}>
                          📋 {p.food_name}
                        </Text>
                      </View>
                      <Text style={[styles.foodCals, { fontSize: 12, opacity: 0.7 }]}>{Math.round(p.calories ?? 0)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Actual food entries */}
              {(viewMode === 'actual' ? actualItems : planItems as unknown as typeof actualItems).map((e) => (
                <View key={e.id} style={styles.foodRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodName} numberOfLines={1}>{e.food_name}</Text>
                    <Text style={styles.foodMeta}>
                      P{Math.round((e.protein_g ?? 0))}g · C{Math.round((e.carbs_g ?? 0))}g · F{Math.round((e.fat_g ?? 0))}g
                    </Text>
                  </View>
                  <Text style={styles.foodCals}>{Math.round(e.calories ?? 0)}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>

      {/* ── Macro targets (adjustable bars) ──────────────────────────── */}
      <View style={styles.macrosCard}>
        <Text style={styles.sectionLabel}>MACRO TARGETS</Text>
        {macroRows.map((m) => {
          const frac = m.planned > 0 ? Math.min(1, m.actual / m.planned) : 0;
          const col = macroColor(m.field);
          return (
            <View key={m.field} style={styles.macroBarBlock}>
              <View style={styles.macroBarTop}>
                <Text style={styles.macroBarLabel}>{m.label}</Text>
                <Text style={[styles.macroBarVal, { color: col }]}>
                  {Math.round(m.actual)}<Text style={styles.macroBarMax}>/{Math.round(m.planned)}g</Text>
                </Text>
                <Pressable onPress={() => openAdjust(m.field)} hitSlop={8}>
                  <Text style={styles.adjustLink}>Edit</Text>
                </Pressable>
              </View>
              <View style={styles.macroBarTrack}>
                <View style={[styles.macroBarFill, { width: `${frac * 100}%`, backgroundColor: col }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Quick links ───────────────────────────────────────────────── */}
      <View style={styles.quickLinksRow}>
        <Pressable style={styles.quickLinkBtn}
          onPress={() => router.push('/patient/profile/my-goals' as never)}>
          <Text style={styles.quickLinkTxt}>My Goals</Text>
        </Pressable>
        <Pressable style={styles.quickLinkBtn}
          onPress={() => { premiumNutrition ? router.push('/patient/nutrition/scan' as never) : Alert.alert('Core feature', 'Scan is on Core and GLP-1+.'); }}>
          <Text style={styles.quickLinkTxt}>Scan{!premiumNutrition ? ' ↑' : ''}</Text>
        </Pressable>
        <Pressable style={styles.quickLinkBtn}
          onPress={() => { premiumNutrition ? router.push('/patient/nutrition/saved' as never) : Alert.alert('Core feature', 'Saved meals are on Core and GLP-1+.'); }}>
          <Text style={styles.quickLinkTxt}>Saved{!premiumNutrition ? ' ↑' : ''}</Text>
        </Pressable>
        <Pressable style={styles.quickLinkBtn} onPress={() => void refresh()}>
          <Text style={styles.quickLinkTxt}>Refresh</Text>
        </Pressable>
      </View>

    </ScrollView>
    </KeyboardAvoidingView>

    {/* ── MFP-style bottom action bar ──────────────────────────────────── */}
    <View style={styles.bottomBar}>
      {[
        { label: 'Log Food', onPress: () => router.push('/patient/nutrition/log' as never) },
        { label: 'Scan',     onPress: () => router.push('/patient/nutrition/scan' as never) },
        { label: 'Saved',    onPress: () => premiumNutrition ? router.push('/patient/nutrition/saved' as never) : Alert.alert('Core feature', 'Saved meals require Core or GLP-1+.') },
        { label: 'My Goals', onPress: () => router.push('/patient/profile/my-goals' as never) },
      ].map(({ label, onPress }) => (
        <Pressable key={label} style={styles.bottomBarBtn} onPress={onPress}>
          <Text style={styles.bottomBarTxt}>{label}</Text>
        </Pressable>
      ))}
    </View>

    </View>
  );
}

const GOLD  = '#BF8D36';
const BLUE  = '#5BC4DC';
const PINK  = '#E07878';
const GREEN = '#5EC47A';

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens'], isDark: boolean) => {
  const C  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.86)'; // card bg
  const BD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)'; // card border
  const IB = isDark ? tokens.colors.backgroundElevated : 'rgba(255,255,255,0.88)'; // input bg
  const TX = tokens.colors.text;
  const MT = tokens.colors.textMuted;
  const CP = tokens.colors.textCaption;
  const SH = { shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 4 } as const, shadowOpacity: 0.14, shadowRadius: 12, elevation: 8 };

  return StyleSheet.create({
  root:  { flex: 1 },

  // Header
  title:         { fontFamily: 'PTSerif_400Regular', fontSize: 34, color: TX, marginBottom: 2 },
  dateSubtitle:  { fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, marginBottom: 14 },
  loadingText:   { fontFamily: 'DMSans_400Regular', fontSize: 13, color: CP, marginBottom: 8 },

  // Summary card
  summaryCard: { backgroundColor: C, borderRadius: 20, borderWidth: 1, borderColor: BD, padding: 16, marginBottom: 10, ...SH },
  summaryRow:  { flexDirection: 'row', alignItems: 'center', gap: 16 },
  macroCirclesRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  summaryFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BD },
  goalLabel:  { fontFamily: 'DMSans_400Regular', fontSize: 11, color: CP, flex: 1 },
  goalValue:  { color: MT },
  adjustLink: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: GOLD },

  // Quick add
  quickAddCard: { backgroundColor: C, borderRadius: 18, borderWidth: 1, borderColor: BD, padding: 14, marginBottom: 10, ...SH },
  quickAddRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  quickAddBtn:  { width: '31%', height: 58, backgroundColor: GOLD + '18', borderRadius: 12, borderWidth: 1, borderColor: GOLD + '40', alignItems: 'center', justifyContent: 'center', gap: 4 },
  quickAddMeal: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: TX, textAlign: 'center', lineHeight: 13 },
  quickAddPlus: { fontFamily: 'DMSans_500Medium', fontSize: 20, color: GOLD, lineHeight: 20, textAlign: 'center', includeFontPadding: false },
  sectionLabel: { fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4 },

  // AI logger card
  aiCard:      { backgroundColor: C, borderRadius: 18, borderWidth: 1, borderColor: BD, padding: 14, marginBottom: 10, ...SH },
  aiHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  aiInputRow:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  aiInput:     { flex: 1, backgroundColor: IB, borderRadius: 12, borderWidth: 1, borderColor: BD, paddingHorizontal: 14, paddingVertical: 11, color: TX, fontFamily: 'DMSans_400Regular', fontSize: 14 },
  aiSendBtn:   { width: 42, height: 42, borderRadius: 21, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  aiSendTxt:   { color: '#fff', fontSize: 18, fontWeight: '600' },
  parsedRow:   { backgroundColor: IB, borderRadius: 12, borderWidth: 1, borderColor: BD, padding: 10 },
  parsedNameInput: { borderWidth: 1, borderColor: BD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, color: TX, fontFamily: 'DMSans_400Regular', fontSize: 13, marginBottom: 8 },
  parsedMacroRow:  { flexDirection: 'row', gap: 6 },
  parsedMacroLbl:  { fontFamily: 'DMSans_400Regular', fontSize: 9, color: CP, marginBottom: 2, textAlign: 'center' },
  parsedMacroInput: { borderWidth: 1, borderColor: BD, borderRadius: 8, paddingVertical: 7, color: TX, fontFamily: 'DMSans_400Regular', fontSize: 13, textAlign: 'center' },
  confirmBtn:  { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  confirmBtnTxt: { color: '#fff', fontFamily: 'DMSans_500Medium', fontSize: 14, fontWeight: '600' },

  // Meals card (MFP style)
  mealsCard:   { backgroundColor: C, borderRadius: 20, borderWidth: 1, borderColor: BD, marginBottom: 10, overflow: 'hidden', ...SH },
  mealsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  addFoodLink: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: GOLD },
  mealSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BD, minHeight: 48 },
  mealHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  mealName:    { fontFamily: 'DMSans_500Medium', fontSize: 14, color: TX },
  mealCals:    { fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT },
  mealPlus:    { fontFamily: 'DMSans_400Regular', fontSize: 22, color: GOLD, lineHeight: 24 },
  foodRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BD + '80' },
  foodName:    { fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX, marginBottom: 2 },
  foodMeta:    { fontFamily: 'DMSans_400Regular', fontSize: 11, color: CP },
  foodCals:    { fontFamily: 'DMSans_500Medium', fontSize: 14, color: TX, marginLeft: 8 },

  // Macros card
  macrosCard:    { backgroundColor: C, borderRadius: 20, borderWidth: 1, borderColor: BD, padding: 16, marginBottom: 10, ...SH },
  macroBarBlock: { marginBottom: 14 },
  macroBarTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  macroBarLabel: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: TX, flex: 1 },
  macroBarVal:   { fontFamily: 'DMSans_500Medium', fontSize: 13, fontWeight: '600' },
  macroBarMax:   { fontWeight: '400', color: MT },
  macroBarTrack: { height: 7, borderRadius: 4, backgroundColor: BD, overflow: 'hidden' },
  macroBarFill:  { height: '100%', borderRadius: 4 },
  proteinFill:   { backgroundColor: BLUE },
  carbsFill:     { backgroundColor: GREEN },
  fatFill:       { backgroundColor: PINK },

  // Quick links
  quickLinksRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickLinkBtn:  { flex: 1, backgroundColor: C, borderRadius: 12, borderWidth: 1, borderColor: BD, paddingVertical: 10, alignItems: 'center', ...SH },
  quickLinkTxt:  { fontFamily: 'DMSans_400Regular', fontSize: 12, color: GOLD },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 },
  modalCard:  { backgroundColor: isDark ? 'rgba(30,24,16,0.97)' : 'rgba(255,252,245,0.98)', borderRadius: 20, borderWidth: 1, borderColor: BD, padding: 20 },
  modalTitle: { fontFamily: 'PTSerif_400Regular', fontSize: 24, color: TX, marginBottom: 4 },
  modalHint:  { fontFamily: 'DMSans_400Regular', fontSize: 12, color: CP, marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: BD, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: TX, fontFamily: 'DMSans_400Regular', fontSize: 22, marginBottom: 20, backgroundColor: IB, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 10 },

  // Bottom bar (MFP style)
  bottomBar:    { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: isDark ? 'rgba(28,22,14,0.97)' : 'rgba(255,252,245,0.97)', borderTopWidth: 1, borderTopColor: BD, paddingBottom: 20, paddingTop: 10 },
  bottomBarBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  bottomBarTxt: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: GOLD },
});
};
