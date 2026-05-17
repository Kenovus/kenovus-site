import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  COACHING_FREQUENCY_IDS,
  COACHING_FREQUENCY_LABELS,
  EXPERIENCE_LEVEL_IDS,
  EXPERIENCE_LEVEL_LABELS,
  HAS_TARGET_IDS,
  HAS_TARGET_LABELS,
  PRIMARY_GOAL_IDS,
  PRIMARY_GOAL_LABELS,
  fetchPatientGoals,
  upsertPatientGoals,
  type CoachingFrequencyId,
  type ExperienceLevelId,
  type HasTargetId,
  type PrimaryGoalId,
} from '@/lib/patientGoals';
import {
  EQUIPMENT_IDS,
  EQUIPMENT_LABELS,
  TRAINING_STYLE_IDS,
  TRAINING_STYLE_LABELS,
  fetchPatientTrainingPrefs,
  upsertPatientTrainingPrefs,
  type EquipmentId,
  type TrainingStyleId,
} from '@/lib/patientTrainingPrefs';
import { normalizeUiMode } from '@/types/onboarding';
import { formatDigitsToMmDdYyyy, isoYmdToMmDdYyyy, parseMmDdYyyyToIso } from '@/lib/dateUsFormat';
import { standardTextInputProps } from '@/lib/textInputStandard';

