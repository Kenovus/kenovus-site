import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/designSystem';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function AdminSection({ title, subtitle, children }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 22,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 4,
    fontSize: 30,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 10,
  },
  body: {
    gap: 10,
  },
});
