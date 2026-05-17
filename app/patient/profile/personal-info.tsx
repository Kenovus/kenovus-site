/**
 * Personal Information — name, email, password change.
 */
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  Alert, ImageBackground, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { supabase } from '@/lib/supabase';

const GOLD  = '#BF8D36';
const BG_DARK  = require('../../../assets/images/sona-bg-dark.png');
const BG_LIGHT = require('../../../assets/images/sona-light-bg.png');

export default function PersonalInfoScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const SH   = { shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 4 } as const, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5 };

  const [name, setName]   = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [pwStep, setPwStep] = useState(false);
  const [newPw, setNewPw]   = useState('');

  const saveName = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ full_name: name.trim() })
        .eq('auth_user_id', user.id);
      if (error) throw error;
      Alert.alert('Saved', 'Your name has been updated.');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!newPw || newPw.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      Alert.alert('Password changed', 'Your password has been updated.');
      setNewPw(''); setPwStep(false);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inp = (label: string, value: string, onChange: (v: string) => void, opts?: { secure?: boolean; placeholder?: string }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={opts?.placeholder ?? label}
        placeholderTextColor={MT}
        secureTextEntry={opts?.secure}
        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 12, borderWidth: 1, borderColor: BORD, paddingHorizontal: 14, paddingVertical: 12, color: TX, fontFamily: 'DMSans_400Regular', fontSize: 15 }}
      />
    </View>
  );

  return (
    <ImageBackground source={isDark ? BG_DARK : BG_LIGHT} style={{ flex: 1 }} resizeMode="cover">
      <Stack.Screen options={{ title: 'Personal Information', headerTransparent: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={88}>
        <ScrollView
          contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled">

          {/* Name card */}
          <View style={[{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 18, marginBottom: 14 }, SH]}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 14 }}>NAME</Text>
            {inp('Full Name', name, setName, { placeholder: 'Your full name' })}
            <Pressable
              onPress={() => void saveName()}
              disabled={saving}
              style={{ backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: saving ? 0.6 : 1 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff' }}>
                {saving ? 'Saving…' : 'Save Name'}
              </Text>
            </Pressable>
          </View>

          {/* Email (read-only) */}
          <View style={[{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 18, marginBottom: 14 }, SH]}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 14 }}>EMAIL</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: TX }}>{user?.email ?? '—'}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginTop: 6 }}>Email changes must be done through support.</Text>
          </View>

          {/* Password */}
          <View style={[{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 18 }, SH]}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 14 }}>PASSWORD</Text>
            {!pwStep ? (
              <Pressable
                onPress={() => setPwStep(true)}
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: BORD }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: TX }}>Change Password</Text>
              </Pressable>
            ) : (
              <>
                {inp('New Password', newPw, setNewPw, { secure: true, placeholder: 'Min. 8 characters' })}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => { setPwStep(false); setNewPw(''); }}
                    style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: BORD }}>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={() => void changePassword()} disabled={saving}
                    style={{ flex: 1, backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: saving ? 0.6 : 1 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#fff' }}>{saving ? 'Saving…' : 'Update'}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
