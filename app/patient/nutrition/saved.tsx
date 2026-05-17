import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConsumerPaywallCard } from '@/components/patient/ConsumerPaywallCard';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { canUseNutritionPremium } from '@/lib/consumerTier';
import { fetchMealTemplates, upsertFoodLogEntry } from '@/lib/nutritionLogData';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { supabase } from '@/lib/supabase';

type Row = { food_name: string; cnt: number };
type Template = {
  id: string;
  name: string;
  foods_json: Array<Record<string, unknown>>;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
};

export default function NutritionSaved() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const allowed = canUseNutritionPremium(profile);
  const [rows, setRows] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

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
        .from('food_log_entries')
        .select('food_name')
        .eq('patient_id', pid)
        .order('created_at', { ascending: false })
        .limit(400);
      if (error) {
        console.warn('[saved meals]', error.message);
        return;
      }
      const counts = new Map<string, number>();
      for (const r of data ?? []) {
        const n = String(r.food_name ?? '').trim();
        if (!n) continue;
        counts.set(n, (counts.get(n) ?? 0) + 1);
      }
      setRows(
        [...counts.entries()]
          .map(([food_name, cnt]) => ({ food_name, cnt }))
          .sort((a, b) => b.cnt - a.cnt || a.food_name.localeCompare(b.food_name))
          .slice(0, 40),
      );
      setTemplates(await fetchMealTemplates(pid));
    } finally {
      setLoading(false);
    }
  }, [user, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  const reLog = async (foodName: string) => {
    const pid = user ? await fetchPatientIdForAuthUser(user.id) : null;
    if (!pid) return;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('food_log_entries').insert({
      patient_id: pid,
      log_date: today,
      meal_slot: 'snack',
      entry_type: 'actual',
      food_name: foodName,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    });
    if (error) {
      Alert.alert('Could not add', error.message);
      return;
    }
    Alert.alert('Logged', `${foodName} added to today (macros at 0 — edit in a future build).`);
  };

  const reLogTemplate = async (template: Template) => {
    const pid = user ? await fetchPatientIdForAuthUser(user.id) : null;
    if (!pid) return;
    const today = new Date().toISOString().slice(0, 10);
    for (const f of template.foods_json) {
      await upsertFoodLogEntry({
        patient_id: pid,
        log_date: today,
        meal_type: 'snack',
        food_name: String(f.food_name ?? 'Food'),
        brand: (f.brand as string | undefined) ?? null,
        calories: Number(f.calories ?? 0),
        protein_g: Number(f.protein_g ?? 0),
        carbs_g: Number(f.carbs_g ?? 0),
        fat_g: Number(f.fat_g ?? 0),
        source: 'template',
      });
    }
    Alert.alert('Logged', `${template.name} added to today.`);
  };

  if (!allowed) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Saved meals</Text>
        <ConsumerPaywallCard
          title="Saved meals are a Core feature"
          body="Core and GLP-1+ can re-use your frequent foods in one tap. Free tier still supports manual logging."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 20 }}>
      <Text style={styles.title}>Saved meals</Text>
      <Text style={styles.sub}>Tap a frequent food to log it again for today.</Text>
      <Text style={styles.sub}>My Meals templates</Text>
      {templates.map((t) => (
        <Pressable key={t.id} onPress={() => void reLogTemplate(t)} style={styles.row}>
          <Text style={styles.name}>{t.name}</Text>
          <Text style={styles.meta}>{Math.round(t.total_calories)} kcal</Text>
        </Pressable>
      ))}
      {loading ? <Text style={styles.meta}>Loading…</Text> : null}
      {rows.map((r) => (
        <Pressable key={r.food_name} onPress={() => void reLog(r.food_name)} style={styles.row}>
          <Text style={styles.name}>{r.food_name}</Text>
          <Text style={styles.meta}>{r.cnt}×</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  title: { ...typography.h2, color: colors.white, marginBottom: 6 },
  sub: { ...typography.body, color: colors.gray1, marginBottom: 12 },
  meta: { ...typography.body, color: colors.gray2, fontSize: 13 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.goldDim,
  },
  name: { ...typography.body, color: colors.white, flex: 1, paddingRight: 12 },
});
