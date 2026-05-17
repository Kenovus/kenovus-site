import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography } from '@/constants/designSystem';
type Tile = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; href: string };

const PATIENT_TILES: Tile[] = [
  { key: 'progress', label: 'Progress & Charts', icon: 'trending-up-outline', href: '/patient/progress' },
  { key: 'supplements', label: 'Supplements', icon: 'medkit-outline', href: '/patient/profile/supplements' },
  { key: 'training', label: 'Training Log', icon: 'barbell-outline', href: '/patient/progress/training' },
  { key: 'inbody', label: 'InBody / Body Comp', icon: 'body-outline', href: '/patient/progress/inbody' },
  { key: 'labs', label: 'Labs', icon: 'flask-outline', href: '/patient/progress/labs' },
  { key: 'skincare', label: 'Skincare', icon: 'sparkles-outline', href: '/patient/profile/skincare' },
  { key: 'appointments', label: 'Appointments', icon: 'calendar-outline', href: '/patient/appointments' },
  { key: 'profile', label: 'Profile & Settings', icon: 'person-outline', href: '/patient/profile' },
];

export default function PatientMoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showClinical = true;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
      }}>
      <Text style={styles.title}>More</Text>
      <Text style={styles.sub}>Everything else in one place</Text>

      <View style={styles.grid}>
        {PATIENT_TILES.map((t) => (
          <Pressable key={t.key} style={styles.tile} onPress={() => router.push(t.href as never)}>
            <Ionicons name={t.icon} size={28} color={colors.gold} style={styles.tileIcon} />
            <Text style={styles.tileLabel}>{t.label}</Text>
          </Pressable>
        ))}
        {showClinical ? (
          <Pressable
            style={styles.tile}
            onPress={() => router.push('/provider/clinical-insights' as never)}>
            <Ionicons name="document-text-outline" size={28} color={colors.gold} style={styles.tileIcon} />
            <Text style={styles.tileLabel}>Clinical Research</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 22 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  tile: {
    width: '48%',
    minHeight: 112,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIcon: { marginBottom: 10 },
  tileLabel: {
    ...typography.body,
    color: colors.white,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 20,
  },
});
