import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConsumerPaywallCard } from '@/components/patient/ConsumerPaywallCard';
import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { canSyncWearables } from '@/lib/consumerTier';
import {
  fetchAppleHealthSnapshot,
  isAppleHealthNativeAvailable,
  requestAppleHealthAuthorization,
  type AppleHealthSnapshot,
} from '@/lib/health/appleHealth';
import {
  disconnectWearableForAuthUser,
  ingestWearableProviderForAuthUser,
  listWearableConnectionsForAuthUser,
  startWearableOAuthForAuthUser,
  type WearableConnection,
} from '@/lib/wearables';

type CloudProvider = 'oura' | 'whoop' | 'fitbit';

export default function ProfileWearables() {
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const allowed = canSyncWearables(profile);
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<AppleHealthSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [connections, setConnections] = useState<WearableConnection[]>([]);
  const [syncingProvider, setSyncingProvider] = useState<CloudProvider | null>(null);

  const cloudConnections = useMemo(
    () => connections.filter((c) => c.provider === 'oura' || c.provider === 'whoop' || c.provider === 'fitbit'),
    [connections],
  );

  const loadConnections = useCallback(async () => {
    if (!user) return;
    const { rows, error } = await listWearableConnectionsForAuthUser(user.id);
    if (error) {
      console.warn('[wearables] list connections', error.message);
      return;
    }
    setConnections(rows);
  }, [user]);

  const refreshSnapshot = useCallback(async () => {
    if (!connected || Platform.OS !== 'ios') return;
    setBusy(true);
    try {
      const snap = await fetchAppleHealthSnapshot();
      setSnapshot(snap);
    } finally {
      setBusy(false);
    }
  }, [connected]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const onConnectAppleHealth = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Apple Health', 'Apple Health is only available on iPhone.');
      return;
    }
    setBusy(true);
    try {
      if (!isAppleHealthNativeAvailable()) {
        Alert.alert(
          'Development build required',
          'HealthKit is not included in Expo Go. Create an iOS build with EAS or run `npx expo run:ios` after prebuild.',
        );
        return;
      }
      const auth = await requestAppleHealthAuthorization();
      if (!auth.ok) {
        Alert.alert('Health permissions', auth.message ?? 'Could not enable Apple Health.');
        return;
      }
      setConnected(true);
      const snap = await fetchAppleHealthSnapshot();
      setSnapshot(snap);
    } finally {
      setBusy(false);
    }
  };

  const connectCloudProvider = async (provider: CloudProvider) => {
    if (!user) return;
    setSyncingProvider(provider);
    try {
      const oauth = await startWearableOAuthForAuthUser({ authUserId: user.id, provider });
      if (oauth.error || !oauth.code) {
        throw oauth.error ?? new Error('OAuth did not return a code.');
      }
      const ingested = await ingestWearableProviderForAuthUser({
        authUserId: user.id,
        provider,
        oauthCode: oauth.code,
        redirectUri: oauth.redirectUri,
      });
      if (ingested.error) {
        throw ingested.error;
      }
      Alert.alert('Wearables', `${provider.toUpperCase()} connected. Ingested ${ingested.inserted} day(s) of metrics.`);
      await loadConnections();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to connect wearable provider.';
      Alert.alert('Wearables', message);
      await loadConnections();
    } finally {
      setSyncingProvider(null);
    }
  };

  const disconnectCloudProvider = async (provider: CloudProvider) => {
    if (!user) return;
    setSyncingProvider(provider);
    try {
      const { ok, error } = await disconnectWearableForAuthUser(user.id, provider);
      if (!ok) throw error ?? new Error('Disconnect failed.');
      await loadConnections();
    } catch (err) {
      Alert.alert('Wearables', err instanceof Error ? err.message : 'Unable to disconnect provider.');
    } finally {
      setSyncingProvider(null);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16, paddingHorizontal: 22 }}>
      <Text style={styles.title}>Connected devices</Text>
      <Text style={styles.body}>
        When sync is on, steps, sleep, heart rate, HRV, and weight from Apple Health can inform your vitality score.
      </Text>

      {!allowed ? (
        <ConsumerPaywallCard
          title="Wearable sync is a Core feature"
          body="Free tier includes manual logging. Upgrade to Core or GLP-1+ to unlock wearable sync and automatic signals."
        />
      ) : (
        <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apple Health</Text>
          <Text style={styles.cardBody}>
            Read-only in this build: steps, sleep, resting heart rate, HRV, and weight. Data stays on device until you
            explicitly sync scores in a later slice.
          </Text>
          <Button
            loading={busy}
            onPress={() => void (connected ? refreshSnapshot() : onConnectAppleHealth())}
            variant="primary"
            style={styles.btn}>
            {connected ? 'Refresh Health snapshot' : 'Connect Apple Health'}
          </Button>
          {snapshot ? (
            <View style={styles.metrics}>
              <Text style={styles.metric}>Steps today: {snapshot.stepsToday ?? '—'}</Text>
              <Text style={styles.metric}>Latest weight (lb): {snapshot.weightLbs ?? '—'}</Text>
              <Text style={styles.metric}>Recent sleep (h, asleep): {snapshot.sleepHoursLastNight ?? '—'}</Text>
              <Text style={styles.metric}>Resting HR: {snapshot.restingHeartRate ?? '—'}</Text>
              <Text style={styles.metric}>HRV (SDNN ms): {snapshot.hrvSdnnMs ?? '—'}</Text>
            </View>
          ) : null}
          {Platform.OS !== 'ios' ? (
            <Text style={styles.hint}>Android Health Connect support will follow in a separate integration.</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Oura</Text>
          <Text style={styles.cardBody}>OAuth connect for readiness, sleep, heart rate, and activity ingestion.</Text>
          <ProviderStateRow provider="oura" rows={cloudConnections} />
          <Button
            loading={syncingProvider === 'oura'}
            onPress={() => void connectCloudProvider('oura')}
            variant="primary"
            style={styles.btn}>
            Connect Oura
          </Button>
          <Button
            disabled={!cloudConnections.some((c) => c.provider === 'oura' && c.status === 'connected')}
            loading={syncingProvider === 'oura'}
            onPress={() => void disconnectCloudProvider('oura')}
            variant="ghost"
            style={styles.secondaryBtn}>
            Disconnect Oura
          </Button>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Whoop</Text>
          <Text style={styles.cardBody}>OAuth connect for recovery, strain, sleep, and workout ingestion.</Text>
          <ProviderStateRow provider="whoop" rows={cloudConnections} />
          <Button
            loading={syncingProvider === 'whoop'}
            onPress={() => void connectCloudProvider('whoop')}
            variant="primary"
            style={styles.btn}>
            Connect Whoop
          </Button>
          <Button
            disabled={!cloudConnections.some((c) => c.provider === 'whoop' && c.status === 'connected')}
            loading={syncingProvider === 'whoop'}
            onPress={() => void disconnectCloudProvider('whoop')}
            variant="ghost"
            style={styles.secondaryBtn}>
            Disconnect Whoop
          </Button>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fitbit</Text>
          <Text style={styles.cardBody}>OAuth connect for steps, sleep, heart rate, and weight ingestion.</Text>
          <ProviderStateRow provider="fitbit" rows={cloudConnections} />
          <Button
            loading={syncingProvider === 'fitbit'}
            onPress={() => void connectCloudProvider('fitbit')}
            variant="primary"
            style={styles.btn}>
            Connect Fitbit
          </Button>
          <Button
            disabled={!cloudConnections.some((c) => c.provider === 'fitbit' && c.status === 'connected')}
            loading={syncingProvider === 'fitbit'}
            onPress={() => void disconnectCloudProvider('fitbit')}
            variant="ghost"
            style={styles.secondaryBtn}>
            Disconnect Fitbit
          </Button>
        </View>

        <Text style={styles.hint}>
          Cloud providers require a deployed Supabase Edge Function named `wearables-ingest` for code exchange and API
          pulls. This app now handles OAuth launch, callback, and normalized persistence.
        </Text>
        </>
      )}
    </ScrollView>
  );
}

