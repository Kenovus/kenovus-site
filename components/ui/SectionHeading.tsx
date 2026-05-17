import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/theme/ThemeProvider';

type Props = {
  title: string;
  subtitle?: string;
};

export function SectionHeading({ title, subtitle }: Props) {
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) =>
  StyleSheet.create({
    wrap: { marginBottom: tokens.spacing.md },
    title: { ...tokens.typography.section, color: tokens.colors.text, marginBottom: 4 },
    subtitle: { ...tokens.typography.secondary, color: tokens.colors.textMuted },
  });
