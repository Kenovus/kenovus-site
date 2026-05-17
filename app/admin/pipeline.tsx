import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminSection } from '@/components/admin/AdminSection';
import { colors, typography } from '@/constants/designSystem';

const stages = [
  { stage: 'lead', count: 18, next: 'Follow-up email in 2 days' },
  { stage: 'demo_done', count: 6, next: 'Send ROI sample report' },
  { stage: 'trial', count: 4, next: 'Check activation progress' },
  { stage: 'converting', count: 2, next: 'Finalize billing setup' },
];

export default function AdminPipelineScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: 30 }]}>
      <Text style={styles.title}>Growth Pipeline</Text>
      <Text style={styles.subtitle}>Lead stage, overdue actions, and one-tap follow-up priorities.</Text>

      <AdminSection title="CRM by Stage">
        {stages.map((s) => (
          <View key={s.stage} style={styles.row}>
            <Text style={styles.stage}>{s.stage.replace('_', ' ').toUpperCase()}</Text>
            <Text style={styles.count}>{s.count}</Text>
            <Text style={styles.next}>{s.next}</Text>
          </View>
        ))}
      </AdminSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  content: { paddingHorizontal: 20 },
  title: { ...typography.h1, color: colors.white, marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.gray1, marginBottom: 14 },
  row: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 14,
    marginBottom: 10,
  },
  stage: { ...typography.label, color: colors.gold, marginBottom: 8 },
  count: { ...typography.h2, color: colors.white, marginBottom: 6 },
  next: { ...typography.body, color: colors.gray1, fontSize: 13 },
});
