/**
 * First-time clinic patient setup. Shown when `patients.onboarding_complete` is false.
 * Completing the flow sets onboarding_complete and routes to Guided home.
 */
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { bootstrapPatientNotifications } from '@/lib/notifications/patientNotifications';
import {
  fetchPatientIdForAuthUser,
  setPatientOnboardingComplete,
  setUserUiMode,
} from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';
import { syncAuthProfile } from '@/lib/syncAuthProfile';
import { insertWeightLog } from '@/lib/weightLogs';
import {
  ACTIVITY_LEVEL_LABELS,
  ACTIVITY_LEVEL_ORDER,
  type ActivityLevelId,
  type BiologicalSexForBmr,
} from '@/lib/nutritionMacroTargets';
import { recomputeAndPersistPatientTdee } from '@/lib/patientMetabolicProfile';

const STEPS = 10;

export default function ClinicPatientOnboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [dob, setDob] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [startWeight, setStartWeight] = useState('');
  const [glp1Yes, setGlp1Yes] = useState<boolean | null>(null);
  const [glpMed, setGlpMed] = useState('');
  const [glpDose, setGlpDose] = useState('');
  const [bioSex, setBioSex] = useState<BiologicalSexForBmr | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevelId | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPatient = useCallback(async () => {
    if (!user) return;
    const pid = await fetchPatientIdForAuthUser(user.id);
    setPatientId(pid);
    if (!pid) return;
    const { data } = await supabase
      .from('patients')
      .select('date_of_birth, height_inches, biological_sex, activity_level, onboarding_complete')
      .eq('id', pid)
      .maybeSingle();
    if (data?.onboarding_complete === true) {
      router.replace('/patient/home' as Href);
      return;
    }
    if (data?.date_of_birth) setDob(String(data.date_of_birth));
    if (data?.height_inches != null) setHeightIn(String(data.height_inches));
    if (data?.biological_sex === 'male' || data?.biological_sex === 'female') setBioSex(data.biological_sex);
    if (data?.activity_level) setActivityLevel(data.activity_level as ActivityLevelId);
  }, [user, router]);

  useEffect(() => {
    void loadPatient();
  }, [loadPatient]);

  const saveDemographics = async () => {
    if (!patientId) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          date_of_birth: dob || null,
          height_inches: heightIn ? Number(heightIn) : null,
          biological_sex: bioSex,
          activity_level: activityLevel,
        })
        .eq('id', patientId);
      if (error) Alert.alert('Save failed', error.message);
      else {
        await recomputeAndPersistPatientTdee(patientId);
        setStep(2);
      }
    } finally {
      setBusy(false);
    }
  };

  const saveStartingWeight = async () => {
    if (!patientId) return;
    const w = Number(startWeight);
    if (!Number.isFinite(w) || w <= 0) {
      Alert.alert('Weight', 'Enter your starting weight in pounds.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await insertWeightLog({ patientId, weightValue: w, unit: 'lb' });
      if (error) {
        Alert.alert('Save failed', error);
        return;
      }
      await recomputeAndPersistPatientTdee(patientId);
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const saveGlp1 = async () => {
    if (!patientId || glp1Yes !== true) {
      setStep(5);
      return;
    }
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('glp1_records').insert({
        patient_id: patientId,
        medication_name: glpMed || 'GLP-1',
        dose_amount: glpDose || null,
        injection_date: today,
      });
      if (error) console.warn('[clinic-onboarding] glp1 insert', error.message);
      setStep(5);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!user || !patientId) return;
    setBusy(true);
    try {
      const { error } = await setPatientOnboardingComplete(patientId, true);
      if (error) {
        Alert.alert('Could not finish', error.message);
        return;
      }
      await syncAuthProfile(user, { keepProfileReady: true });
      await refreshProfile();
      router.replace('/patient/home' as Href);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 40, paddingHorizontal: 22 }}>
      <Text style={styles.brand}>SonaLife</Text>
      <Text style={styles.step}>
        Step {step + 1} of {STEPS}
      </Text>

      {step === 0 ? (
        <View>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.body}>Your clinic uses SonaLife to stay close between visits. This takes a few minutes.</Text>
          <Button onPress={() => setStep(1)} variant="primary">
            Continue
          </Button>
        </View>
      ) : null}

      {step === 1 ? (
        <View>
          <Text style={styles.title}>Confirm basics</Text>
          <Text style={styles.label}>Name on file</Text>
          <Text style={styles.value}>{profile?.full_name ?? '—'}</Text>
          <Text style={styles.label}>Date of birth (YYYY-MM-DD)</Text>
          <TextInput value={dob} onChangeText={setDob} placeholder="1990-04-12" style={styles.input} placeholderTextColor={colors.gray2} />
          <Text style={styles.label}>Height (inches)</Text>
          <TextInput value={heightIn} onChangeText={setHeightIn} keyboardType="decimal-pad" placeholder="68" style={styles.input} placeholderTextColor={colors.gray2} />
          <Text style={styles.label}>Biological sex (for calorie &amp; macro math)</Text>
          <View style={styles.row}>
            {(['male', 'female'] as const).map((s) => (
              <Pressable key={s} onPress={() => setBioSex(s)} style={[styles.chip, bioSex === s && styles.chipOn]}>
                <Text style={[styles.chipText, bioSex === s && styles.chipTextOn]}>{s === 'male' ? 'Male' : 'Female'}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Typical activity (TDEE)</Text>
          {ACTIVITY_LEVEL_ORDER.map((id) => (
            <Pressable
              key={id}
              onPress={() => setActivityLevel(id)}
              style={[styles.activityRow, activityLevel === id && styles.activityRowOn]}>
              <Text style={[styles.activityText, activityLevel === id && styles.activityTextOn]}>
                {ACTIVITY_LEVEL_LABELS[id]}
              </Text>
            </Pressable>
          ))}
          <Button loading={busy} onPress={() => void saveDemographics()} variant="primary">
            Save & continue
          </Button>
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text style={styles.title}>Starting weight</Text>
          <Text style={styles.body}>Your first weight entry anchors progress charts.</Text>
          <TextInput value={startWeight} onChangeText={setStartWeight} keyboardType="decimal-pad" placeholder="e.g. 185" style={styles.input} placeholderTextColor={colors.gray2} />
          <Button loading={busy} onPress={() => void saveStartingWeight()} variant="primary">
            Save & continue
          </Button>
        </View>
      ) : null}

      {step === 3 ? (
        <View>
          <Text style={styles.title}>Goal setup</Text>
          <Text style={styles.body}>Open My Goals to set your primary goal and coaching preferences, then return here.</Text>
          <Button onPress={() => router.push('/patient/profile/my-goals' as never)} variant="primary">
            Open My Goals
          </Button>
          <Button onPress={() => setStep(4)} variant="ghost" style={{ marginTop: 12 }}>
            I&apos;m done with goals
          </Button>
        </View>
      ) : null}

      {step === 4 ? (
        <View>
          <Text style={styles.title}>GLP-1</Text>
          <Text style={styles.body}>Are you currently on a GLP-1 medication?</Text>
          <View style={styles.row}>
            <Button onPress={() => setGlp1Yes(true)} variant={glp1Yes === true ? 'primary' : 'ghost'}>
              Yes
            </Button>
            <Button onPress={() => setGlp1Yes(false)} variant={glp1Yes === false ? 'primary' : 'ghost'}>
              No
            </Button>
          </View>
          {glp1Yes === true ? (
            <>
              <Text style={styles.label}>Medication</Text>
              <TextInput value={glpMed} onChangeText={setGlpMed} placeholder="e.g. Semaglutide" style={styles.input} placeholderTextColor={colors.gray2} />
              <Text style={styles.label}>Dose</Text>
              <TextInput value={glpDose} onChangeText={setGlpDose} placeholder="e.g. 0.5 mg" style={styles.input} placeholderTextColor={colors.gray2} />
            </>
          ) : null}
          <Button loading={busy} onPress={() => void saveGlp1()} variant="primary" style={{ marginTop: 16 }}>
            Continue
          </Button>
        </View>
      ) : null}

      {step === 5 ? (
        <View>
          <Text style={styles.title}>Supplements</Text>
          <Text style={styles.body}>Log what you take today — you can refine anytime.</Text>
          <Button onPress={() => router.push('/patient/profile/supplements' as never)} variant="primary">
            Supplement setup
          </Button>
          <Button onPress={() => setStep(6)} variant="ghost" style={{ marginTop: 12 }}>
            Skip for now
          </Button>
        </View>
      ) : null}

      {step === 6 ? (
        <View>
          <Text style={styles.title}>Wearables</Text>
          <Text style={styles.body}>Optional — connect Apple Health or compatible wearables from Profile later.</Text>
          <Button onPress={() => setStep(7)} variant="primary">
            Skip
          </Button>
        </View>
      ) : null}

      {step === 7 ? (
        <View>
          <Text style={styles.title}>Home layout</Text>
          <Text style={styles.body}>Guided keeps daily steps upfront. Self-Guided shows all tabs.</Text>
          <Button
            loading={busy}
            onPress={async () => {
              if (!user) return;
              setBusy(true);
              try {
                const { error: e } = await setUserUiMode(user.id, 'guided');
                if (e) Alert.alert('Could not save', e.message);
                else {
                  await refreshProfile();
                  setStep(8);
                }
              } finally {
                setBusy(false);
              }
            }}
            variant="primary">
            Guided (recommended)
          </Button>
          <Button
            loading={busy}
            onPress={async () => {
              if (!user) return;
              setBusy(true);
              try {
                const { error: e } = await setUserUiMode(user.id, 'explorer');
                if (e) Alert.alert('Could not save', e.message);
                else {
                  await refreshProfile();
                  setStep(8);
                }
              } finally {
                setBusy(false);
              }
            }}
            variant="ghost"
            style={{ marginTop: 10 }}>
            Self-Guided
          </Button>
        </View>
      ) : null}

      {step === 8 ? (
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.body}>Allow reminders for check-ins, streaks, and gentle coach nudges.</Text>
          <Button
            onPress={async () => {
              if (user?.id) await bootstrapPatientNotifications(user.id);
              setStep(9);
            }}
            variant="primary">
            Enable notifications
          </Button>
          <Button onPress={() => setStep(9)} variant="ghost" style={{ marginTop: 10 }}>
            Not now
          </Button>
        </View>
      ) : null}

      {step === 9 ? (
        <View>
          <Text style={styles.title}>You&apos;re in</Text>
          <Text style={styles.body}>Welcome to your dashboard. Consistency beats intensity.</Text>
          <Button loading={busy} onPress={() => void finish()} variant="primary">
            Go to home
          </Button>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  brand: { ...typography.label, color: colors.gold, letterSpacing: 4, marginBottom: 8 },
  step: { ...typography.body, color: colors.gray2, marginBottom: 16 },
  title: { ...typography.h2, color: colors.white, marginBottom: 10 },
  body: { ...typography.body, color: colors.gray1, marginBottom: 16, lineHeight: 22 },
  label: { ...typography.label, color: colors.goldLight, marginTop: 10, marginBottom: 6 },
  value: { ...typography.body, color: colors.white, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    padding: 12,
    color: colors.white,
    marginBottom: 12,
    backgroundColor: colors.darkCard,
  },
  row: { flexDirection: 'row', gap: 12, marginVertical: 12, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.12)' },
  chipText: { color: colors.gray1, fontSize: 15 },
  chipTextOn: { color: colors.goldLight, fontWeight: '600' },
  activityRow: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.darkCard,
  },
  activityRowOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.1)' },
  activityText: { color: colors.white, fontSize: 15 },
  activityTextOn: { color: colors.goldLight },
});
