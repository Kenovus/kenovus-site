import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

type Props = { title: string; step?: string };

export function OnboardingPlaceholder({ title, step }: Props) {
  return (
    <View style={styles.wrap}>
      {step ? (
        <Text style={styles.step}>{step}</Text>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>Placeholder — onboarding module ships in Week 1 per brief.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: 24,
    justifyContent: 'center',
  },
  step: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 12,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
  },
});
