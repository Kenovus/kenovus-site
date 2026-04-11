import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

type Props = { title: string; hint?: string };

export function ScreenPlaceholder({ title, hint }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 8,
  },
  hint: {
    ...typography.body,
    color: colors.gray1,
  },
});
