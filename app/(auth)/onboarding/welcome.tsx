import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';

export default function OnboardingWelcome() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Welcome to SonaLife</Text>
      <Text style={styles.body}>
        Your personal health coach from Sona, in your pocket.
      </Text>
      <Button onPress={() => router.push('/(auth)/onboarding/conversation')} variant="primary">
        Let&apos;s get started
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.white,
    marginBottom: 16,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 32,
  },
});
