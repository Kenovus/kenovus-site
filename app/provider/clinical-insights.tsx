import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ClinicalAnswerCard } from '@/components/provider/ClinicalAnswerCard';
import { StudyCitationCard } from '@/components/provider/StudyCitationCard';
import { SupplementStackCard } from '@/components/provider/SupplementStackCard';
import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import {
  CLINICAL_SPECIALTIES,
  fetchPatientClinicalContext,
  fetchRecentClinicalQueries,
  runClinicalInsightsQuery,
  saveStudyToClinicLibrary,
  type ClinicalInsightResponse,
} from '@/lib/clinicalInsights';
import { buildStack, STACK_TEMPLATES, type StackTemplateId } from '@/lib/supplementIntelligence';
import { upsertPatientSupplement } from '@/lib/patientSupplements';

export default function ProviderClinicalInsights() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{ patientId?: string }>();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(['GLP-1 & Weight Loss']);
  const [withPatient, setWithPatient] = useState(false);
  const [patientContext, setPatientContext] = useState<Awaited<ReturnType<typeof fetchPatientClinicalContext>>>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ClinicalInsightResponse | null>(null);
  const [recent, setRecent] = useState<Array<{ id: string; query_text: string; created_at: string; response_json: ClinicalInsightResponse }>>([]);
  const [stackId, setStackId] = useState<StackTemplateId>('glp1_muscle_preservation');
  const canClinical = profile?.provider_clinical_access !== false;

  const providerId = user?.id ?? null;
  const clinicId = profile?.clinic_id ?? null;
  const currentPatientId = (params.patientId as string | undefined) ?? null;

  const loadRecent = useCallback(async () => {
    if (!providerId) return;
    setRecent(await fetchRecentClinicalQueries(providerId));
  }, [providerId]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    const pid = currentPatientId;
    if (!withPatient || !pid) {
      setPatientContext(null);
      return;
    }
    void (async () => {
      setPatientContext(await fetchPatientClinicalContext(pid));
    })();
  }, [withPatient, currentPatientId]);

  const onSubmit = async () => {
    if (!providerId || !query.trim()) return;
    setLoading(true);
    try {
      const { response: r, error } = await runClinicalInsightsQuery({
        providerId,
        clinicId,
        queryText: query.trim(),
        specialties: selected,
        patientContext: withPatient ? patientContext : null,
      });
      if (error) Alert.alert('Search failed', error);
      setResponse(r);
      await loadRecent();
    } finally {
      setLoading(false);
    }
  };

  const stack = useMemo(() => buildStack(stackId), [stackId]);
  const applyStack = async () => {
    if (!currentPatientId || !stack) {
      Alert.alert('Patient required', 'Open this screen from a patient chart to apply a stack.');
      return;
    }
    for (const s of stack.supplements) {
      await upsertPatientSupplement({
        patientId: currentPatientId,
        presetKey: s.key,
        dose: s.dosingRange,
        frequency: 'daily',
        isActive: true,
      });
    }
    Alert.alert('Stack applied', 'Supplements were added to this patient plan.');
  };

  if (!canClinical) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Clinical Insights' }} />
        <Text style={styles.blocked}>Clinical Insights is hidden for aesthetics-only access.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <Stack.Screen options={{ title: 'Clinical Insights' }} />
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Clinical Insights</Text>
      <Text style={styles.sub}>Evidence-based research synthesis for provider decisions.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Ask a clinical question...</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. GLP-1 + resistance training muscle preservation data in women 45+"
          placeholderTextColor={colors.gray2}
          multiline
          style={styles.input}
        />
        <View style={styles.chips}>
          {CLINICAL_SPECIALTIES.map((s) => {
            const on = selected.includes(s);
            return (
              <Pressable
                key={s}
                onPress={() =>
                  setSelected((p) => (on ? p.filter((x) => x !== s) : [...p, s]))
                }
                style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.row}>
          <Text style={styles.switchLabel}>Ask about current patient</Text>
          <Switch
            value={withPatient}
            disabled={!currentPatientId}
            onValueChange={setWithPatient}
            trackColor={{ false: colors.dark2, true: 'rgba(201,168,76,0.45)' }}
            thumbColor={withPatient ? colors.gold : colors.gray2}
          />
        </View>
        <Button onPress={() => void onSubmit()} loading={loading} variant="primary">
          Search Literature
        </Button>
      </View>

      {response ? (
        <>
          <ClinicalAnswerCard response={response} />
          <Text style={styles.section}>Studies</Text>
          {response.studies.map((s, i) => (
            <StudyCitationCard
              key={`${i}-${s.title}`}
              idx={i}
              study={s}
              onBookmark={
                clinicId
                  ? () => {
                      void (async () => {
                        const err = await saveStudyToClinicLibrary({
                          clinicId,
                          providerId: providerId!,
                          study: s,
                        });
                        if (err) Alert.alert('Could not bookmark', err);
                        else Alert.alert('Saved', 'Study bookmarked to clinic library.');
                      })();
                    }
                  : undefined
              }
            />
          ))}
          <View style={styles.card}>
            <Text style={styles.label}>Share summary with patient (plain language)</Text>
            <Text style={styles.patientText}>{response.simplified_patient_version}</Text>
            <View style={styles.row}>
              <Button
                variant="ghost"
                onPress={() => Alert.alert('Export', 'PDF export hook ready for implementation.')}>
                Export PDF
              </Button>
              <Button
                variant="ghost"
                onPress={() => Alert.alert('Shared', 'Patient-friendly summary copied for sharing.')}>
                Share with patient
              </Button>
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.section}>Supplement Stack Builder</Text>
        <View style={styles.chips}>
          {STACK_TEMPLATES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setStackId(t.id)}
              style={[styles.chip, stackId === t.id && styles.chipOn]}>
              <Text style={[styles.chipText, stackId === t.id && styles.chipTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        {stack ? (
          <SupplementStackCard template={stack.template} supplements={stack.supplements} onApply={applyStack} />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Recent queries</Text>
        {recent.length === 0 ? (
          <Text style={styles.meta}>No recent searches.</Text>
        ) : (
          recent.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                setQuery(r.query_text);
                setResponse(r.response_json);
              }}
              style={styles.recentRow}>
              <Text style={styles.recentTitle}>{r.query_text}</Text>
              <Text style={styles.meta}>{new Date(r.created_at).toLocaleString()}</Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backText: { ...typography.body, color: colors.gold, fontSize: 16 },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    backgroundColor: colors.darkCard,
    padding: 12,
    marginBottom: 12,
  },
  label: { ...typography.label, color: colors.gold, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    backgroundColor: colors.dark2,
    color: colors.white,
    minHeight: 90,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.dark2,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.2)' },
  chipText: { color: colors.gray1, fontSize: 12 },
  chipTextOn: { color: colors.goldLight, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  switchLabel: { ...typography.body, color: colors.white, fontSize: 14, flex: 1 },
  section: { ...typography.h2, color: colors.white, fontSize: 22, marginBottom: 8 },
  patientText: { ...typography.body, color: colors.gray1, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  recentRow: {
    borderTopWidth: 1,
    borderTopColor: colors.goldDim,
    paddingVertical: 8,
  },
  recentTitle: { ...typography.body, color: colors.white, fontSize: 14 },
  meta: { ...typography.body, color: colors.gray2, fontSize: 12 },
  blocked: { ...typography.body, color: colors.gray1, margin: 20 },
});
