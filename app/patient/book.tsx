import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PatientBook() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Book an Appointment</Text>
      <Text style={styles.body}>Contact Sona Medical Aesthetics to schedule your visit.</Text>
      <Pressable onPress={() => void Linking.openURL('tel:+14255551234')} style={styles.cta}>
        <Text style={styles.ctaText}>Call Sona</Text>
      </Pressable>
      <Pressable onPress={() => void Linking.openURL('https://cgnxz.myaestheticrecord.com/online-booking')} style={styles.ctaSecondary}>
        <Text style={styles.ctaSecondaryText}>Visit Website</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#141518', paddingHorizontal: 20 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 10, marginBottom: 16 },
  backText: { color: '#C9A84C', fontSize: 16 },
  title: { color: '#FFFFFF', fontSize: 30, marginBottom: 12 },
  body: { color: '#B6B9C2', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  cta: {
    borderWidth: 1,
    borderColor: '#C9A84C',
    backgroundColor: '#C9A84C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: '#C9A84C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#241B0A', fontSize: 16, fontWeight: '600' },
  ctaSecondaryText: { color: '#C9A84C', fontSize: 16, fontWeight: '600' },
});
