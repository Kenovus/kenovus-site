import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useAppTheme } from '@/lib/theme/ThemeProvider';

type Props = ViewProps & { children: ReactNode };

export function Card({ children, style, ...rest }: Props) {
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) =>
  StyleSheet.create({
    card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
    ...tokens.shadows.card,
  },
});
