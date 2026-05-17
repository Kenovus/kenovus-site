import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { canSyncWearables, isConsumer } from '@/lib/consumerTier';

export default function OnboardingWearables() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, patientOnboardingComplete } = useAuth();
  const consumer = isConsumer(profile);
  const syncLater = consumer && !canSyncWearables(profile);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.step}>Step 5 of 7</Text>
      <Text style={styles.title}>Connect your devices</Text>
      <Text style={styles.body}>
        SonaLife gets smarter when it knows how you&apos;re really doing. Connect your favorite devices
        and we&apos;ll fill in your daily score automatically.
      </Text>

      {syncLater ? (
        <Text style={styles.notice}>
          Wearable sync unlocks on Core and GLP-1+ after you choose your plan. You can upgrade anytime from
          Profile → Plans
          {patientOnboardingComplete ? '' : ' after onboarding'}.
        </Text>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.device}>Apple Health — steps, sleep, heart rate, HRV, weight</Text>
        <Text style={styles.deviceMuted}>Oura · Whoop · Fitbit — OAuth + ingestion available from Profile → Wearables</Text>
      </Card>

      <Button onPress={() => router.replace('/(auth)/onboarding/referral')} variant="primary">
        Continue
      </Button>
      <Button
        onPress={() => router.replace('/(auth)/onboarding/referral')}
        style={styles.skip}
        variant="ghost">
        Skip for now
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 22,
  },
  step: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 10,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 14,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    lineHeight: 22,
    marginBottom: 22,
  },
  notice: {
    ...typography.body,
    color: colors.goldLight,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  card: {
    marginBottom: 24,
    gap: 12,
  },
  device: {
    ...typography.body,
    color: colors.white,
  },
  deviceMuted: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 14,
  },
  skip: {
    marginTop: 12,
  },
});
