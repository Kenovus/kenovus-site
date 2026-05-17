import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { useAppTheme } from '@/lib/theme/ThemeProvider';

export function ThemedInput(props: TextInputProps) {
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  return (
    <TextInput
      {...props}
      style={[styles.input, props.style]}
      placeholderTextColor={props.placeholderTextColor ?? tokens.colors.textCaption}
    />
  );
}

const createStyles = (tokens: ReturnType<typeof useAppTheme>['tokens']) =>
  StyleSheet.create({
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      borderRadius: tokens.radius.md,
      backgroundColor: tokens.colors.surface,
      color: tokens.colors.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...tokens.typography.body,
    },
  });
