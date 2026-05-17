import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConsumerPaywallCard } from '@/components/patient/ConsumerPaywallCard';
import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { canUseProgressPhotos } from '@/lib/consumerTier';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  isRemoteStoragePath,
  resolveProgressPhotoImageUrl,
  uploadProgressPhotoObject,
} from '@/lib/progressPhotoStorage';
import { supabase } from '@/lib/supabase';

type Angle = 'front' | 'back' | 'left' | 'right' | 'face' | 'other';

type PhotoRow = {
  id: string;
  photo_date: string;
  angle: string;
  /** DB value: storage path or legacy http/file URI */
  photo_url: string;
  /** Resolved for <Image /> */
  displayUri: string;
};

const ANGLES: { id: Angle; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Side' },
  { id: 'back', label: 'Back' },
  { id: 'right', label: 'Right side' },
  { id: 'face', label: 'Face' },
  { id: 'other', label: 'Other' },
];

export default function ProgressPhotos() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const allowed = canUseProgressPhotos(profile);
  const [angle, setAngle] = useState<Angle>('front');
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shareWithProvider, setShareWithProvider] = useState(false);
  const [compare, setCompare] = useState(false);

  const load = useCallback(async () => {
    if (!user || !allowed) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (!pid) return;
      const { data, error } = await supabase
        .from('progress_photos')
        .select('id, photo_date, angle, photo_url')
        .eq('patient_id', pid)
        .order('photo_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) {
        console.warn('[photos]', error.message);
        return;
      }
      const base = (data ?? []).map((r) => ({
        id: String(r.id),
        photo_date: String(r.photo_date),
        angle: String(r.angle),
        photo_url: String(r.photo_url),
        displayUri: '',
      }));
      const resolved = await Promise.all(
        base.map(async (row) => ({
          ...row,
          displayUri: await resolveProgressPhotoImageUrl(row.photo_url),
        })),
      );
      setRows(resolved);
    } finally {
      setLoading(false);
    }
  }, [user, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickAndUpload = async (source: 'library' | 'camera') => {
    if (!user) return;
    setBusy(true);
    try {
      if (source === 'library') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Allow photo library access to attach progress photos.');
          return;
        }
      } else {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          Alert.alert('Permission needed', 'Allow camera access to capture progress photos.');
          return;
        }
      }
      const result =
        source === 'library'
          ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
          : await ImagePicker.launchCameraAsync({ quality: 0.85 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (!pid) return;

      const { path, error: upErr } = await uploadProgressPhotoObject({
        patientId: pid,
        angle,
        localUri: uri,
        mimeType: asset.mimeType ?? null,
      });
      if (upErr) {
        Alert.alert('Upload failed', upErr.message);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const takenAt = new Date().toISOString();
      const { error } = await supabase.from('progress_photos').insert({
        patient_id: pid,
        photo_date: today,
        angle,
        photo_url: path,
        is_shared_with_provider: shareWithProvider,
        taken_at: takenAt,
      });
      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 16, paddingHorizontal: 20 }]}>
        <Text style={styles.title}>Progress photos</Text>
        <ConsumerPaywallCard
          title="Progress photos are a GLP-1+ feature"
          body="Four-angle progress sets unlock for GLP-1+ consumers and all clinic patients. Upgrade to capture your visual arc."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 20 }}>
      <Text style={styles.title}>Progress photos</Text>
      <Text style={styles.sub}>
        Photos upload to your private Supabase bucket; the app uses time-limited signed URLs to display them.
      </Text>

      <Text style={styles.label}>Angle</Text>
      <View style={styles.row}>
        {ANGLES.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setAngle(a.id)}
            style={[styles.chip, angle === a.id && styles.chipOn]}>
            <Text style={[styles.chipText, angle === a.id && styles.chipTextOn]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.shareRow}>
        <Text style={styles.shareLabel}>Share new photos with my provider</Text>
        <Switch
          value={shareWithProvider}
          onValueChange={setShareWithProvider}
          trackColor={{ false: colors.gray2, true: colors.goldDim }}
          thumbColor={colors.white}
        />
      </View>

      <View style={styles.btnRow}>
        <Button loading={busy} onPress={() => void pickAndUpload('library')} variant="primary">
          Library
        </Button>
        <Button loading={busy} onPress={() => void pickAndUpload('camera')} variant="ghost">
          Camera
        </Button>
      </View>

      {rows.length >= 2 ? (
        <Pressable onPress={() => setCompare((c) => !c)} style={styles.compareToggle}>
          <Text style={styles.compareToggleText}>{compare ? 'Hide comparison' : 'Compare first vs latest'}</Text>
        </Pressable>
      ) : null}
      {compare && rows.length >= 2 ? (
        <View style={styles.compareRow}>
          <View style={styles.compareHalf}>
            <Text style={styles.meta}>First on file</Text>
            <Image source={{ uri: rows[rows.length - 1]!.displayUri }} style={styles.compareImg} resizeMode="cover" />
          </View>
          <View style={styles.compareHalf}>
            <Text style={styles.meta}>Latest</Text>
            <Image source={{ uri: rows[0]!.displayUri }} style={styles.compareImg} resizeMode="cover" />
          </View>
        </View>
      ) : null}

      <Text style={[styles.label, { marginTop: 24 }]}>Library</Text>
      {loading ? <Text style={styles.meta}>Loading…</Text> : null}
      {rows.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.meta}>
            {r.photo_date} · {r.angle}
            {!isRemoteStoragePath(r.photo_url) && r.photo_url.startsWith('file') ? ' · local (legacy)' : ''}
          </Text>
          <Image source={{ uri: r.displayUri }} style={styles.thumb} resizeMode="cover" />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 16, lineHeight: 22 },
  label: { ...typography.label, color: colors.goldLight, marginBottom: 8, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.2)' },
  chipText: { ...typography.body, color: colors.gray1, fontSize: 13 },
  chipTextOn: { color: colors.white },
  meta: { ...typography.body, color: colors.gray2, fontSize: 13, marginBottom: 8 },
  card: {
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 10,
    backgroundColor: colors.darkCard,
  },
  thumb: { width: '100%', height: 220, borderRadius: 8, backgroundColor: colors.dark2 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  shareLabel: { ...typography.body, color: colors.gray1, flex: 1, fontSize: 14 },
  btnRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  compareToggle: { marginTop: 8, marginBottom: 12 },
  compareToggleText: { ...typography.body, color: colors.goldLight, textDecorationLine: 'underline' },
  compareRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  compareHalf: { flex: 1 },
  compareImg: { width: '100%', height: 160, borderRadius: 8, backgroundColor: colors.dark2 },
});
