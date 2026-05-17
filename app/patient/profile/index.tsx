import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme/ThemeProvider';

const GOLD  = '#BF8D36';
const BG_LIGHT = require('../../../assets/images/sona-light-bg.png');
const BG_DARK  = require('../../../assets/images/sona-bg-dark.png');
const LOGO_LIGHT = require('../../../assets/images/sona-logo-light.png');
const LOGO_GOLD  = require('../../../assets/images/sona-logo-gold.png');
const MODEL = require('../../../assets/images/model-card.png');

// ── Section component (iOS-style grouped card) ────────────────────────────────
function Section({ title, children, CARD, BORD }: {
  title?: string; children: React.ReactNode; CARD: string; BORD: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      {title && (
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, letterSpacing: 1.4,
          color: 'rgba(154,130,106,0.85)', marginBottom: 6, paddingHorizontal: 4 }}>
          {title}
        </Text>
      )}
      <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, overflow: 'hidden',
        shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 }}>
        {children}
      </View>
    </View>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────
function Row({ label, sub, value, onPress, last, TX, MT, BORD, rightEl }: {
  label: string; sub?: string; value?: string; onPress?: () => void;
  last?: boolean; TX: string; MT: string; BORD: string; rightEl?: React.ReactNode;
}) {
  const Inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: sub ? 12 : 14,
      borderTopWidth: last === false ? 0 : StyleSheet.hairlineWidth, borderTopColor: BORD }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: TX }}>{label}</Text>
        {sub && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginTop: 2 }}>{sub}</Text>}
      </View>
      {rightEl ?? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {value && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT }}>{value}</Text>}
          {onPress && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 18, color: MT }}>›</Text>}
        </View>
      )}
    </View>
  );
  return onPress
    ? <Pressable onPress={onPress}>{Inner}</Pressable>
    : Inner;
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ProfileIndex() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, superAdminViewMode, setSuperAdminViewMode } = useAuth();
  const { tokens, resolvedTheme, themeMode, setThemeMode } = useAppTheme();
  const [focusMode, setFocusModeState] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem('focus_mode').then((v) => setFocusModeState(v === '1'));
    // Load saved avatar URL from local cache
    void AsyncStorage.getItem('profile_avatar_uri').then((v) => { if (v) setAvatarUri(v); });
  }, []);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAvatarUploading(true);
    try {
      // Upload to Supabase Storage
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        const ext = asset.uri.split('.').pop() ?? 'jpg';
        const path = `${userId}/avatar.${ext}`;
        const fileBody = { uri: asset.uri, type: `image/${ext}`, name: `avatar.${ext}` };
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, fileBody as unknown as Blob, { upsert: true, contentType: `image/${ext}` });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;
          await supabase.from('user_profiles').update({ avatar_url: publicUrl }).eq('auth_user_id', userId);
          setAvatarUri(publicUrl);
          await AsyncStorage.setItem('profile_avatar_uri', publicUrl);
        } else {
          // Fall back to local-only
          setAvatarUri(asset.uri);
          await AsyncStorage.setItem('profile_avatar_uri', asset.uri);
        }
      } else {
        setAvatarUri(asset.uri);
        await AsyncStorage.setItem('profile_avatar_uri', asset.uri);
      }
    } catch {
      setAvatarUri(asset.uri);
      await AsyncStorage.setItem('profile_avatar_uri', asset.uri);
    } finally {
      setAvatarUploading(false);
    }
  };
  const toggleFocusMode = async (v: boolean) => {
    setFocusModeState(v);
    await AsyncStorage.setItem('focus_mode', v ? '1' : '0');
  };
  const isDark = resolvedTheme === 'dark';

  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.84)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;

  const name = profile?.full_name ?? 'Lance Kennedy';
  const role = profile?.role;
  const tier = (profile as { consumer_tier?: string })?.consumer_tier;

  // Tier badge label
  const tierLabel =
    role === 'clinic_patient' ? 'GLP-1 Program'
    : tier === 'glp1_plus'   ? 'GLP-1+'
    : tier === 'core'        ? 'Core'
    : tier === 'free'        ? 'Free'
    : 'Patient';

  return (
    <ImageBackground source={isDark ? BG_DARK : BG_LIGHT} style={{ flex: 1 }} resizeMode="cover">
      <ScrollView
        contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 24 }}>
          {/* Avatar — tap to change */}
          <Pressable onPress={() => void pickAvatar()} style={{ marginBottom: 12 }}>
            <View style={{ width: 90, height: 90, borderRadius: 45, overflow: 'hidden',
              borderWidth: 3, borderColor: GOLD,
              shadowColor: GOLD, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: 90, height: 90 }} resizeMode="cover"/>
              ) : (
                <Image source={MODEL} style={{ width: 170, height: 227, marginTop: -55, marginLeft: -50 }} resizeMode="cover"/>
              )}
            </View>
            {/* Camera badge */}
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
              backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: isDark ? '#100E0B' : '#F5EFE8' }}>
              <Text style={{ fontSize: 13 }}>{avatarUploading ? '…' : '📷'}</Text>
            </View>
          </Pressable>

          {/* Name */}
          <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 28, color: TX, marginBottom: 4 }}>
            {name}
          </Text>

          {/* Tier badge */}
          <View style={{ backgroundColor: GOLD + '22', borderRadius: 999, borderWidth: 1, borderColor: GOLD + '55',
            paddingHorizontal: 14, paddingVertical: 4, marginBottom: 12 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: GOLD }}>✦ {tierLabel}</Text>
          </View>

          {/* SONA logo */}
          <Image source={isDark ? LOGO_GOLD : LOGO_LIGHT} style={{ width: 60, height: 30 }} resizeMode="contain" />
        </View>

        {/* ── Appointments ────────────────────────────────────────────── */}
        <Section title="APPOINTMENTS" CARD={CARD} BORD={BORD}>
          <Row label="Upcoming Appointments"   sub="May 22 · Botox — Dr. Simi Batra"          onPress={() => router.push('/patient/profile/appointments-log' as never)}       last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="Book New Appointment"    sub="Opens Aesthetic Record"                    onPress={() => { void import('react-native').then(m => m.Linking.openURL('https://cgnxz.myaestheticrecord.com/online-booking')); }}   last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="Post-Treatment Check-In" sub="72-hr recovery follow-up"                 onPress={() => router.push('/patient/check-in' as never)}                       last={true}  TX={TX} MT={MT} BORD={BORD} />
        </Section>

        {/* ── Account ─────────────────────────────────────────────────── */}
        <Section title="ACCOUNT" CARD={CARD} BORD={BORD}>
          <Row label="Personal Information"  sub="Name, email, password"                    onPress={() => router.push('/patient/profile/personal-info' as never)}         last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="Metabolic Profile"     sub="Height, weight, TDEE, activity level"     onPress={() => router.push('/patient/profile/metabolic-profile' as never)}      last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="My Goals"              sub="Primary goal, target weight"               onPress={() => router.push('/patient/profile/my-goals' as never)}               last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="Referrals"             sub="Invite friends, earn rewards"              onPress={() => router.push('/patient/profile/referrals' as never)}              last={true}  TX={TX} MT={MT} BORD={BORD} />
        </Section>

        {/* ── Health & Wellness ──────────────────────────────────────── */}
        <Section title="HEALTH & WELLNESS" CARD={CARD} BORD={BORD}>
          <Row label="Training Phase"        sub="Bulk, cut, maintenance"                   onPress={() => router.push('/patient/profile/training-phase' as never)}         last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="Supplements"           sub="Daily stack and timing"                   onPress={() => router.push('/patient/profile/supplements' as never)}            last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="Skincare Routine"      sub="AM/PM protocol tracker"                   onPress={() => router.push('/patient/profile/skincare' as never)}               last={false} TX={TX} MT={MT} BORD={BORD} />
          {role === 'consumer' && (
            <Row label="Wearables"           sub="Apple Health, Oura, Whoop"                onPress={() => router.push('/patient/profile/wearables' as never)}             last={true}  TX={TX} MT={MT} BORD={BORD} />
          )}
          {role !== 'consumer' && (
            <Row label="Wearables"           sub="Apple Health, Oura, Whoop"                onPress={() => router.push('/patient/profile/wearables' as never)}             last={true}  TX={TX} MT={MT} BORD={BORD} />
          )}
        </Section>

        {/* ── Sona AI ─────────────────────────────────────────────────── */}
        <Section title="SONA AI" CARD={CARD} BORD={BORD}>
          <Row label="Voice & Read-Aloud"    sub="Microphone, auto-speak settings"          onPress={() => router.push('/patient/profile/my-coach-settings' as never)}      last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="Weekly Summaries"      sub="Your progress narrative"                  onPress={() => router.push('/patient/profile/weekly-summaries' as never)}        last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="Clinical Research"     sub="Evidence-based literature, cited sources" onPress={() => router.push('/patient/clinical-research' as never)}              last={true}  TX={TX} MT={MT} BORD={BORD} />
        </Section>

        {/* ── Appearance ──────────────────────────────────────────────── */}
        <Section title="APPEARANCE" CARD={CARD} BORD={BORD}>
          <Row label="Dark Mode" last={false} TX={TX} MT={MT} BORD={BORD}
            rightEl={
              <Switch
                value={isDark}
                onValueChange={(v) => void setThemeMode(v ? 'dark' : 'light')}
                trackColor={{ false: BORD, true: GOLD + '60' }}
                thumbColor={isDark ? GOLD : '#f5f5f5'}
              />
            }
          />
          <Row label="Focus Mode" last={false} TX={TX} MT={MT} BORD={BORD}
            sub="Home shows Daily Plan + Log only — hide everything else"
            rightEl={
              <Switch value={focusMode} onValueChange={(v) => void toggleFocusMode(v)}
                trackColor={{ false: BORD, true: GOLD + '60' }} thumbColor={focusMode ? GOLD : '#f5f5f5'}/>
            }
          />
          <Row label="Appearance"            sub={themeMode === 'auto' ? 'Follows system' : themeMode === 'dark' ? 'Always dark' : 'Always light'}
            onPress={() => router.push('/patient/profile/theme' as never)}               last={true}  TX={TX} MT={MT} BORD={BORD} />
        </Section>

        {/* ── Support ─────────────────────────────────────────────────── */}
        <Section title="SUPPORT" CARD={CARD} BORD={BORD}>
          <Row label="Help Center"           sub="FAQs and contact support"                 onPress={() => {}}                                                              last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="Privacy Policy"                                                        onPress={() => {}}                                                              last={false} TX={TX} MT={MT} BORD={BORD} />
          <Row label="Terms of Service"                                                      onPress={() => {}}                                                              last={true}  TX={TX} MT={MT} BORD={BORD} />
        </Section>

        {/* ── Consumer plan ─────────────────────────────────────────── */}
        {role === 'consumer' && (
          <Section title="MEMBERSHIP" CARD={CARD} BORD={BORD}>
            <Row label="Plans & Tier"        sub="Upgrade or manage subscription"           onPress={() => router.push('/patient/profile/consumer_plan' as never)}          last={true}  TX={TX} MT={MT} BORD={BORD} />
          </Section>
        )}

        {/* ── Super admin ─────────────────────────────────────────────── */}
        {(role === 'super_admin' || superAdminViewMode === 'patient') && (
          <Section CARD={CARD} BORD={BORD}>
            <Row label="← Admin Panel" TX={TX} MT={MT} BORD={BORD} last={true}
              onPress={() => { setSuperAdminViewMode('admin'); router.replace('/admin/command'); }} />
          </Section>
        )}

        {/* Sign out / version */}
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, textAlign: 'center', marginTop: 8 }}>
          SonaLife · Powered by Kenovus
        </Text>

      </ScrollView>
    </ImageBackground>
  );
}
