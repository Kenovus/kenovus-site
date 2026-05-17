import { Stack } from 'expo-router';
import { useAppTheme } from '@/lib/theme/ThemeProvider';

export default function ProfileStackLayout() {
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: isDark ? '#0D0B08' : '#F5EDE8' },
        headerTintColor: '#BF8D36',
        headerTitleStyle: { fontFamily: 'PTSerif_400Regular', color: tokens.colors.text, fontSize: 17 },
        contentStyle: { backgroundColor: tokens.colors.background },
      }}
    />
  );
}
