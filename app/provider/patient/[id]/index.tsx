import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function ProviderPatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const clinical = profile?.provider_clinical_access !== false;
  const [name, setName] = useState('');
  const [weightLine, setWeightLine] = useState<string | null>(null);
  const [glp1Line, setGlp1Line] = useState<string | null>(null);
  const [checkinLine, setCheckinLine] = useState<string | null>(null);
  const [suppLine, setSuppLine] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<string | null>(null);
  const [sharedPhotos, setSharedPhotos] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: p } = await supabase
      .from('patients')
      .select('first_name, last_name')
      .eq('id', id)
      .maybeSingle();
    setName(`${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Patient');

    if (clinical) {
      const { data: wl } = await supabase
        .from('weight_logs')
        .select('weight_value, unit, logged_at')
        .eq('patient_id', id)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setWeightLine(
        wl ? `Latest: ${wl.weight_value} ${wl.unit} · ${String(wl.logged_at).slice(0, 10)}` : 'No weight logs yet',
      );

      const { data: g } = await supabase
        .from('glp1_records')
        .select('medication_name, dose_amount, injection_date')
        .eq('patient_id', id)
        .order('injection_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      setGlp1Line(
        g
          ? `${g.medication_name ?? 'GLP-1'} ${g.dose_amount ?? ''} · last dose ${g.injection_date ?? '—'}`
          : 'No GLP-1 record',
      );

      const { data: c } = await supabase
        .from('glp1_checkins')
        .select('checkin_date, appetite')
        .eq('patient_id', id)
        .order('checkin_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      setCheckinLine(
        c ? `Last check-in ${c.checkin_date} · mood/appetite score ${c.appetite ?? '—'}` : 'No check-ins yet',
      );
    } else {
      setWeightLine(null);
      setGlp1Line(null);
      setCheckinLine(null);
    }

    const { count } = await supabase
      .from('patient_supplements')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', id);
    setSuppLine(typeof count === 'number' ? `${count} supplement row(s) on file` : 'Supplements: —');

    const { count: fc } = await supabase
      .from('ai_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', id)
      .eq('flagged_for_review', true);
    setFlagged(typeof fc === 'number' && fc > 0 ? `${fc} flagged coach interaction(s)` : 'No flagged AI items');

    const { count: pc } = await supabase
      .from('progress_photos')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', id)
      .eq('is_shared_with_provider', true);
    setSharedPhotos(typeof pc === 'number' ? pc : null);
  }, [id, clinical]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.body}>Patient id: {id}</Text>

      {clinical ? (
        <>
          <Text style={styles.section}>Weight &amp; trend</Text>
          <Text style={styles.value}>{weightLine}</Text>
          <Text style={styles.section}>GLP-1</Text>
          <Text style={styles.value}>{glp1Line}</Text>
          <Text style={styles.section}>Check-in</Text>
          <Text style={styles.value}>{checkinLine}</Text>
        </>
      ) : (
        <Text style={styles.muted}>Clinical metrics hidden for aesthetics-only access.</Text>
      )}

      <Text style={styles.section}>Supplements</Text>
      <Text style={styles.value}>{suppLine}</Text>

      <Text style={styles.section}>AI coach (flagged)</Text>
      <Text style={styles.value}>{flagged}</Text>

      <Text style={styles.section}>Progress photos (shared)</Text>
      <Text style={styles.value}>
        {sharedPhotos != null ? `${sharedPhotos} shared with provider` : '—'}
      </Text>

      <View style={styles.row}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/provider/patient/[id]/glp1',
              params: { id: String(id) },
            } as never)
          }
          style={styles.tab}>
          <Text style={styles.tabText}>GLP-1</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/provider/patient/[id]/inbody',
              params: { id: String(id) },
            } as never)
          }
          style={styles.tab}>
          <Text style={styles.tabText}>InBody</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/provider/patient/[id]/photos',
              params: { id: String(id) },
            } as never)
          }
          style={styles.tab}>
          <Text style={styles.tabText}>Photos</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/provider/clinical-insights',
              params: { patientId: String(id) },
            } as never)
          }
          style={styles.tab}>
          <Text style={styles.tabText}>Clinical Insights 📚</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  title: { ...typography.h2, color: colors.white, marginBottom: 8 },
  body: { ...typography.body, color: colors.gray1, marginBottom: 16 },
  section: { ...typography.label, color: colors.gold, marginTop: 14, marginBottom: 6 },
  value: { ...typography.body, color: colors.white, lineHeight: 22 },
  muted: { ...typography.body, color: colors.gray2, marginVertical: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  tabText: { ...typography.body, color: colors.goldLight },
});
