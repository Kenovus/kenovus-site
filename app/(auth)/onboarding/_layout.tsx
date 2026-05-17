import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome"      options={{ headerShown: false }} />
      <Stack.Screen name="patient-path" options={{ headerShown: false }} />
      <Stack.Screen name="clinic-code"  options={{ headerShown: false }} />
      <Stack.Screen name="conversation" options={{ headerShown: false }} />
      <Stack.Screen name="consumer_setup"    options={{ headerShown: false }} />
      <Stack.Screen name="consumer_persona"  options={{ headerShown: false }} />
      <Stack.Screen name="profile"      options={{ headerShown: false }} />
      <Stack.Screen name="referral"     options={{ headerShown: false }} />
      <Stack.Screen name="ui_mode"      options={{ headerShown: false }} />
      <Stack.Screen name="wearables"    options={{ headerShown: false }} />
      <Stack.Screen name="complete"     options={{ headerShown: false }} />
    </Stack>
  );
}
