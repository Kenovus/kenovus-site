import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography } from '@/constants/designSystem';
import {
  getCoachVoiceOptions,
  getSelectedCoachVoiceId,
  setSelectedCoachVoiceId,
} from '@/lib/coachVoiceSettings';

export default function MyCoachSettingsScreen() {
  const insets = useSafeAreaInsets();
  const options = getCoachVoiceOptions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoRead, setAutoRead] = useState(false);

  const load = useCallback(async () => {
    const [id, autoVal] = await Promise.all([
      getSelectedCoachVoiceId(),
      AsyncStorage.getItem('sona.voice.autoSpeak'),
    ]);
    setSelectedId(id);
    setAutoRead(autoVal == null ? true : autoVal === '1');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
      <Text style={styles.title}>My Coach</Text>
      <Text style={styles.body}>Coach voice and read-aloud use ElevenLabs in a full native build.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Coach voice</Text>
        {options.map((opt, i) => {
          const active = selectedId != null && opt.id === selectedId;
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                void (async () => {
                  await setSelectedCoachVoiceId(opt.id);
                  setSelectedId(opt.id);
                })();
              }}
              style={({ pressed }) => [
                styles.voiceRow,
                i === 0 && styles.voiceRowFirst,
                pressed && { opacity: 0.85 },
              ]}>
              <Text style={styles.voiceLabel}>{opt.label}</Text>
              <Text style={styles.check}>{active ? '●' : '○'}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={styles.cardTitle}>Sona speaks responses aloud</Text>
            <Text style={styles.hint}>When on, each coach reply plays automatically (full app).</Text>
          </View>
          <Switch
            value={autoRead}
            onValueChange={(v) => {
              setAutoRead(v);
              void AsyncStorage.setItem('sona.voice.autoSpeak', v ? '1' : '0');
            }}
            trackColor={{ false: colors.gray2, true: colors.goldDim }}
            thumbColor={colors.white}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
    paddingHorizontal: 20,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    marginBottom: 8,
  },
  body: {
    ...typography.body,
    color: colors.gray1,
    marginBottom: 20,
    lineHeight: 22,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  cardTitle: {
    ...typography.body,
    color: colors.white,
    fontSize: 16,
    marginBottom: 8,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.goldDim,
  },
  voiceRowFirst: {
    borderTopWidth: 0,
  },
  voiceLabel: {
    ...typography.body,
    color: colors.goldLight,
    flex: 1,
  },
  check: {
    ...typography.body,
    color: colors.gold,
    fontSize: 18,
    marginLeft: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: { flex: 1 },
  hint: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 12,
    marginTop: 4,
  },
});
