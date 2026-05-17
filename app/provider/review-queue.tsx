/**
 * Provider Dashboard — Simi Review Queue
 * Flagged check-ins (symptom 7+) and skin scans requiring review.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { supabase } from '@/lib/supabase';

const GOLD = '#BF8D36';
const PINK = '#E07878';
const AMBER = '#E8A830';

interface FlaggedItem {
  id: string;
  type: 'checkin' | 'scan';
  patient_name: string;
  patient_id: string;
  treatment_name: string;
  date: string;
  max_symptom: number | null;
  notes: string | null;
  reviewed: boolean;
}

export default function ReviewQueueScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.15)';
  const TX = tokens.colors.text, MT = tokens.colors.textMuted;
  const BG = tokens.colors.background;

  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: checkins } = await supabase
      .from('patient_checkins')
      .select('id, patient_id, treatment_name, treatment_date, symptoms_json, notes, simi_flagged, patients(profiles(full_name))')
      .eq('simi_flagged', true)
      .order('created_at', { ascending: false })
      .limit(50);

    const rows: FlaggedItem[] = (checkins ?? []).map((c: any) => {
      const symptoms = c.symptoms_json ?? {};
      const maxSym = Object.values(symptoms).length
        ? Math.max(...Object.values(symptoms).map(Number))
        : null;
      return {
        id: c.id,
        type: 'checkin',
        patient_name: (c.patients as any)?.profiles?.full_name ?? 'Unknown',
        patient_id: c.patient_id,
        treatment_name: c.treatment_name,
        date: c.treatment_date,
        max_symptom: maxSym,
        notes: c.notes,
        reviewed: false,
      };
    });

    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markReviewed = async (id: string) => {
    await supabase.from('patient_checkins').update({ simi_flagged: false }).eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    Alert.alert('Marked reviewed', 'Item removed from queue.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 26, color: TX, marginBottom: 4 }}>Review Queue</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginBottom: 12 }}>
          {items.length} item{items.length !== 1 ? 's' : ''} requiring Simi's review
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>✓</Text>
              <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 20, color: TX, marginBottom: 4 }}>All clear</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, textAlign: 'center' }}>No items flagged for review</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const symCol = (item.max_symptom ?? 0) >= 8 ? PINK : AMBER;
          return (
            <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, marginBottom: 10, overflow: 'hidden' }}>
              <View style={{ height: 3, backgroundColor: symCol }} />
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <View>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: TX }}>{item.patient_name}</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>{item.treatment_name}</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>{item.date}</Text>
                  </View>
                  {item.max_symptom != null && (
                    <View style={{ backgroundColor: symCol + '20', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: symCol + '50' }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 18, color: symCol, fontWeight: '700' }}>{item.max_symptom}/10</Text>
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: symCol, textAlign: 'center' }}>severity</Text>
                    </View>
                  )}
                </View>
                {item.notes && (
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, fontStyle: 'italic', marginBottom: 12 }}>
                    "{item.notes}"
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => router.push({ pathname: '/provider/patient/[id]', params: { id: item.patient_id } } as never)}
                    style={{ flex: 1, backgroundColor: GOLD + '18', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: GOLD + '40' }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: GOLD }}>View Patient</Text>
                  </Pressable>
                  <Pressable onPress={() => void markReviewed(item.id)}
                    style={{ flex: 1, backgroundColor: '#5EC47A18', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#5EC47A40' }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#5EC47A' }}>✓ Mark Reviewed</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
