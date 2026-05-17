import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography } from '@/constants/designSystem';

type Props = {
  score: number;
  size?: number;
  subtitle?: string;
  /** Long-form explainer for the (i) button; Vitality model copy. */
  infoText?: string;
};

/**
 * Outer stroke is the ring; inner disk is solid so the score never crosses the gold stroke.
 */
export function VitalityScoreRing({ score, size = 220, subtitle, infoText }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const inner = Math.round(size * 0.72);

  return (
    <View style={styles.wrap}>
      {infoText ? (
        <Pressable
          accessibilityLabel="What is Vitality Score"
          onPress={() => {
            void Alert.alert('Vitality Score', infoText);
          }}
          style={styles.infoBtn}
          hitSlop={8}>
          <Ionicons name="information-circle-outline" size={22} color={colors.gold} />
        </Pressable>
      ) : null}
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}>
      <View
        style={[
          styles.inner,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
          },
        ]}>
        <Text style={styles.label}>Vitality Score</Text>
        <Text style={styles.value}>{clamped}</Text>
        <Text style={styles.sub} numberOfLines={3}>
          {subtitle ?? 'Updated today'}
        </Text>
      </View>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    position: 'relative',
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  infoBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
    padding: 4,
  },
  ring: {
    alignSelf: 'center',
    marginVertical: 8,
    borderWidth: 5,
    borderColor: colors.gold,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    paddingHorizontal: 10,
  },
  label: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 4,
  },
  value: {
    fontFamily: 'PTSerif_400Regular',
    fontSize: 56,
    color: colors.white,
    lineHeight: 58,
  },
  sub: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
});
