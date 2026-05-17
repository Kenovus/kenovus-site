import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, typography } from '@/constants/designSystem';
import {
  createAuthUserViaEdge,
  createClinic,
  createPatient,
  createProvider,
  seedStarterCoachThread,
  seedStarterProviderMessage,
  seedStarterVitality,
  upsertUserProfile,
} from '@/lib/provisioning';

export default function AdminProvisioningScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const [clinicName, setClinicName] = useState('Sona Aesthetics & Wellness');
  const [clinicSlug, setClinicSlug] = useState('sona');
  const [appName, setAppName] = useState('SonaLife');
  const [clinicEmail, setClinicEmail] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');

  const [providerAuthId, setProviderAuthId] = useState('');
  const [providerFirst, setProviderFirst] = useState('');
  const [providerLast, setProviderLast] = useState('');
  const [providerTitle, setProviderTitle] = useState('CRNA');
  const [providerEmail, setProviderEmail] = useState('');
  const [providerPhone, setProviderPhone] = useState('');
  const [providerRole, setProviderRole] = useState<'clinic_owner' | 'provider'>('clinic_owner');
  const [providerSecondaryClinicPatient, setProviderSecondaryClinicPatient] = useState(false);

  const [patientAuthId, setPatientAuthId] = useState('');
  const [patientFirst, setPatientFirst] = useState('');
  const [patientLast, setPatientLast] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientSex, setPatientSex] = useState<'male' | 'female' | 'other' | 'prefer_not'>('female');
  const [createAuthUsers, setCreateAuthUsers] = useState(false);
  const [providerPassword, setProviderPassword] = useState('');
  const [patientPassword, setPatientPassword] = useState('');
  const [seedVitalityEnabled, setSeedVitalityEnabled] = useState(true);
  const [seedCoachEnabled, setSeedCoachEnabled] = useState(true);
  const [seedProviderInboxEnabled, setSeedProviderInboxEnabled] = useState(true);

  const validate = (): string | null => {
    if (!clinicName.trim() || !clinicSlug.trim() || !appName.trim()) return 'Clinic fields are required.';
    if (!providerFirst.trim() || !providerLast.trim() || !providerEmail.trim()) {
      return 'Provider name and email are required.';
    }
    if (!patientFirst.trim() || !patientLast.trim() || !patientEmail.trim()) {
      return 'Patient name and email are required.';
    }
    if (!createAuthUsers && !providerAuthId.trim()) {
      return 'Provider auth user ID is required when Create Auth Users is off.';
    }
    if (!createAuthUsers && !patientAuthId.trim()) {
      return 'Patient auth user ID is required when Create Auth Users is off.';
    }
    if (createAuthUsers && providerPassword.trim().length < 8) {
      return 'Provider password must be at least 8 characters.';
    }
    if (createAuthUsers && patientPassword.trim().length < 8) {
      return 'Patient password must be at least 8 characters.';
    }
    return null;
  };

  const addLog = (line: string) => setLog((prev) => [line, ...prev].slice(0, 12));

  const runProvisioning = async () => {
    const invalid = validate();
    if (invalid) {
      Alert.alert('Missing fields', invalid);
      return;
    }

    setLoading(true);
    setLog([]);
    try {
      let providerAuthUserId = providerAuthId.trim();
      let patientAuthUserId = patientAuthId.trim();

      if (createAuthUsers) {
        addLog('Creating provider auth user via Edge Function...');
        const providerAuth = await createAuthUserViaEdge({
          email: providerEmail.trim(),
          password: providerPassword,
          role: 'provider',
          fullName: `${providerFirst.trim()} ${providerLast.trim()}`,
        });
        if (!providerAuth.id) {
          Alert.alert(
            'Provider auth create failed',
            providerAuth.error ??
              'Edge function `admin-create-auth-user` unavailable. Deploy it and retry, or disable Create Auth Users and paste auth_user_id manually.',
          );
          return;
        }
        providerAuthUserId = providerAuth.id;
        addLog(`Provider auth user created: ${providerAuthUserId}`);

        addLog('Creating patient auth user via Edge Function...');
        const patientAuth = await createAuthUserViaEdge({
          email: patientEmail.trim(),
          password: patientPassword,
          role: 'clinic_patient',
          fullName: `${patientFirst.trim()} ${patientLast.trim()}`,
        });
        if (!patientAuth.id) {
          Alert.alert(
            'Patient auth create failed',
            patientAuth.error ??
              'Edge function `admin-create-auth-user` unavailable. Deploy it and retry, or disable Create Auth Users and paste auth_user_id manually.',
          );
          return;
        }
        patientAuthUserId = patientAuth.id;
        addLog(`Patient auth user created: ${patientAuthUserId}`);
      }

      addLog('Creating clinic...');
      const clinic = await createClinic({
        name: clinicName.trim(),
        slug: clinicSlug.trim().toLowerCase(),
        app_name: appName.trim(),
        email: clinicEmail.trim() || null,
        phone: clinicPhone.trim() || null,
      });
      if (!clinic.id) {
        Alert.alert('Clinic create failed', clinic.error ?? 'Unknown error');
        return;
      }
      addLog(`Clinic created: ${clinic.id}`);

      addLog('Creating provider...');
      const provider = await createProvider({
        clinic_id: clinic.id,
        auth_user_id: providerAuthUserId,
        first_name: providerFirst.trim(),
        last_name: providerLast.trim(),
        title: providerTitle.trim() || null,
        email: providerEmail.trim(),
        phone: providerPhone.trim() || null,
        is_owner: providerRole === 'clinic_owner',
      });
      if (!provider.id) {
        Alert.alert('Provider create failed', provider.error ?? 'Unknown error');
        return;
      }
      addLog(`Provider created: ${provider.id}`);

      addLog('Creating patient...');
      const patient = await createPatient({
        clinic_id: clinic.id,
        provider_id: provider.id,
        auth_user_id: patientAuthUserId,
        first_name: patientFirst.trim(),
        last_name: patientLast.trim(),
        email: patientEmail.trim(),
        phone: patientPhone.trim() || null,
        sex: patientSex,
      });
      if (!patient.id) {
        Alert.alert('Patient create failed', patient.error ?? 'Unknown error');
        return;
      }
      addLog(`Patient created: ${patient.id}`);

      addLog('Upserting provider user_profile role...');
      const upProvider = await upsertUserProfile({
        auth_user_id: providerAuthUserId,
        clinic_id: clinic.id,
        role: providerRole,
        secondary_role: providerSecondaryClinicPatient ? 'clinic_patient' : null,
        full_name: `${providerFirst.trim()} ${providerLast.trim()}`,
        email: providerEmail.trim(),
      });
      if (upProvider.error) {
        Alert.alert('Provider user_profile failed', upProvider.error);
        return;
      }

      addLog('Upserting patient user_profile role...');
      const upPatient = await upsertUserProfile({
        auth_user_id: patientAuthUserId,
        clinic_id: clinic.id,
        role: 'clinic_patient',
        full_name: `${patientFirst.trim()} ${patientLast.trim()}`,
        email: patientEmail.trim(),
      });
      if (upPatient.error) {
        Alert.alert('Patient user_profile failed', upPatient.error);
        return;
      }

      if (seedVitalityEnabled) {
        addLog('Seeding starter vitality score...');
        const seededVitality = await seedStarterVitality(patient.id);
        if (seededVitality.error) addLog(`Seed vitality failed: ${seededVitality.error}`);
      }
      if (seedCoachEnabled) {
        addLog('Seeding starter AI coach thread...');
        const seededCoach = await seedStarterCoachThread({
          patientId: patient.id,
          clinicId: clinic.id,
        });
        if (seededCoach.error) addLog(`Seed coach failed: ${seededCoach.error}`);
      }
      if (seedProviderInboxEnabled) {
        addLog('Seeding starter provider triage message...');
        const seededProvider = await seedStarterProviderMessage({
          patientId: patient.id,
          clinicId: clinic.id,
        });
        if (seededProvider.error) addLog(`Seed provider inbox failed: ${seededProvider.error}`);
      }

      addLog('Provisioning complete.');
      Alert.alert(
        'Provisioned',
        `Clinic, provider, patient, and role rows were created.\n\nClinic ID: ${clinic.id}\nProvider ID: ${provider.id}\nPatient ID: ${patient.id}\nProvider auth_user_id: ${providerAuthUserId}\nPatient auth_user_id: ${patientAuthUserId}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: 30 }]}>
      <Text style={styles.title}>Provisioning Tool</Text>
      <Text style={styles.subtitle}>
        Create clinic + provider + patient + user_profile roles in one action, with optional auth-user creation and seed data.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.section}>Clinic</Text>
        <Input label="Clinic Name" value={clinicName} onChangeText={setClinicName} />
        <Input label="Clinic Slug" value={clinicSlug} onChangeText={setClinicSlug} />
        <Input label="App Name" value={appName} onChangeText={setAppName} />
        <Input label="Clinic Email (optional)" value={clinicEmail} onChangeText={setClinicEmail} />
        <Input label="Clinic Phone (optional)" value={clinicPhone} onChangeText={setClinicPhone} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Provider</Text>
        <Input label="Provider auth_user_id" value={providerAuthId} onChangeText={setProviderAuthId} />
        <Text style={styles.helper}>
          If Create Auth Users is enabled below, this will be auto-filled from the Edge Function response.
        </Text>
        <Input label="First Name" value={providerFirst} onChangeText={setProviderFirst} />
        <Input label="Last Name" value={providerLast} onChangeText={setProviderLast} />
        <Input label="Title" value={providerTitle} onChangeText={setProviderTitle} />
        <Input label="Email" value={providerEmail} onChangeText={setProviderEmail} />
        <Input label="Phone (optional)" value={providerPhone} onChangeText={setProviderPhone} />
        <Text style={styles.label}>Provider Role</Text>
        <View style={styles.toggleRow}>
          <ToggleChip
            label="Clinic Owner"
            active={providerRole === 'clinic_owner'}
            onPress={() => setProviderRole('clinic_owner')}
          />
          <ToggleChip
            label="Provider"
            active={providerRole === 'provider'}
            onPress={() => setProviderRole('provider')}
          />
        </View>
        <View style={styles.toggleRow}>
          <ToggleChip
            label="Secondary clinic_patient role"
            active={providerSecondaryClinicPatient}
            onPress={() => setProviderSecondaryClinicPatient((v) => !v)}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Patient</Text>
        <Input label="Patient auth_user_id" value={patientAuthId} onChangeText={setPatientAuthId} />
        <Text style={styles.helper}>
          If Create Auth Users is enabled below, this will be auto-filled from the Edge Function response.
        </Text>
        <Input label="First Name" value={patientFirst} onChangeText={setPatientFirst} />
        <Input label="Last Name" value={patientLast} onChangeText={setPatientLast} />
        <Input label="Email" value={patientEmail} onChangeText={setPatientEmail} />
        <Input label="Phone (optional)" value={patientPhone} onChangeText={setPatientPhone} />
        <Input label="Sex (male/female/other/prefer_not)" value={patientSex} onChangeText={(v) => {
          const normalized = v.trim().toLowerCase();
          if (
            normalized === 'male' ||
            normalized === 'female' ||
            normalized === 'other' ||
            normalized === 'prefer_not'
          ) {
            setPatientSex(normalized);
          }
        }} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.section}>Phase 2 Options</Text>
        <Text style={styles.label}>Auth Users</Text>
        <View style={styles.toggleRow}>
          <ToggleChip
            label="Create Auth Users via Edge Function"
            active={createAuthUsers}
            onPress={() => setCreateAuthUsers((v) => !v)}
          />
        </View>
        {createAuthUsers ? (
          <>
            <Input
              label="Provider Password (min 8 chars)"
              value={providerPassword}
              onChangeText={setProviderPassword}
              secure
            />
            <Input
              label="Patient Password (min 8 chars)"
              value={patientPassword}
              onChangeText={setPatientPassword}
              secure
            />
            <Text style={styles.helper}>
              Requires deployed Edge Function: `admin-create-auth-user` (service role on backend).
            </Text>
          </>
        ) : null}

        <Text style={[styles.label, styles.spaced]}>Seed Starter Data</Text>
        <View style={styles.toggleRow}>
          <ToggleChip
            label="Vitality Score"
            active={seedVitalityEnabled}
            onPress={() => setSeedVitalityEnabled((v) => !v)}
          />
          <ToggleChip
            label="AI Coach Thread"
            active={seedCoachEnabled}
            onPress={() => setSeedCoachEnabled((v) => !v)}
          />
          <ToggleChip
            label="Provider Inbox Message"
            active={seedProviderInboxEnabled}
            onPress={() => setSeedProviderInboxEnabled((v) => !v)}
          />
        </View>
      </Card>

      <Button loading={loading} onPress={() => void runProvisioning()} variant="primary">
        Run Provisioning
      </Button>

      <Card style={[styles.card, styles.logCard]}>
        <Text style={styles.section}>Run Log</Text>
        {log.length === 0 ? (
          <Text style={styles.logLine}>No run yet.</Text>
        ) : (
          log.map((line, i) => (
            <Text key={`${line}-${i}`} style={styles.logLine}>
              • {line}
            </Text>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Input({
  label,
  value,
  onChangeText,
  secure,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
}) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.gray2}
        autoCapitalize="none"
        secureTextEntry={secure}
        style={styles.input}
      />
    </View>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  content: { paddingHorizontal: 20 },
  title: { ...typography.h1, color: colors.white, marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.gray1, marginBottom: 14 },
  card: { marginBottom: 14 },
  section: { ...typography.h2, color: colors.white, fontSize: 24, marginBottom: 8 },
  inputWrap: { marginBottom: 10 },
  label: { ...typography.label, color: colors.gold, fontSize: 9, marginBottom: 6 },
  helper: { ...typography.body, color: colors.gray2, fontSize: 12, marginBottom: 8 },
  spaced: { marginTop: 8 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.dark2,
  },
  chipActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(201,168,76,0.2)',
  },
  chipText: {
    ...typography.body,
    color: colors.gray1,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.white,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    backgroundColor: colors.dark2,
    color: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.body,
  },
  logCard: { marginTop: 12 },
  logLine: { ...typography.body, color: colors.gray1, marginBottom: 4 },
});
