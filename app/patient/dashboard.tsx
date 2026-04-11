import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';

export default function PatientDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const firstName = profile?.full_name?.split(/\s+/)[0] ?? 'there';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.greeting}>Good morning, {firstName}</Text>
      <Text style={styles.date}>{new Date().toLocaleDateString(undefined, { weekday: 'long' })}</Text>

      <View style={styles.scoreRing}>
        <Text style={styles.scoreLabel}>Vitality</Text>
        <Text style={styles.scoreValue}>—</Text>
        <Text style={styles.scoreHint}>Score loads here (Week 1)</Text>
      </View>

      <Text style={styles.body}>
        Explorer home — dashboard cards, AI nudge, and quick actions ship next in the brief.
      </Text>

      <View style={styles.row}>
        <Pressable onPress={() => router.push('/patient/coach')} style={styles.quick}>
          <Text style={styles.quickText}>AI Coach</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/patient/progress')} style={styles.quick}>
          <Text style={styles.quickText}>Progress</Text>
        </Pressable>
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
    paddingHorizontal: 24,
  },
  greeting: {
    ...typography.h2,
    color: colors.white,
  },
  date: {
    ...typography.body,
    color: colors.gray1,
    marginTop: 4,
    marginBottom: 24,
  },
  scoreRing: {
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  scoreLabel: {
    ...typography.label,
    color: colors.gold,
  },
  scoreValue: {
    fontFamily: 'CormorantGaramond_300Light',
    fontSize: 52,
    color: colors.white,
    marginTop: 4,
  },
  scoreHint: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  quick: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: 'center',
  },
  quickText: {
    ...typography.body,
    color: colors.goldLight,
  },
  signOut: {
    marginTop: 'auto',
    marginBottom: 24,
    alignSelf: 'center',
  },
});
