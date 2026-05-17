/**
 * Referrals — show user's code + QR code, share button, stats, enter a friend's code.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, ImageBackground, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import { getOrCreateReferralCode, getPatientReferralSummary } from '@/lib/referrals';
import { supabase } from '@/lib/supabase';

const GOLD  = '#BF8D36';
const GREEN = '#5EC47A';
const BG_DARK  = require('../../../assets/images/sona-bg-dark.png');
const BG_LIGHT = require('../../../assets/images/sona-light-bg.png');

export default function ProfileReferrals() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const SH   = { shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 4 } as const, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5 };

  const [loading, setLoading] = useState(true);
  const [code, setCode]       = useState<string | null>(null);
  const [total, setTotal]     = useState(0);
  const [referralInput, setReferralInput] = useState('');
  const [submitting, setSubmitting]       = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { code: c } = await getOrCreateReferralCode(user.id);
      setCode(c);
      const summary = await getPatientReferralSummary(user.id);
      setTotal(summary.total ?? 0);
    } catch (e) {
      console.warn('[Referrals] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const shareCode = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Join me on SonaLife — the wellness app from Sona Medical Aesthetics! Use my referral code: ${code}\n\nhttps://sonamedicalaesthetics.com`,
        title: 'Join SonaLife',
      });
    } catch (e) {
      console.warn('[Referrals] share error:', e);
    }
  };

  const submitReferralCode = async () => {
    const entered = referralInput.trim().toUpperCase();
    if (!entered || !user) return;
    if (entered === code) {
      Alert.alert('Invalid', "You can't use your own referral code.");
      return;
    }
    setSubmitting(true);
    try {
      // Find the referrer by code
      const { data: referrer } = await supabase
        .from('referrals')
        .select('user_id')
        .eq('code', entered)
        .maybeSingle();

      if (!referrer) {
        Alert.alert('Code not found', "That referral code doesn't exist. Double-check and try again.");
        return;
      }

      // Record the referral use
      const { error } = await supabase.from('referrals').insert({
        user_id:     referrer.user_id,
        referred_user_id: user.id,
        code: entered,
        status: 'joined',
      });

      if (error && !error.message.includes('duplicate')) throw error;
      Alert.alert('Code applied! 🎉', 'Your referral has been recorded. Thank you!');
      setReferralInput('');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const referralUrl = code ? `https://sonamedicalaesthetics.com/?ref=${code}` : '';

  return (
    <ImageBackground source={isDark ? BG_DARK : BG_LIGHT} style={{ flex: 1 }} resizeMode="cover">
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(5,3,2,0.65)' : 'rgba(245,240,232,0.75)' }]} />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>

        <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 26, color: TX, marginBottom: 4 }}>Refer a Friend</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginBottom: 20 }}>
          Share your code. You earn perks when friends join and complete their first visit.
        </Text>

        {/* Your referral code + QR */}
        {code ? (
          <View style={[{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: GOLD + '50', padding: 22, marginBottom: 14, alignItems: 'center' }, SH]}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 14 }}>YOUR REFERRAL CODE</Text>

            {/* QR Code */}
            <View style={{ padding: 16, backgroundColor: '#fff', borderRadius: 14, marginBottom: 16 }}>
              <QRCode
                value={referralUrl}
                size={160}
                color="#1a1008"
                backgroundColor="#ffffff"
              />
            </View>

            {/* Code pill */}
            <View style={{ backgroundColor: GOLD + '22', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 16, borderWidth: 1, borderColor: GOLD + '55' }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 26, color: GOLD, letterSpacing: 6 }}>{code}</Text>
            </View>

            {/* Share button */}
            <Pressable
              onPress={() => void shareCode()}
              style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32, alignItems: 'center', flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff' }}>Share Your Code</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={[{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORD, padding: 32, alignItems: 'center', marginBottom: 14 }, SH]}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT }}>Loading your code…</Text>
          </View>
        ) : null}

        {/* Stats */}
        <View style={[{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 18, marginBottom: 14 }, SH]}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 12 }}>YOUR REFERRALS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 36, color: GOLD }}>{total}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>Friends joined</Text>
            </View>
            {total > 0 && (
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 36, color: GREEN }}>✓</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>Perks active</Text>
              </View>
            )}
          </View>
          {total >= 1 && (
            <View style={{ backgroundColor: GREEN + '18', borderRadius: 10, padding: 12, marginTop: 14, borderWidth: 1, borderColor: GREEN + '40' }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: GREEN }}>
                {total === 1 ? 'You referred 1 friend — thank you! 🎉' : `You've referred ${total} friends — you're a Sona ambassador! 🏆`}
              </Text>
            </View>
          )}
        </View>

        {/* Enter a referral code */}
        <View style={[{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 18 }, SH]}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 12 }}>HAVE A REFERRAL CODE?</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginBottom: 12 }}>
            If a friend invited you, enter their code to give them credit.
          </Text>
          <TextInput
            value={referralInput}
            onChangeText={(t) => setReferralInput(t.toUpperCase())}
            placeholder="Enter code (e.g. SONA-ABC1)"
            placeholderTextColor={MT}
            autoCapitalize="characters"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderRadius: 12, borderWidth: 1, borderColor: BORD, paddingHorizontal: 14, paddingVertical: 12, color: TX, fontFamily: 'DMSans_500Medium', fontSize: 16, letterSpacing: 2, marginBottom: 12 }}
          />
          <Pressable
            onPress={() => void submitReferralCode()}
            disabled={submitting || !referralInput.trim()}
            style={{ backgroundColor: referralInput.trim() ? GOLD : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: submitting ? 0.6 : 1 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: referralInput.trim() ? '#fff' : MT }}>
              {submitting ? 'Applying…' : 'Apply Code'}
            </Text>
          </Pressable>
        </View>

      </ScrollView>
    </ImageBackground>
  );
}