const LB_PER_KG = 2.2046226218;

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function MyGoalsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string | string[] }>();
  const { user, profile } = useAuth();
  const source = typeof params.source === 'string' ? params.source : '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>(1);

  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoalId | null>(null);
  const [hasTarget, setHasTarget] = useState<HasTargetId | null>(null);
  const [targetWeight, setTargetWeight] = useState('');
  const [targetWeightUnit, setTargetWeightUnit] = useState<'lb' | 'kg'>('lb');
  const [targetBf, setTargetBf] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetDateIso, setTargetDateIso] = useState<string | null>(null);
  const [coachingFrequency, setCoachingFrequency] = useState<CoachingFrequencyId | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevelId | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [trainingDays, setTrainingDays] = useState<number>(4);
  const [trainingStyle, setTrainingStyle] = useState<TrainingStyleId>('general_fitness');
  const [equipment, setEquipment] = useState<EquipmentId>('full_gym');

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (!pid) return;
      const [row, prefs] = await Promise.all([fetchPatientGoals(pid), fetchPatientTrainingPrefs(pid)]);
      if (row) {
        setPrimaryGoal(row.primary_goal);
        setHasTarget(row.has_target);
        setTargetWeight(
          row.target_weight != null ? String(Math.round(Number(row.target_weight) * 10) / 10) : '',
        );
        setTargetWeightUnit('lb');
        setTargetBf(row.target_body_fat_pct != null ? String(row.target_body_fat_pct) : '');
        if (row.target_date) {
          setTargetDate(isoYmdToMmDdYyyy(row.target_date));
          setTargetDateIso(row.target_date);
        } else {
          setTargetDate('');
          setTargetDateIso(null);
        }
        setCoachingFrequency(row.coaching_frequency);
        setExperienceLevel(row.experience_level);
        setAdditionalNotes(row.additional_notes ?? '');
      }
      if (prefs) {
        setTrainingDays(prefs.training_days_per_week);
        setTrainingStyle(prefs.training_style);
        setEquipment(prefs.equipment);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const goHome = useCallback(() => {
    if (source === 'post_greeting') {
      const guided = profile == null ? true : normalizeUiMode(profile) === 'guided';
      router.replace('/patient/home' as Href);
      return;
    }
    router.back();
  }, [router, source, profile]);

  const validateStep = (s: Step): string | null => {
    if (s === 1 && !primaryGoal) return 'Choose your main goal to continue.';
    if (s === 2) {
      if (!hasTarget) return 'Pick how you want to frame your target.';
      if (hasTarget === 'specific_numbers') {
        const w = targetWeight.trim();
        const b = targetBf.trim();
        const d = targetDate.trim();
        if (!w && !b && !d) return 'Enter at least one target (weight, body fat %, or date).';
      }
    }
    if (s === 3 && !coachingFrequency) return 'Choose how you want to be coached.';
    if (s === 4 && !experienceLevel) return 'Select your experience level.';
    return null;
  };

  const onNext = () => {
    const err = validateStep(step);
    if (err) {
      Alert.alert('Almost there', err);
      return;
    }
    if (step < 6) setStep((step + 1) as Step);
  };

  const onBack = () => {
    if (step > 1) setStep((step - 1) as Step);
    else goHome();
  };

  const buildPayload = useCallback(async () => {
    if (!user?.id || !primaryGoal || !hasTarget || !coachingFrequency || !experienceLevel) return null;
    const pid = await fetchPatientIdForAuthUser(user.id);
    if (!pid) return null;
    const wRaw = targetWeight.trim() ? Number.parseFloat(targetWeight) : NaN;
    const twLbs =
      !Number.isFinite(wRaw) || wRaw <= 0
        ? null
        : targetWeightUnit === 'kg'
          ? wRaw * LB_PER_KG
          : wRaw;
    const tb = targetBf.trim() ? Number.parseFloat(targetBf) : null;
    const td = parseMmDdYyyyToIso(targetDate.trim()) ?? targetDateIso;
    return {
      patientId: pid,
      primary_goal: primaryGoal,
      has_target: hasTarget,
      target_weight: twLbs != null && Number.isFinite(twLbs) ? twLbs : null,
      target_body_fat_pct: Number.isFinite(tb as number) ? tb : null,
      target_date: td,
      coaching_frequency: coachingFrequency,
      experience_level: experienceLevel,
      additional_notes: additionalNotes.trim() || null,
    };
  }, [
    user?.id,
    primaryGoal,
    hasTarget,
    targetWeight,
    targetWeightUnit,
    targetBf,
    targetDate,
    targetDateIso,
    coachingFrequency,
    experienceLevel,
    additionalNotes,
  ]);

  const save = async (opts?: { clearNotes?: boolean; skipTrainingPrefs?: boolean }) => {
    const err = validateStep(1) || validateStep(2) || validateStep(3) || validateStep(4);
    if (err) {
      Alert.alert('Complete earlier steps', err);
      return;
    }
    const payload = await buildPayload();
    if (!payload) {
      Alert.alert('Missing data', 'Could not resolve your patient profile.');
      return;
    }
    const notes = opts?.clearNotes ? null : additionalNotes.trim() || null;
    setSaving(true);
    try {
      const { error } = await upsertPatientGoals({ ...payload, additional_notes: notes });
      if (error) {
        Alert.alert('Could not save', error);
        return;
      }
      if (!opts?.skipTrainingPrefs && user?.id) {
        const pid = payload.patientId;
        const { error: pErr } = await upsertPatientTrainingPrefs({
          patientId: pid,
          training_days_per_week: trainingDays,
          training_style: trainingStyle,
          equipment,
        });
        if (pErr) {
          Alert.alert('Goals saved', `Training preferences could not save: ${pErr}`);
          goHome();
          return;
        }
      }
      goHome();
    } finally {
      setSaving(false);
    }
  };

  const stepTitle = useMemo(() => {
    switch (step) {
      case 1:
        return "What's your main goal?";
      case 2:
        return 'Do you have a specific target?';
      case 3:
        return 'How do you want to be coached?';
      case 4:
        return "What's your experience level?";
      case 5:
        return 'Anything else your coach should know?';
      case 6:
        return 'Training preferences (optional)';
      default:
        return '';
    }
  }, [step]);

  const optionCard = (selected: boolean, onPress: () => void, label: string, keyId: string) => (
    <Pressable
      key={keyId}
      onPress={onPress}
      style={[styles.option, selected && styles.optionOn]}>
      <Text style={[styles.optionText, selected && styles.optionTextOn]}>{label}</Text>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.body}>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 8}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.kicker}>{source === 'post_greeting' ? 'Personalize coaching' : 'My Goals'}</Text>
        <Text style={styles.title}>{stepTitle}</Text>
        <Text style={styles.stepMeta}>Step {step} of 6</Text>

        {step === 1 ? (
          <View style={styles.gap}>
            {PRIMARY_GOAL_IDS.map((id) =>
              optionCard(primaryGoal === id, () => setPrimaryGoal(id), PRIMARY_GOAL_LABELS[id], id),
            )}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.gap}>
            {HAS_TARGET_IDS.map((id) =>
              optionCard(hasTarget === id, () => setHasTarget(id), HAS_TARGET_LABELS[id], id),
            )}
            {hasTarget === 'specific_numbers' ? (
              <View style={styles.fields}>
                <Text style={styles.fieldLabel}>Target weight (optional)</Text>
                <View style={styles.unitRow}>
                  {(['lb', 'kg'] as const).map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => {
                        setTargetWeight((prev) => {
                          const n = Number.parseFloat(prev);
                          if (!Number.isFinite(n) || n <= 0) return prev;
                          if (u === targetWeightUnit) return prev;
                          if (u === 'kg') {
                            return String(Math.round((n / LB_PER_KG) * 10) / 10);
                          }
                          return String(Math.round(n * LB_PER_KG * 10) / 10);
                        });
                        setTargetWeightUnit(u);
                      }}
                      style={[
                        styles.unitChip,
                        targetWeightUnit === u && styles.unitChipOn,
                      ]}>
                      <Text style={[styles.unitChipText, targetWeightUnit === u && styles.unitChipTextOn]}>
                        {u}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={targetWeight}
                  onChangeText={setTargetWeight}
                  placeholder={targetWeightUnit === 'kg' ? 'e.g. 75' : 'e.g. 165'}
                  placeholderTextColor={colors.gray2}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  {...standardTextInputProps({ onSubmit: () => Keyboard.dismiss() })}
                />
                <Text style={styles.fieldLabel}>Target body fat % (optional)</Text>
                <TextInput
                  value={targetBf}
                  onChangeText={setTargetBf}
                  placeholder="e.g. 18"
                  placeholderTextColor={colors.gray2}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  {...standardTextInputProps({ onSubmit: () => Keyboard.dismiss() })}
                />
                <Text style={styles.fieldLabel}>Target date (optional)</Text>
                <TextInput
                  value={targetDate}
                  onChangeText={(t) => {
                    const f = formatDigitsToMmDdYyyy(t);
                    setTargetDate(f);
                    setTargetDateIso(parseMmDdYyyyToIso(f));
                  }}
                  placeholder="MM-DD-YYYY"
                  placeholderTextColor={colors.gray2}
                  autoCapitalize="none"
                  keyboardType="number-pad"
                  style={styles.input}
                  {...standardTextInputProps({ onSubmit: () => Keyboard.dismiss() })}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.gap}>
            {COACHING_FREQUENCY_IDS.map((id) =>
              optionCard(
                coachingFrequency === id,
                () => setCoachingFrequency(id),
                COACHING_FREQUENCY_LABELS[id],
                id,
              ),
            )}
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.gap}>
            {EXPERIENCE_LEVEL_IDS.map((id) =>
              optionCard(
                experienceLevel === id,
                () => setExperienceLevel(id),
                EXPERIENCE_LEVEL_LABELS[id],
                id,
              ),
            )}
          </View>
        ) : null}

        {step === 5 ? (
          <View style={styles.gap}>
            <TextInput
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              placeholder="Injuries, schedule, preferences…"
              placeholderTextColor={colors.gray2}
              multiline
              style={[styles.input, styles.notes]}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <Button
              variant="ghost"
              onPress={() => {
                setAdditionalNotes('');
                setStep(6);
              }}
              disabled={saving}>
              Skip notes — continue
            </Button>
          </View>
        ) : null}

        {step === 6 ? (
          <View style={styles.gap}>
            <Text style={styles.body}>Used for weekly summaries and coach context. You can change this anytime in Profile.</Text>
            <Text style={styles.fieldLabel}>Training days per week (goal)</Text>
            <View style={styles.rowChips}>
              {[3, 4, 5, 6].map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setTrainingDays(d)}
                  style={[styles.smallChip, trainingDays === d && styles.smallChipOn]}>
                  <Text style={[styles.smallChipText, trainingDays === d && styles.smallChipTextOn]}>{d}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Training style</Text>
            {TRAINING_STYLE_IDS.map((id) =>
              optionCard(trainingStyle === id, () => setTrainingStyle(id), TRAINING_STYLE_LABELS[id], `ts-${id}`),
            )}
            <Text style={styles.fieldLabel}>Equipment</Text>
            {EQUIPMENT_IDS.map((id) =>
              optionCard(equipment === id, () => setEquipment(id), EQUIPMENT_LABELS[id], `eq-${id}`),
            )}
            <Button variant="ghost" onPress={() => void save({ skipTrainingPrefs: true })} disabled={saving}>
              Skip training prefs
            </Button>
          </View>
        ) : null}

        <View style={styles.nav}>
          <Button variant="ghost" onPress={onBack} disabled={saving}>
            {step === 1 ? 'Close' : 'Back'}
          </Button>
          {step < 5 ? (
            <Button variant="primary" onPress={onNext}>
              Next
            </Button>
          ) : step === 5 ? (
            <Button variant="primary" onPress={onNext}>
              Next
            </Button>
          ) : (
            <Button variant="primary" loading={saving} onPress={() => void save()}>
              Save
            </Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.dark },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backText: { ...typography.body, color: colors.gold, fontSize: 16 },
  center: { flex: 1, backgroundColor: colors.dark, alignItems: 'center' },
  kicker: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 8,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 6,
  },
  stepMeta: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 13,
    marginBottom: 18,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
  },
  gap: { gap: 10 },
  option: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.darkCard,
  },
  optionOn: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,168,76,0.12)',
  },
  optionText: {
    ...typography.body,
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
  },
  optionTextOn: {
    color: colors.goldLight,
  },
  fields: {
    marginTop: 8,
    gap: 8,
  },
  fieldLabel: {
    ...typography.body,
    color: colors.gray1,
    fontSize: 13,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.white,
    ...typography.body,
    backgroundColor: colors.dark2,
  },
  notes: { minHeight: 120, textAlignVertical: 'top' },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  rowChips: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  smallChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
  },
  smallChipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
  smallChipText: { color: colors.gray1, fontSize: 16 },
  smallChipTextOn: { color: colors.goldLight, fontWeight: '600' },
  unitRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  unitChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldDim,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.dark2,
  },
  unitChipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.15)' },
  unitChipText: { color: colors.gray1, fontSize: 15, textTransform: 'uppercase' },
  unitChipTextOn: { color: colors.goldLight, fontWeight: '600' },
});
