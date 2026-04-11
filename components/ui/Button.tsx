import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';

import { colors, typography } from '@/constants/designSystem';

type Props = PressableProps & {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
};

export function Button({
  children,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...rest
}: Props) {
  const isPrimary = variant === 'primary';
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
        <ActivityIndicator color={isPrimary ? colors.dark : colors.gold} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelGhost]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: colors.gold,
  },
  primaryPressed: {
    opacity: 0.92,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...typography.body,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  labelPrimary: {
    color: colors.dark,
  },
  labelGhost: {
    color: colors.goldLight,
  },
});
