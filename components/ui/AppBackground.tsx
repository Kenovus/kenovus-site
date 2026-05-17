import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
};

export function AppBackground({ children, style, padded = true }: Props) {
  const insets = useSafeAreaInsets();
  const { tokens } = useAppTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: tokens.colors.background },
        padded
          ? {
              paddingTop: insets.top + tokens.spacing.pageTop,
              paddingBottom: insets.bottom + tokens.spacing.pageBottom,
              paddingHorizontal: tokens.spacing.pageX,
            }
          : null,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1 },
});
