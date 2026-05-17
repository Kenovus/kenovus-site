import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';
import { EvidenceRatingBadge } from '@/components/provider/EvidenceRatingBadge';
import type { SupplementEvidenceItem, SupplementStackTemplate } from '@/lib/supplementIntelligence';
import { Button } from '@/components/ui/Button';

export function SupplementStackCard({
  template,
  supplements,
  onApply,
}: {
  template: SupplementStackTemplate;
  supplements: Array<SupplementEvidenceItem & { why: string }>;
  onApply?: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{template.label}</Text>
      <Text style={styles.goal}>{template.goal}</Text>
      {supplements.map((s) => (
        <View key={s.key} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{s.name}</Text>
            <Text style={styles.why}>{s.why}</Text>
          </View>
          <EvidenceRatingBadge grade={s.evidence} />
        </View>
      ))}
      {onApply ? (
        <Button variant="primary" onPress={onApply}>
          Add stack to patient plan
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    backgroundColor: colors.darkCard,
    padding: 12,
    marginBottom: 12,
  },
  title: { ...typography.body, color: colors.white, fontWeight: '700' },
  goal: { ...typography.body, color: colors.gray1, fontSize: 13, marginTop: 4, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center' },
  name: { ...typography.body, color: colors.white, fontSize: 14 },
  why: { ...typography.body, color: colors.gray2, fontSize: 12 },
});
