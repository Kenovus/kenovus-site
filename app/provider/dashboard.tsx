import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';

export default function ProviderDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, signOut } = useAuth();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Patients</Text>
      <Text style={styles.subtitle}>
        {profile?.full_name ?? 'Provider'} · status indicators ship Week 1
      </Text>

      <Pressable
        onPress={() => router.push('/provider/patient/demo-patient')}
        style={styles.card}>
        <View style={styles.dotRow}>
          <View style={[styles.dot, styles.dotGreen]} />
          <Text style={styles.cardTitle}>Sample patient</Text>
        </View>
        <Text style={styles.cardMeta}>Tap for clinical record shell</Text>
      </Pressable>

      <View style={styles.links}>
        <Text onPress={() => router.push('/provider/messages')} style={styles.link}>
          Messages (triage)
        </Text>
        <Text onPress={() => router.push('/provider/finance')} style={styles.link}>
          Finance
        </Text>
        <Text onPress={() => router.push('/provider/referrals')} style={styles.link}>
          Referrals
        </Text>
        <Text onPress={() => router.push('/provider/protocols')} style={styles.link}>
          Protocols
        </Text>
      </View>

      <Button onPress={() => void signOut()} style={styles.signOut} variant="ghost">
        Sign out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 20,
  },
  title: {
    ...typography.h1,
    color: colors.white,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colors.darkCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 16,
    marginBottom: 20,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: colors.success,
  },
  cardTitle: {
    ...typography.body,
    color: colors.white,
    fontSize: 17,
  },
  cardMeta: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 13,
  },
  links: {
    gap: 12,
  },
  link: {
    ...typography.body,
    color: colors.goldLight,
    textDecorationLine: 'underline',
  },
  signOut: {
    marginTop: 'auto',
    marginBottom: 24,
    alignSelf: 'center',
  },
});
