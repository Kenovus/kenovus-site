import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { usePatientSupplements } from '@/hooks/usePatientSupplements';
import type { MergedSupplementItem } from '@/lib/patientSupplements';
import { EvidenceRatingBadge } from '@/components/provider/EvidenceRatingBadge';
import { getSupplementEvidenceByLabel } from '@/lib/supplementIntelligence';

function SupplementRow({
  item,
  todayTaken,
  onToggleActive,
  onToggleTaken,
  onSaveFields,
  onDeleteCustom,
}: {
  item: MergedSupplementItem;
  todayTaken: boolean;
  onToggleActive: (next: MergedSupplementItem) => void;
  onToggleTaken: (id: string, v: boolean) => void;
  onSaveFields: (item: MergedSupplementItem) => void;
  onDeleteCustom?: (id: string) => void;
}) {
  const [dose, setDose] = useState(item.dose);
  const [freq, setFreq] = useState(item.frequency);
  const evidence = getSupplementEvidenceByLabel(item.displayName);

  useEffect(() => {
    setDose(item.dose);
    setFreq(item.frequency);
  }, [item.id, item.presetKey, item.dose, item.frequency]);

  return (
    <View style={styles.rowCard}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, paddingRight: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Text style={styles.rowTitle}>{item.displayName}</Text>
          {evidence ? <EvidenceRatingBadge short grade={evidence.evidence} /> : null}
        </View>
        {item.isCustom && item.id && onDeleteCustom ? (
          <Button variant="ghost" onPress={() => onDeleteCustom(item.id!)} style={styles.deleteBtn}>
            Remove
          </Button>
        ) : null}
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>In my stack</Text>
        <Switch
          value={item.isActive}
          onValueChange={(v) => onToggleActive({ ...item, isActive: v })}
          trackColor={{ false: colors.dark2, true: 'rgba(201,168,76,0.45)' }}
          thumbColor={item.isActive ? colors.gold : colors.gray2}
        />
      </View>
      {item.isActive ? (
        <>
          <Text style={styles.fieldLabel}>Dose (e.g. 5g, 1 cap)</Text>
          <TextInput
            value={dose}
            onChangeText={setDose}
            onBlur={() => onSaveFields({ ...item, dose, frequency: freq })}
            placeholder="Optional"
            placeholderTextColor={colors.gray2}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Frequency (e.g. daily with breakfast)</Text>
          <TextInput
            value={freq}
            onChangeText={setFreq}
            onBlur={() => onSaveFields({ ...item, dose, frequency: freq })}
            placeholder="Optional"
            placeholderTextColor={colors.gray2}
            style={styles.input}
          />
          {item.id ? (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Taken today</Text>
              <Switch
                value={todayTaken}
                onValueChange={(v) => onToggleTaken(item.id!, v)}
                trackColor={{ false: colors.dark2, true: 'rgba(201,168,76,0.45)' }}
                thumbColor={todayTaken ? colors.gold : colors.gray2}
              />
            </View>
          ) : (
            <Text style={styles.meta}>Save “In my stack” first to enable daily check-off.</Text>
          )}
        </>
      ) : null}
    </View>
  );
}

export default function ProfileSupplements() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { patientId, merged, todayLogs, loading, refresh, saveMergedItem, toggleTakenToday, removeCustom } =
    usePatientSupplements();
  const [customName, setCustomName] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);

  const onToggleActive = async (next: MergedSupplementItem) => {
    const { error } = await saveMergedItem(next);
    if (error) {
      Alert.alert('Could not save', error);
      return;
    }
    refresh();
  };

  const onSaveFields = async (item: MergedSupplementItem) => {
    const { error } = await saveMergedItem(item);
    if (error) Alert.alert('Could not save', error);
    else refresh();
  };

  const onToggleTaken = async (id: string, v: boolean) => {
    const { error } = await toggleTakenToday(id, v);
    if (error) Alert.alert('Could not update', error);
  };

  const onAddCustom = async () => {
    const name = customName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a supplement name.');
      return;
    }
    setSavingCustom(true);
    try {
      const { error } = await saveMergedItem({
        id: null,
        presetKey: null,
        displayName: name,
        dose: '',
        frequency: '',
        isActive: true,
        isCustom: true,
      });
      if (error) Alert.alert('Could not add', error);
      else {
        setCustomName('');
        refresh();
      }
    } finally {
      setSavingCustom(false);
    }
  };

  const onDeleteCustom = (id: string) => {
    Alert.alert('Remove supplement?', 'This removes it from your stack and its history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const { error } = await removeCustom(id);
            if (error) Alert.alert('Could not remove', error);
          })();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Supplements' }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.banner}>
          {`Check with Simi before adding new supplements, especially if you're on medications. My Coach uses your stack for context—not to prescribe.`}
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />
        ) : !patientId ? (
          <Text style={styles.bodyMuted}>
            Your supplement tracker will appear here once your patient profile is linked. If this persists, contact
            support.
          </Text>
        ) : (
          <>
            <Text style={styles.section}>Your stack</Text>
            {merged.map((item) => (
              <SupplementRow
                key={item.presetKey ?? item.id ?? item.displayName}
                item={item}
                todayTaken={Boolean(item.id && todayLogs[item.id])}
                onToggleActive={onToggleActive}
                onToggleTaken={onToggleTaken}
                onSaveFields={onSaveFields}
                onDeleteCustom={item.isCustom ? onDeleteCustom : undefined}
              />
            ))}

            <Text style={[styles.section, { marginTop: 20 }]}>Add custom supplement</Text>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder="Name (e.g. Thorne iron)"
              placeholderTextColor={colors.gray2}
              style={styles.input}
            />
            <Button variant="primary" loading={savingCustom} onPress={() => void onAddCustom()}>
              Add to stack
            </Button>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backText: { ...typography.body, color: colors.gold, fontSize: 16 },
  banner: {
    ...typography.body,
    color: colors.goldLight,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.darkCard,
  },
  section: {
    ...typography.label,
    color: colors.gold,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  bodyMuted: {
    ...typography.body,
    color: colors.gray1,
    marginTop: 12,
    lineHeight: 22,
  },
  rowCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.darkCard,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowTitle: {
    ...typography.body,
    color: colors.white,
    fontSize: 16,
    flex: 1,
  },
  deleteBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  switchLabel: {
    ...typography.body,
    color: colors.gray1,
  },
  fieldLabel: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  input: {
    ...typography.body,
    color: colors.white,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: colors.dark,
  },
  meta: {
    ...typography.body,
    color: colors.gray2,
    fontSize: 12,
    marginTop: 4,
  },
});
