import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminMetricGrid } from '@/components/admin/AdminMetricGrid';
import { AdminSection } from '@/components/admin/AdminSection';
import { METRIC_CARD_BORDER, MetricCard } from '@/components/admin/MetricCard';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { fetchSuperAdminOverview } from '@/lib/adminMetrics';
import { useAppTheme } from '@/lib/theme/ThemeProvider';

export default function AdminCommand() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  const { signOut, superAdminViewMode, setSuperAdminViewMode } = useAuth();
  const [loading, setLoading] = useState(true);
  const [askSonaInput, setAskSonaInput] = useState('');
  const [askSonaThread, setAskSonaThread] = useState<Array<{ id: string; q: string; a: string }>>([]);
  const [overview, setOverview] = useState({
    totalMrr: 0,
    activeClinics: 0,
    activePatients: 0,
    avgRevenuePerClinic: 0,
    alerts: ['Loading...'],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await fetchSuperAdminOverview();
      if (error || !data) {
        setOverview((o) => ({ ...o, alerts: [error?.message ?? 'Could not load data'] }));
        return;
      }
      setOverview({
        totalMrr: data.totalMrr,
        activeClinics: data.activeClinics,
        activePatients: data.activePatients,
        avgRevenuePerClinic: data.avgRevenuePerClinic,
        alerts: data.alerts,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAskSona = useCallback(
    (prompt: string) => {
      const raw = prompt.trim();
      if (!raw) return;
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const q = raw.toLowerCase();
      let a = 'Sona Intelligence is active. Try prompts about at-risk patients, utilization trends, or open Clinical Research for full literature synthesis.';
      if (q.includes('average weight loss')) {
        a =
          'Average monthly weight-loss trend is not fully wired in this panel yet. Use Clinical Research for evidence-grade answers while this metric feed is finalized.';
      } else if (q.includes('at risk') || q.includes('dropping off')) {
        a = `At-risk: prioritize patients inactive 5+ days and falling checklist completion. Current alert items in feed: ${overview.alerts.length}.`;
      } else if (q.includes('working')) {
        a = `What’s working: MRR about $${Math.round(overview.totalMrr).toLocaleString()}, ${overview.activePatients} active patients, ${overview.activeClinics} active clinics.`;
      } else if (q.includes('research') || q.includes('semaglutide')) {
        a = 'For cited literature synthesis, open Clinical Research and run your question there for full RAG-style answers.';
      }
      setAskSonaThread((prev) => [...prev, { id, q: raw, a }]);
    },
    [overview],
  );

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 32 }]}>
      <Text style={styles.title}>Admin</Text>
      <Text style={styles.body}>MRR, active clinics, billing calendar, and real-time alerts.</Text>

      <AdminSection title="Dual Access">
        <View style={styles.navActions}>
          <Button
            onPress={() => {
              setSuperAdminViewMode('patient');
              router.replace('/patient/home' as import('expo-router').Href);
            }}
            variant="ghost">
            My Dashboard
          </Button>
          <Text style={styles.modeHint}>Current surface: {superAdminViewMode === 'patient' ? 'patient' : 'admin'}</Text>
        </View>
      </AdminSection>

      <AdminSection title="Core Metrics">
        <AdminMetricGrid>
          <MetricCard label="Total MRR" value={`$${Math.round(overview.totalMrr).toLocaleString()}`} confidence="real" />
          <MetricCard label="Active Clinics" value={String(overview.activeClinics)} confidence="real" />
          <MetricCard label="Active Patients" value={String(overview.activePatients)} confidence="real" />
          <MetricCard
            label="Avg Revenue/Clinic"
            value={`$${Math.round(overview.avgRevenuePerClinic).toLocaleString()}`}
            confidence="real"
          />
        </AdminMetricGrid>
      </AdminSection>

      <AdminSection title="Alerts">
        <View style={styles.alertCard}>
          {overview.alerts.map((a) => (
            <Text key={a} style={styles.alert}>
              {a}
            </Text>
          ))}
        </View>
      </AdminSection>

      <AdminSection title="Navigate">
        <View style={styles.navActions}>
          <Button
            onPress={() => router.push('/admin/provisioning')}
            style={styles.navBtn}
            variant="primary">
            Provisioning Tool
          </Button>
          <Button onPress={() => router.push('/admin/clinics')} style={styles.navBtn} variant="ghost">
            Clinic Directory
          </Button>
          <Button onPress={() => router.push('/admin/finance')} style={styles.navBtn} variant="ghost">
            Financial Intelligence
          </Button>
          <Button onPress={() => router.push('/admin/expenses')} style={styles.navBtn} variant="ghost">
            Expense Tracker
          </Button>
          <Button onPress={() => router.push('/admin/mileage' as never)} style={styles.navBtn} variant="ghost">
            Mileage Tracker
          </Button>
          <Button onPress={() => router.push('/admin/platform')} style={styles.navBtn} variant="ghost">
            Platform Health
          </Button>
          <Button onPress={() => router.push('/admin/pipeline')} style={styles.navBtn} variant="ghost">
            Growth Pipeline
          </Button>
          <Button onPress={() => router.push('/admin/clinical-metrics')} style={styles.navBtn} variant="ghost">
            Clinical Metrics
          </Button>
          <Button onPress={() => router.push('/admin/transformations' as never)} style={styles.navBtn} variant="ghost">
            Transformation Stories
          </Button>
        </View>
      </AdminSection>

      <AdminSection title="Sona Intelligence 🔬">
        <View style={styles.alertCard}>
          <Button onPress={() => router.push('/provider/clinical-insights' as never)} variant="primary">
            Clinical Research
          </Button>
          <Text style={styles.body}>Search medical literature with AI-powered synthesis (full interface).</Text>
          <Text style={styles.subtitle}>Quick prompts (in-app heuristics)</Text>
          <ScrollView style={styles.askThread} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {askSonaThread.map((row) => (
              <View key={row.id} style={styles.askBlock}>
                <Text style={styles.askQ}>You: {row.q}</Text>
                <Text style={styles.askA}>Sona: {row.a}</Text>
              </View>
            ))}
          </ScrollView>
          <TextInput
            value={askSonaInput}
            onChangeText={setAskSonaInput}
            placeholder="Ask Sona about trends, risk, or research..."
            placeholderTextColor={tokens.colors.textCaption}
            style={styles.askInput}
            multiline
          />
          <Button
            onPress={() => {
              runAskSona(askSonaInput);
              setAskSonaInput('');
            }}
            variant="ghost">
            Send
          </Button>
          <View style={styles.chipsRow}>
            {[
              'Which patients are at risk of dropping off?',
              "What's our average weight loss this month?",
              'What does research say about semaglutide and muscle preservation?',
              'What features are patients using most?',
            ].map((chip) => (
              <Pressable
                key={chip}
                style={styles.chip}
                onPress={() => {
                  runAskSona(chip);
                }}>
                <Text style={styles.chipText}>{chip}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.navActions}>
            <Button variant="ghost" onPress={() => runAskSona("What's working?")}>
              What&apos;s working?
            </Button>
            <Button variant="ghost" onPress={() => runAskSona('Which patients are at risk of dropping off?')}>
              At-risk patients
            </Button>
          </View>
        </View>
      </AdminSection>

      <Button onPress={() => void signOut()} style={styles.out} variant="ghost">
        Sign out
      </Button>
      <Button onPress={() => void load()} style={styles.out} variant="ghost" loading={loading}>
        Refresh data
      </Button>
    </ScrollView>
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      backgroundColor: tokens.colors.background,
    },
    content: {
      paddingHorizontal: 20,
    },
    title: {
      ...tokens.typography.h1,
      color: tokens.colors.text,
      marginBottom: 8,
    },
    body: {
      ...tokens.typography.body,
      color: tokens.colors.textMuted,
      marginBottom: 18,
    },
    subtitle: {
      ...tokens.typography.h2,
      color: tokens.colors.text,
      marginBottom: 8,
    },
    alertCard: {
      backgroundColor: tokens.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: METRIC_CARD_BORDER,
      padding: 14,
      gap: 10,
    },
    alert: {
      ...tokens.typography.body,
      color: tokens.colors.text,
      fontSize: 14,
    },
    askInput: {
      ...tokens.typography.body,
      borderWidth: 1,
      borderColor: METRIC_CARD_BORDER,
      borderRadius: 12,
      backgroundColor: tokens.colors.backgroundElevated,
      color: tokens.colors.text,
      paddingHorizontal: 12,
      paddingVertical: 12,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    askThread: { gap: 12, maxHeight: 220, marginBottom: 4 },
    askBlock: {
      gap: 4,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: METRIC_CARD_BORDER,
    },
    askQ: { ...tokens.typography.body, color: tokens.colors.accent, fontSize: 14 },
    askA: { ...tokens.typography.body, color: tokens.colors.text, fontSize: 14, lineHeight: 20 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: METRIC_CARD_BORDER,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: tokens.colors.backgroundElevated,
    },
    chipText: { ...tokens.typography.body, color: tokens.colors.textMuted, fontSize: 15 },
    navActions: {
      gap: 10,
    },
    navBtn: {
      alignSelf: 'stretch',
    },
    modeHint: {
      ...tokens.typography.body,
      color: tokens.colors.textCaption,
      fontSize: 13,
    },
    out: {
      marginTop: 8,
      alignSelf: 'flex-start',
    },
  });