function ProviderStateRow({ provider, rows }: { provider: CloudProvider; rows: WearableConnection[] }) {
  const row = rows.find((r) => r.provider === provider);
  if (!row) return <Text style={styles.metric}>Status: not connected</Text>;
  const sync = row.last_sync_at ? new Date(row.last_sync_at).toLocaleString() : '—';
  return (
    <View style={styles.metrics}>
      <Text style={styles.metric}>Status: {row.status}</Text>
      <Text style={styles.metric}>Last sync: {sync}</Text>
      {row.last_error ? <Text style={styles.metric}>Last error: {row.last_error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  title: { ...typography.h2, color: colors.white, marginBottom: 10 },
  body: { ...typography.body, color: colors.gray1, marginBottom: 12, lineHeight: 22 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 16,
    backgroundColor: colors.darkCard,
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: { ...typography.label, color: colors.gold, marginBottom: 2 },
  cardBody: { ...typography.body, color: colors.white, lineHeight: 22 },
  btn: { marginTop: 4 },
  secondaryBtn: { marginTop: 2 },
  metrics: { marginTop: 8, gap: 6 },
  metric: { ...typography.body, color: colors.gray1, fontSize: 14 },
  hint: { ...typography.body, color: colors.gray2, fontSize: 13, marginTop: 8 },
});
