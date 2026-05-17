import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

type PatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  last_active_at: string | null;
  email: string;
};

function activityStatus(lastActiveAt: string | null): { color: string; label: string } {
  if (!lastActiveAt) return { color: colors.gray2, label: 'Unknown' };
  const days = (Date.now() - new Date(lastActiveAt).getTime()) / (86400 * 1000);
  if (days <= 3) return { color: '#4caf50', label: 'Active' };
  if (days <= 7) return { color: '#ffc107', label: 'Quiet' };
  return { color: '#f44336', label: 'Needs attention' };
}

export default function ProviderDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const clinical = profile?.provider_clinical_access !== false;

  const load = useCallback(async () => {
    if (!profile?.clinic_id) {
      setPatients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, last_active_at, email')
        .eq('clinic_id', profile.clinic_id)
        .order('last_active_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) {
        console.warn('[provider/dashboard]', error.message);
        return;
      }
      setPatients(
        (data ?? []).map((r) => ({
          id: String(r.id),
          first_name: String(r.first_name ?? ''),
          last_name: String(r.last_name ?? ''),
          last_active_at: r.last_active_at != null ? String(r.last_active_at) : null,
          email: String(r.email ?? ''),
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [profile?.clinic_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const digest = () => {
    const need = patients.filter((p) => activityStatus(p.last_active_at).label === 'Needs attention');
    Alert.alert(
      'Morning digest',
      need.length
        ? `${need.length} patient(s) inactive 7+ days. Review the red indicators below.`
        : 'No patients flagged inactive 7+ days. Great job staying engaged.',
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Patients</Text>
      <Text style={styles.subtitle}>
        {profile?.full_name ?? 'Provider'}
        {!clinical ? ' · Aesthetics view (weight / GLP-1 hidden)' : ''}
      </Text>

      <Pressable onPress={digest} style={styles.digest}>
        <Text style={styles.digestText}>Daily digest</Text>
      </Pressable>

      <Pressable style={styles.researchCard} onPress={() => router.push('/provider/clinical-insights' as never)}>
        <Text style={styles.researchTitle}>Clinical Research 🔬</Text>
        <Text style={styles.researchSubtitle}>Ask any clinical question - get cited research answers instantly</Text>
      </Pressable>

      {loading ? <Text style={styles.meta}>Loading roster…</Text> : null}
      {!profile?.clinic_id ? (
        <Text style={styles.warn}>No clinic assigned to this account — patient list unavailable.</Text>
      ) : null}

      <FlatList
        style={{ flex: 1 }}
        data={patients}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={() => void load()}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => {
          const st = activityStatus(item.last_active_at);
          return (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/provider/patient/[id]', params: { id: item.id } } as never)
              }
              style={styles.card}>
              <View style={styles.dotRow}>
                <View style={[styles.dot, { backgroundColor: st.color }]} />
                <Text style={styles.cardTitle}>
                  {item.first_name} {item.last_name}
                </Text>
              </View>
              <Text style={styles.cardMeta}>{item.email}</Text>
              <Text style={styles.cardMeta}>{st.label}</Text>
              <View style={styles.actions}>
                <Text style={styles.action} onPress={() => Alert.alert('Nudge', 'Push notification shell — coming soon.')}>
                  Send nudge
                </Text>
                <Text style={styles.action} onPress={() => Alert.alert('History', 'Full timeline — coming soon.')}>
                  View history
                </Text>
                <Text style={styles.action} onPress={() => Alert.alert('Flag', 'Flagged for follow-up.')}>
                  Flag follow-up
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={styles.links}>
        <Text onPress={() => router.push('/provider/messages')} style={styles.link}>
          Messages (triage)
        </Text>
        <Text onPress={() => router.push('/provider/finance')} style={styles.link}>
          Finance
        </Text>
        <Text onPress={() => router.push('/provider/referrals')} style={styles.link}>
          Referrals
        </Text>
        <Text onPress={() => router.push('/provider/protocols')} style={styles.link}>
          Protocols
        </Text>
        <Text onPress={() => router.push('/provider/clinical-insights' as never)} style={styles.link}>
          Clinical Insights 📚
        </Text>
        <Text onPress={() => router.push('/provider/clinical-metrics' as never)} style={styles.link}>
          Clinical Metrics 📈
        </Text>
      </View>

      <Button onPress={() => void signOut()} style={styles.signOut} variant="ghost">
        Sign out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 20,
  },
  title: {
    ...typography.h1,
    color: colors.white,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 12,
  },
  digest: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
  },
  digestText: { ...typography.body, color: colors.goldLight, fontWeight: '600' },
  researchCard: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 16,
    marginBottom: 16,
  },
  researchTitle: { ...typography.h2, color: colors.white, marginBottom: 8 },
  researchSubtitle: { ...typography.body, color: colors.gray1 },
  meta: { ...typography.body, color: colors.gray2, marginBottom: 8 },
  warn: { ...typography.body, color: colors.warning, marginBottom: 12 },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 16,
    marginBottom: 12,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cardTitle: { ...typography.body, color: colors.white, fontSize: 17, fontWeight: '600' },
  cardMeta: { ...typography.body, color: colors.gray1, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  action: { ...typography.body, color: colors.goldLight, fontSize: 13, textDecorationLine: 'underline' },
  links: { marginTop: 8, gap: 8 },
  link: { ...typography.body, color: colors.goldLight, textDecorationLine: 'underline' },
  signOut: { marginTop: 20 },
});
