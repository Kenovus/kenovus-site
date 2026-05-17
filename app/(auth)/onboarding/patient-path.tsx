/**
 * Patient Path Selection
 * GLP-1 program patient vs general wellness patient
 */
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const GOLD = '#BF8D36';
const BG   = require('../../../assets/images/sona-light-bg.png');

const PATHS = [
  {
    id: 'glp1',
    title: 'GLP-1 Program',
    sub: "I'm prescribed semaglutide or tirzepatide through Sona",
    emoji: '💉',
    highlight: 'Includes weekly check-ins, dosage tracking, and GLP-1 symptom monitoring',
    color: '#5BC4DC',
  },
  {
    id: 'clinic',
    title: 'Sona Patient',
    sub: 'I receive aesthetic or wellness treatments at Sona',
    emoji: '✨',
    highlight: 'Includes treatment history, recovery tracking, and skincare routines',
    color: GOLD,
  },
  {
    id: 'consumer',
    title: 'General Wellness',
    sub: "I'm using SonaLife for personal health and nutrition coaching",
    emoji: '🌿',
    highlight: 'Includes AI coaching, nutrition tracking, and progress monitoring',
    color: '#5EC47A',
  },
] as const;

export default function PatientPathScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleSelect = (id: typeof PATHS[number]['id']) => {
    // GLP-1 and clinic patients need a code; general wellness skips to profile
    if (id === 'glp1' || id === 'clinic') {
      router.push({ pathname: '/(auth)/onboarding/clinic-code' as never, params: { path: id } });
    } else {
      router.push({ pathname: '/(auth)/onboarding/profile' as never, params: { path: id } });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5EDE4' }}>
      <Image source={BG} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32, paddingHorizontal: 24 }}>

        <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 32, color: '#1a1008', marginBottom: 6 }}>
          Your Path
        </Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#9a826a', marginBottom: 32 }}>
          Help us personalize your SonaLife experience
        </Text>

        {PATHS.map((p) => (
          <Pressable key={p.id} onPress={() => handleSelect(p.id)}
            style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(191,141,54,0.22)',
              padding: 20, marginBottom: 12,
              shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: p.color + '18', borderWidth: 1, borderColor: p.color + '40', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 22, color: '#1a1008', marginBottom: 4 }}>{p.title}</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6b5843', marginBottom: 10 }}>{p.sub}</Text>
                <View style={{ backgroundColor: p.color + '12', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: p.color + '30' }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: p.color }}>{p.highlight}</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: p.color }}>Select →</Text>
            </View>
          </Pressable>
        ))}

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#9a826a' }}>← Back</Text>
        </Pressable>

      </View>
    </View>
  );
}
