/**
 * Small teaser card for the Physique Forecast.
 * Renders nothing if the patient hasn't set a goal yet.
 * Shows plan name, days remaining, and confidence% — NO body metrics.
 */
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { fetchForecastBundle, type ForecastBundle } from '@/lib/physiqueData';
import { currentConfidence, generateProjections } from '@/lib/physiqueProjection';

const GOLD = '#BF8D36';
const GREEN = '#34D399';
const CARD_BG = '#1B2A3A';
const TEXT = '#F4F1E8';
const TEXT_MUTED = 'rgba(244,241,232,0.62)';

type Variant = 'home' | 'progress';

export function ForecastTeaserCard({ variant = 'home' }: { variant?: Variant }) {
  const router = useRouter();
  const { user } = useAuth();
  const [bundle, setBundle] = useState<ForecastBundle | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const pid = await fetchPatientIdForAuthUser(user.id);
    if (!pid) return;
    try {
      const b = await fetchForecastBundle(pid);
      setBundle(b);
    } catch (e) {
      console.warn('[forecast teaser] load failed', e);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!bundle?.hasGoal || !bundle.goal) return null;

  const projections = generateProjections(bundle.goal, bundle.actuals);
  const confidence = currentConfidence(projections);
  const daysLeft = bundle.daysRemaining ?? 0;

  const subLine = variant === 'home' ? '→ View your forecast' : 'View Full Calendar →';

  return (
    <Pressable
      onPress={() => router.push('/patient/physique-forecast' as Href)}
      style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.plan}>{bundle.planName}</Text>
        <Text style={styles.days}>{daysLeft} days remaining</Text>
        <Text style={styles.cta}>{subLine}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.conf}>{confidence}%</Text>
        <Text style={styles.confLabel}>ON TRACK</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(184,150,46,0.3)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  plan: { color: GOLD, fontFamily: 'PTSerif_700Bold', fontSize: 16 },
  days: { color: TEXT, fontFamily: 'DMSans_500Medium', fontSize: 13, marginTop: 2 },
  cta: { color: TEXT_MUTED, fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 4 },
  conf: { color: GREEN, fontFamily: 'PTSerif_700Bold', fontSize: 22 },
  confLabel: { color: GREEN, fontFamily: 'DMSans_500Medium', fontSize: 9, letterSpacing: 1 },
  chev: { color: GOLD, fontSize: 20, marginLeft: 4 },
});
