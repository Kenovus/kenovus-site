import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/designSystem';
import type { EvidenceGrade } from '@/lib/supplementIntelligence';

export function EvidenceRatingBadge({ grade, short }: { grade: EvidenceGrade; short?: boolean }) {
  const tone =
    grade === 'A'
      ? { bg: 'rgba(92,184,138,0.18)', border: colors.success, text: colors.success }
      : grade === 'B'
        ? { bg: 'rgba(201,168,76,0.18)', border: colors.gold, text: colors.goldLight }
        : grade === 'C'
          ? { bg: 'rgba(126,184,214,0.18)', border: colors.warning, text: colors.warning }
          : { bg: 'rgba(232,107,107,0.18)', border: colors.danger, text: colors.danger };
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[styles.text, { color: tone.text }]}>{short ? grade : `Evidence ${grade}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
