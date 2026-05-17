/**
 * Clinic Code Entry
 * Patient enters their Sona clinic code to link their account
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GOLD = '#BF8D36';
const BG   = require('../../../assets/images/sona-light-bg.png');
const LOGO = require('../../../assets/images/sona-logo-light.png');

export default function ClinicCodeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { path } = useLocalSearchParams<{ path: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const isGlp1  = path === 'glp1';
  const isClinic = path === 'clinic';

  const handleContinue = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      Alert.alert('Enter your code', 'Your clinic code is at least 4 characters. Check your welcome email.');
      return;
    }
    setLoading(true);
    // TODO: validate code against Supabase
    setTimeout(() => {
      setLoading(false);
      router.push('/(auth)/onboarding/profile' as never);
    }, 800);
  };

  const handleSkip = () => {
    router.push('/(auth)/onboarding/profile' as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5EDE4' }}>
      <Image source={BG} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32, paddingHorizontal: 28, justifyContent: 'space-between' }}>

        <View>
          <Image source={LOGO} style={{ width: 80, height: 44, marginBottom: 32 }} resizeMode="contain" />

          <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 32, color: '#1a1008', marginBottom: 8 }}>
            {isGlp1 ? 'GLP-1 Program Code' : isClinic ? 'Clinic Access Code' : 'Welcome'}
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#9a826a', lineHeight: 20, marginBottom: 32 }}>
            {isGlp1
              ? 'Enter the code from your Sona GLP-1 welcome packet to link your prescription program.'
              : isClinic
              ? 'Enter the code your Sona provider gave you at your last visit to connect your treatment history.'
              : 'Enter your clinic code if you have one, or skip to continue with general wellness.'}
          </Text>

          {/* Code input */}
          <View style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 16, borderWidth: 1.5, borderColor: code.length > 0 ? GOLD : 'rgba(191,141,54,0.22)',
            paddingHorizontal: 20, paddingVertical: 4, marginBottom: 10,
            shadowColor: '#3d2b1a', shadowOffset: { width:0, height:4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 6 }}>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="e.g. SONA2024"
              placeholderTextColor="rgba(154,130,106,0.6)"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              style={{ fontFamily: 'DMSans_400Regular', fontSize: 22, color: '#1a1008', paddingVertical: 14, letterSpacing: 3, textAlign: 'center' }}
            />
          </View>

          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#9a826a', textAlign: 'center', marginBottom: 28 }}>
            Found in your welcome email or provided by your Sona provider
          </Text>

          {/* Info card for the selected path */}
          {(isGlp1 || isClinic) && (
            <View style={{ backgroundColor: GOLD + '12', borderRadius: 14, borderWidth: 1, borderColor: GOLD + '35', padding: 14, marginBottom: 24 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: GOLD, marginBottom: 4 }}>
                {isGlp1 ? '💉 GLP-1 Program' : '✨ Sona Patient'}
              </Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6b5843' }}>
                {isGlp1
                  ? 'Linking your code enables weekly dose tracking, side-effect monitoring, and direct messaging with your prescriber.'
                  : 'Linking your code imports your treatment history, enables post-procedure check-ins, and connects your care team.'}
              </Text>
            </View>
          )}
        </View>

        <View>
          <Pressable
            onPress={handleContinue}
            style={{ backgroundColor: GOLD, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12,
              shadowColor: GOLD, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width:0, height:5 }, elevation: 8,
              opacity: loading ? 0.7 : 1 }}
            disabled={loading}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: '#fff', fontWeight: '600' }}>
              {loading ? 'Verifying…' : 'Continue →'}
            </Text>
          </Pressable>

          <Pressable onPress={handleSkip} style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#9a826a' }}>
              {isGlp1 || isClinic ? 'Skip for now' : 'Continue without a code'}
            </Text>
          </Pressable>
        </View>

      </View>
    </View>
  );
}
