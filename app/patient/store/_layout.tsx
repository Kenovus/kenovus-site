import { Stack } from 'expo-router';

import { colors } from '@/constants/designSystem';

export default function StoreStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.dark },
        headerTintColor: colors.gold,
        headerTitleStyle: { fontFamily: 'Jost_300Light', color: colors.white },
        contentStyle: { backgroundColor: colors.dark },
      }}
    />
  );
}
