import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

/** Unified metric card border (gold, restrained). */
export const METRIC_CARD_BORDER = 'rgba(201,168,76,0.35)' as const;

type Props = {
  label: string;
  value: string;
  delta?: string;
  confidence?: 'real' | 'proxy';
  style?: StyleProp<ViewStyle>;
};

export function MetricCard({ label, value, delta, confidence, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {confidence ? (
          <View style={[styles.badge, confidence === 'real' ? styles.badgeReal : styles.badgeProxy]}>
            <Text style={styles.badgeText}>{confidence === 'real' ? 'REAL' : 'PROXY'}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      {delta ? <Text style={styles.delta}>{delta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: METRIC_CARD_BORDER,
    padding: 14,
    minHeight: 118,
    justifyContent: 'space-between',
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: {
    ...typography.label,
    color: colors.gold,
    fontSize: 12,
    letterSpacing: 2,
    flex: 1,
    flexShrink: 1,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeReal: { borderColor: colors.success, backgroundColor: 'rgba(92,184,138,0.16)' },
  badgeProxy: { borderColor: METRIC_CARD_BORDER, backgroundColor: 'rgba(201,168,76,0.1)' },
  badgeText: { ...typography.label, color: colors.white, fontSize: 9 },
  value: {
    ...typography.h2,
    color: colors.white,
    fontSize: 28,
    lineHeight: 32,
  },
  delta: {
    ...typography.body,
    color: colors.gray1,
    fontSize: 14,
  },
});
