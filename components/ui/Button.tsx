import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type TextStyle,
} from 'react-native';

import { useAppTheme } from '@/lib/theme/ThemeProvider';

type Props = PressableProps & {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  labelStyle?: TextStyle;
};

export function Button({
  children,
  variant = 'primary',
  loading,
  disabled,
  style,
  labelStyle,
  ...rest
}: Props) {
  const { tokens } = useAppTheme();
  const isPrimary = variant === 'primary';
  const styles = createStyles(tokens);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={(state) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        (disabled || loading) && styles.disabled,
        state.pressed && isPrimary && styles.primaryPressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? tokens.colors.background : tokens.colors.textMuted} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelGhost, labelStyle]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) =>
  StyleSheet.create({
    base: {
    minHeight: 56,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: tokens.colors.accent,
    borderWidth: 1,
    borderColor: tokens.colors.accent,
  },
  primaryPressed: {
    opacity: 0.92,
  },
  ghost: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...tokens.typography.button,
  },
  labelPrimary: {
    color: '#241B0A',
  },
  labelGhost: {
    color: tokens.colors.text,
  },
});
