import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView,
  Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TouchableWithoutFeedback, View,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  deleteFoodLogEntry, fetchFoodLogsForDate, fetchRecentFoods, fetchFrequentFoods,
  fetchWaterOzForDate, addWaterLog,
  upsertFoodLogEntry, type FoodLogRow, type MealType,
} from '@/lib/nutritionLogData';
import { searchFoodsInstant, type FoodSearchItem } from '@/lib/nutritionFoodApi';

// ── Design tokens ──────────────────────────────────────────────────
const C = {
  bg:       '#F5EDE4',
  gold:     '#BF8D36',
  darkText: '#1a1008',
  muted:    '#9a826a',
  tileBg:   'rgba(255,255,255,0.92)',
  tileBdr:  'rgba(200,180,150,0.28)',
  track:    '#ede8e0',
  protein:  '#5BC4DC',
  fat:      '#E07878',
  carbs:    '#5EC47A',
  red:      '#e05555',
};
const SHADOW = {
  shadowColor: '#5a3e1e', shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.10, shadowRadius: 8, elevation: 4,
};

// ── Meal slots (Pre/Post Workout included) ─────────────────────────
const MEALS: { value: MealType; label: string; emoji: string }[] = [
  { value: 'breakfast',    label: 'Breakfast',    emoji: '🌅' },
  { value: 'lunch',        label: 'Lunch',        emoji: '☀️' },
  { value: 'dinner',       label: 'Dinner',       emoji: '🌙' },
  { value: 'snack',        label: 'Snacks',       emoji: '🍎' },
  { value: 'pre_workout',  label: 'Pre-Workout',  emoji: '💪' },
  { value: 'post_workout', label: 'Post-Workout', emoji: '🏆' },
];

// ── Icons ──────────────────────────────────────────────────────────
const SearchIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={11} cy={11} r={8}/><Path d="M21 21l-4.35-4.35"/>
  </Svg>
);
const PlusIcon = ({ color = C.gold, size = 20 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14"/>
  </Svg>
);
const TrashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
  </Svg>
);
const EditIcon = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </Svg>
);
const BackIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.darkText} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6"/>
  </Svg>
);
const XIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2} strokeLinecap="round">
    <Path d="M18 6L6 18M6 6l12 12"/>
  </Svg>
);
const BarcodeIcon = ({ color = C.gold }: { color?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 5v4M3 15v4M21 5v4M21 15v4M7 5v14M12 5v14M17 5v14"/>
  </Svg>
);

// ── Colored macro pill ─────────────────────────────────────────────
function MacroPill({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <View style={{ backgroundColor: color + '1A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color, fontFamily: 'DMSans_500Medium' }}>
        {Math.round(val)}g
      </Text>
      <Text style={{ fontSize: 8, color, fontFamily: 'DMSans_400Regular', opacity: 0.85 }}>{label}</Text>
    </View>
  );
}

// ── Sort search results ────────────────────────────────────────────
function sortResults(results: FoodSearchItem[], query: string): FoodSearchItem[] {
  const q = query.toLowerCase().trim();
  return [...results].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    // Exact matches first
    const aExact = aName === q;
    const bExact = bName === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    // Starts-with matches second
    const aStarts = aName.startsWith(q);
    const bStarts = bName.startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    // Branded foods before generic
    if (a.brand && !b.brand) return -1;
    if (!a.brand && b.brand) return 1;
    return 0;
  });
}

// ── Serving / Add modal ────────────────────────────────────────────
function ServingModal({
  item, onAdd, onClose,
}: {
  item: FoodSearchItem;
  onAdd: (f: FoodSearchItem, qty: number, unit: string) => void;
  onClose: () => void;
}) {
  const [qty, setQty]   = useState('1');
  const [unit, setUnit] = useState(item.serving_unit || 'serving');
  const q   = Math.max(0.1, parseFloat(qty) || 1);
  const cal = Math.round(item.calories * q);
  const pro = Math.round(item.protein_g * q);
  const carb = Math.round(item.carbs_g * q);
  const fat = Math.round(item.fat_g * q);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={ms.backdrop}>
            <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
              <ScrollView
                style={ms.cardScroll}
                contentContainerStyle={ms.card}
                keyboardShouldPersistTaps="handled"
                bounces={false}>
                <Text style={ms.title} numberOfLines={2}>{item.name}</Text>
                {item.brand && <Text style={ms.brand}>{item.brand}</Text>}
                <Text style={ms.servRef}>
                  Per {item.serving_size}{item.serving_unit ? ` ${item.serving_unit}` : ''}
                </Text>
                <View style={ms.macroRow}>
                  <View style={ms.calBox}>
                    <Text style={ms.calNum}>{cal}</Text>
                    <Text style={ms.calLbl}>cal</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <MacroPill label="Protein" val={pro}  color={C.protein}/>
                    <MacroPill label="Carbs"   val={carb} color={C.carbs}/>
                    <MacroPill label="Fat"     val={fat}  color={C.fat}/>
                  </View>
                </View>
                <View style={ms.row}>
                  <View style={ms.inputWrap}>
                    <Text style={ms.label}>Quantity</Text>
                    <TextInput style={ms.input} value={qty} onChangeText={setQty}
                      keyboardType="decimal-pad" selectTextOnFocus/>
                  </View>
                  <View style={[ms.inputWrap, { flex: 2, marginLeft: 10 }]}>
                    <Text style={ms.label}>Unit</Text>
                    <TextInput style={ms.input} value={unit} onChangeText={setUnit} autoCapitalize="none"/>
                  </View>
                </View>
                <Pressable style={ms.addBtn} onPress={() => { onAdd(item, q, unit); onClose(); }}>
                  <Text style={ms.addTxt}>Add to Log</Text>
                </Pressable>
                <Pressable onPress={onClose} style={ms.cancel}>
                  <Text style={ms.cancelTxt}>Cancel</Text>
                </Pressable>
              </ScrollView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Quick-Add field helper ─────────────────────────────────────────
function QAField({ label, value, onChange, keyboard = 'decimal-pad' }: {
  label: string; value: string; onChange: (v: string) => void; keyboard?: 'decimal-pad' | 'default';
}) {
  return (
    <View>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChange}
        keyboardType={keyboard}
        placeholder={keyboard === 'decimal-pad' ? '0' : 'e.g. Pasta, chicken'}
        placeholderTextColor={C.muted}
        style={ms.input}
      />
    </View>
  );
}

// ── Edit existing entry modal ──────────────────────────────────────
function EditEntryModal({
  entry, onSave, onDelete, onClose,
}: {
  entry: FoodLogRow;
  onSave: (entry: FoodLogRow, newQty: number) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState('1');
  // Treat stored values as 1x serving; scale by qty
  const q    = Math.max(0.1, parseFloat(qty) || 1);
  const cal  = Math.round((entry.calories ?? 0) * q);
  const pro  = Math.round((entry.protein_g ?? 0) * q);
  const carb = Math.round((entry.carbs_g ?? 0) * q);
  const fat  = Math.round((entry.fat_g ?? 0) * q);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={ms.backdrop}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <View style={ms.card}>
              <Text style={ms.title} numberOfLines={2}>{entry.food_name}</Text>
              {entry.brand && <Text style={ms.brand}>{entry.brand}</Text>}
              <Text style={ms.servRef}>
                Logged: {entry.serving_size}{entry.serving_unit ? ` ${entry.serving_unit}` : ''}
              </Text>
              {/* Live preview scaled by qty */}
              <View style={ms.macroRow}>
                <View style={ms.calBox}>
                  <Text style={ms.calNum}>{cal}</Text>
                  <Text style={ms.calLbl}>cal</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <MacroPill label="Protein" val={pro}  color={C.protein}/>
                  <MacroPill label="Carbs"   val={carb} color={C.carbs}/>
                  <MacroPill label="Fat"     val={fat}  color={C.fat}/>
                </View>
              </View>
              <View style={ms.row}>
                <View style={ms.inputWrap}>
                  <Text style={ms.label}>Multiplier (e.g. 2 = double)</Text>
                  <TextInput style={ms.input} value={qty} onChangeText={setQty}
                    keyboardType="decimal-pad" selectTextOnFocus/>
                </View>
              </View>
              <Pressable style={ms.addBtn} onPress={() => { onSave(entry, q); onClose(); }}>
                <Text style={ms.addTxt}>Save Changes</Text>
              </Pressable>
              <Pressable
                style={[ms.cancel, { marginTop: 4 }]}
                onPress={() => {
                  Alert.alert('Delete entry', 'Remove this food from your log?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => { onDelete(entry.id); onClose(); } },
                  ]);
                }}>
                <Text style={[ms.cancelTxt, { color: C.red }]}>Delete Entry</Text>
              </Pressable>
              <Pressable onPress={onClose} style={ms.cancel}>
                <Text style={ms.cancelTxt}>Cancel</Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const ms = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  cardScroll: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  card:      { padding: 24, paddingBottom: 40 },
  title:     { fontFamily: 'PTSerif_400Regular', fontSize: 22, color: C.darkText, marginBottom: 2 },
  brand:     { fontFamily: 'DMSans_400Regular', fontSize: 12, color: C.muted, marginBottom: 4 },
  servRef:   { fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.muted, marginBottom: 14 },
  macroRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.track, borderRadius: 12, padding: 14, marginBottom: 20 },
  calBox:    { alignItems: 'center' },
  calNum:    { fontFamily: 'DMSans_500Medium', fontSize: 28, color: C.darkText, lineHeight: 32 },
  calLbl:    { fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.muted },
  row:       { flexDirection: 'row', marginBottom: 20 },
  inputWrap: { flex: 1 },
  label:     { fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.muted, marginBottom: 4 },
  input:     { borderWidth: 1, borderColor: C.tileBdr, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'DMSans_400Regular', fontSize: 15, color: C.darkText, backgroundColor: C.bg },
  addBtn:    { backgroundColor: C.gold, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  addTxt:    { color: '#fff', fontFamily: 'DMSans_500Medium', fontSize: 15 },
  cancel:    { alignItems: 'center', paddingVertical: 10 },
  cancelTxt: { color: C.muted, fontFamily: 'DMSans_400Regular', fontSize: 14 },
});

// ── Main screen ────────────────────────────────────────────────────
export default function NutritionLog() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { meal: mealParam } = useLocalSearchParams<{ meal?: string }>();

  const [patientId, setPatientId]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [entries, setEntries]         = useState<FoodLogRow[]>([]);
  const [recentFoods, setRecentFoods]     = useState<FoodLogRow[]>([]);
  const [frequentFoods, setFrequentFoods] = useState<Array<{ food_name: string; count: number }>>([]);
  const [waterOz, setWaterOz]             = useState(0);
  const WATER_GOAL = 64;
  // Quick Add modal state
  const [quickAddMeal, setQuickAddMeal] = useState<MealType | null>(null);
  const [qaCal, setQaCal]   = useState('');
  const [qaPro, setQaPro]   = useState('');
  const [qaCarb, setQaCarb] = useState('');
  const [qaFat, setQaFat]   = useState('');
  const [qaLabel, setQaLabel] = useState('');
  const [search, setSearch]           = useState('');
  const [searchResults, setResults]   = useState<FoodSearchItem[]>([]);
  const [searching, setSearching]     = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeMeal, setActiveMeal]   = useState<MealType | null>(null);
  // 'action' = showing Search/Scan options; 'search' = typing search; null = closed
  const [mealMode, setMealMode]       = useState<'action' | 'search' | null>(null);
  const [selectedItem, setSelected]   = useState<FoodSearchItem | null>(null);
  const [editingEntry, setEditing]    = useState<FoodLogRow | null>(null);
  const [logDate]                     = useState(new Date().toISOString().slice(0, 10));

  const searchRef    = useRef<TextInput>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data
  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      try {
        const pid = await fetchPatientIdForAuthUser(user.id);
        setPatientId(pid);
        if (!pid) return;
        const [rows, recent, frequent, waterTotal] = await Promise.all([
          fetchFoodLogsForDate(pid, logDate),
          fetchRecentFoods(pid),
          fetchFrequentFoods(pid),
          fetchWaterOzForDate(pid, logDate),
        ]);
        setEntries(rows);
        setRecentFoods(recent);
        setFrequentFoods(frequent);
        setWaterOz(waterTotal);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, logDate]);

  // Set meal from URL param
  useEffect(() => {
    if (mealParam) {
      setActiveMeal(mealParam as MealType);
      setMealMode('search');
    }
  }, [mealParam]);

  // Search with 300ms debounce — only fires when query is 2+ chars
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchFoodsInstant(search.trim());
        setResults(sortResults(res, search.trim()));
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [search]);

  const totals = entries.reduce(
    (a, e) => ({ cal: a.cal + (e.calories ?? 0), pro: a.pro + (e.protein_g ?? 0), carb: a.carb + (e.carbs_g ?? 0), fat: a.fat + (e.fat_g ?? 0) }),
    { cal: 0, pro: 0, carb: 0, fat: 0 }
  );

  const mealEntries = (meal: MealType) => entries.filter(e => e.meal_type === meal);
  const mealCals    = (meal: MealType) => mealEntries(meal).reduce((a, e) => a + (e.calories ?? 0), 0);

  // Add food to log
  const addFood = useCallback(async (food: FoodSearchItem, qty: number, unit: string) => {
    if (!patientId || !activeMeal) return;
    await upsertFoodLogEntry({
      patient_id: patientId, log_date: logDate, meal_type: activeMeal,
      food_name: food.name, brand: food.brand ?? null,
      calories:     Math.round(food.calories * qty),
      protein_g:    Math.round(food.protein_g * qty * 10) / 10,
      carbs_g:      Math.round(food.carbs_g * qty * 10) / 10,
      fat_g:        Math.round(food.fat_g * qty * 10) / 10,
      serving_size: food.serving_size * qty,
      serving_unit: unit, source: food.source,
    });
    const rows = await fetchFoodLogsForDate(patientId, logDate);
    setEntries(rows);
    setSearch(''); setResults([]); Keyboard.dismiss();
  }, [patientId, activeMeal, logDate]);

  // Edit existing entry (delete + re-insert with scaled values)
  const saveEdit = useCallback(async (entry: FoodLogRow, multiplier: number) => {
    if (!patientId) return;
    await deleteFoodLogEntry(entry.id);
    await upsertFoodLogEntry({
      patient_id: patientId, log_date: logDate, meal_type: entry.meal_type,
      food_name: entry.food_name, brand: entry.brand ?? null,
      calories:     Math.round((entry.calories ?? 0) * multiplier),
      protein_g:    Math.round((entry.protein_g ?? 0) * multiplier * 10) / 10,
      carbs_g:      Math.round((entry.carbs_g ?? 0) * multiplier * 10) / 10,
      fat_g:        Math.round((entry.fat_g ?? 0) * multiplier * 10) / 10,
      serving_size: (entry.serving_size ?? 1) * multiplier,
      serving_unit: entry.serving_unit ?? 'serving', source: entry.source ?? 'manual',
    });
    const rows = await fetchFoodLogsForDate(patientId, logDate);
    setEntries(rows);
  }, [patientId, logDate]);

  const deleteEntry = useCallback(async (id: string) => {
    if (!patientId) return;
    await deleteFoodLogEntry(id);
    const rows = await fetchFoodLogsForDate(patientId, logDate);
    setEntries(rows);
  }, [patientId, logDate]);

  // Tap meal + button
  const openMealAction = (meal: MealType) => {
    if (activeMeal === meal && mealMode !== null) {
      // Toggle off
      setActiveMeal(null); setMealMode(null); setSearch(''); setResults([]);
    } else {
      setActiveMeal(meal); setMealMode('action'); setSearch(''); setResults([]);
    }
  };

  const startSearch = () => {
    setMealMode('search');
    setTimeout(() => searchRef.current?.focus(), 150);
  };

  const goBarcode = () => {
    router.push({ pathname: '/patient/nutrition/scan', params: { mode: 'barcode', meal: activeMeal ?? '' } } as never);
    setMealMode(null);
  };

  const closeActive = () => {
    setActiveMeal(null); setMealMode(null); setSearch(''); setResults([]);
  };

  // Quick Add save handler
  const saveQuickAdd = useCallback(async () => {
    if (!patientId || !quickAddMeal) return;
    const cal = parseFloat(qaCal);
    if (!cal || isNaN(cal)) { Alert.alert('Calories required', 'Enter at least the calorie count.'); return; }
    const saveErr = await upsertFoodLogEntry({
      patient_id:   patientId,
      log_date:     logDate,
      meal_type:    quickAddMeal,
      food_name:    qaLabel.trim() || 'Quick add',
      brand:        null,
      calories:     cal,
      protein_g:    parseFloat(qaPro) || 0,
      carbs_g:      parseFloat(qaCarb) || 0,
      fat_g:        parseFloat(qaFat) || 0,
      serving_size: 1,
      serving_unit: 'serving',
      source:       'manual',
    });
    if (saveErr) {
      console.error('[QuickAdd] save error:', saveErr);
      Alert.alert('Save failed', saveErr);
      return;
    }
    const rows = await fetchFoodLogsForDate(patientId, logDate);
    setEntries(rows);
    setQuickAddMeal(null);
    setQaCal(''); setQaPro(''); setQaCarb(''); setQaFat(''); setQaLabel('');
    Keyboard.dismiss();
  }, [patientId, quickAddMeal, logDate, qaCal, qaPro, qaCarb, qaFat, qaLabel]);

  // Water add handler
  const addWater = useCallback(async (oz: number) => {
    if (!patientId) return;
    await addWaterLog(patientId, logDate, oz);
    setWaterOz(prev => prev + oz);
  }, [patientId, logDate]);

  // Recent foods as FoodSearchItem for selection (15 items)
  const recentAsSearch = useMemo(() => recentFoods.slice(0, 15).map(r => ({
    name: r.food_name, brand: r.brand ?? null,
    calories: r.calories ?? 0, protein_g: r.protein_g ?? 0,
    carbs_g: r.carbs_g ?? 0, fat_g: r.fat_g ?? 0,
    serving_size: r.serving_size ?? 100, serving_unit: r.serving_unit ?? 'g',
    source: (r.source ?? 'usda') as FoodSearchItem['source'], image: null, raw: {},
  })), [recentFoods]);

  const showSearchUI = mealMode === 'search';
  const hasSearch    = search.length >= 2; // only treat as active search when 2+ chars typed

  if (loading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.gold}/>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <BackIcon/>
        </Pressable>
        <Text style={s.headerTitle}>Nutrition Log</Text>
        <View style={{ width: 36 }}/>
      </View>

      {/* ── Daily totals bar ────────────────────────────────────── */}
      <View style={s.totalsBar}>
        {[
          { num: Math.round(totals.cal), lbl: 'Calories', col: C.darkText },
          { num: Math.round(totals.pro), lbl: 'Protein',  col: C.protein, unit: 'g' },
          { num: Math.round(totals.carb),lbl: 'Carbs',    col: C.carbs,   unit: 'g' },
          { num: Math.round(totals.fat), lbl: 'Fat',      col: C.fat,     unit: 'g' },
        ].map((t, i) => (
          <View key={t.lbl} style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
            {i > 0 && <View style={s.totalDivider}/>}
            <View style={s.totalItem}>
              <Text style={[s.totalNum, { color: t.col }]}>{t.num}{t.unit ?? ''}</Text>
              <Text style={s.totalLbl}>{t.lbl}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Search bar (shown when search mode active) ─────────── */}
      {showSearchUI && (
        <View style={s.searchWrap}>
          <SearchIcon/>
          <TextInput
            ref={searchRef}
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={`Search foods for ${MEALS.find(m => m.value === activeMeal)?.label}…`}
            placeholderTextColor={C.muted}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => { setSearch(''); setResults([]); }}>
              <XIcon/>
            </Pressable>
          )}
          <Pressable onPress={closeActive} style={{ paddingLeft: 6 }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: C.muted }}>Done</Text>
          </Pressable>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Search results / Recent foods ───────────────── */}
            {showSearchUI && (
              <View style={s.resultsCard}>
                {/* Header */}
                <View style={s.resultsHeaderRow}>
                  <Text style={s.resultsHeader}>
                    {hasSearch
                      ? (searching ? 'Searching…' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`)
                      : (searchFocused ? 'Recent foods' : '')}
                  </Text>
                  {searching && <ActivityIndicator size="small" color={C.gold}/>}
                </View>

                {/* Recent foods — only shown when search bar is focused but no search query yet */}
                {!hasSearch && searchFocused && recentAsSearch.map((r, i) => (
                  <ResultRow key={`recent-${i}`} item={r} onSelect={() => setSelected(r)} isRecent/>
                ))}

                {/* Search results */}
                {hasSearch && searchResults.map((r, i) => (
                  <ResultRow key={`${r.name}-${i}`} item={r} onSelect={() => {
                    if (!activeMeal) { Alert.alert('Select a meal', 'Tap + on a meal first.'); return; }
                    setSelected(r);
                  }}/>
                ))}

                {hasSearch && !searching && searchResults.length === 0 && (
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: C.muted, padding: 16, textAlign: 'center' }}>
                    No results. Try a different term.
                  </Text>
                )}
              </View>
            )}

            {/* ── Meal sections ───────────────────────────────── */}
            {MEALS.map(({ value, label, emoji }) => {
              const items   = mealEntries(value);
              const mealCal = mealCals(value);
              const isActive = activeMeal === value;

              return (
                <View key={value} style={s.mealSection}>
                  {/* Meal header */}
                  <View style={s.mealHeader}>
                    <View style={s.mealHeaderLeft}>
                      <Text style={s.mealEmoji}>{emoji}</Text>
                      <View>
                        <Text style={s.mealTitle}>{label}</Text>
                        {mealCal > 0 && (
                          <Text style={s.mealCal}>{Math.round(mealCal)} cal</Text>
                        )}
                      </View>
                    </View>
                    <Pressable
                      style={[s.mealAddBtn, isActive && mealMode !== null && s.mealAddBtnActive]}
                      onPress={() => openMealAction(value)}
                    >
                      <PlusIcon color={isActive && mealMode !== null ? '#fff' : C.gold} size={18}/>
                    </Pressable>
                  </View>

                  {/* Inline action: Search Food / Scan Barcode / Quick Add */}
                  {isActive && mealMode === 'action' && (
                    <View style={{ borderTopWidth: 0.5, borderTopColor: C.tileBdr }}>
                      <View style={s.actionRow}>
                        <Pressable style={s.actionBtn} onPress={startSearch}>
                          <SearchIcon/>
                          <Text style={s.actionTxt}>Search Food</Text>
                        </Pressable>
                        <View style={{ width: 1, backgroundColor: C.tileBdr, marginVertical: 4 }}/>
                        <Pressable style={s.actionBtn} onPress={goBarcode}>
                          <BarcodeIcon/>
                          <Text style={s.actionTxt}>Scan Barcode</Text>
                        </Pressable>
                      </View>
                      {/* Quick Add Calories row */}
                      <Pressable
                        style={{ borderTopWidth: 0.5, borderTopColor: C.tileBdr, paddingVertical: 11, alignItems: 'center' }}
                        onPress={() => { setQuickAddMeal(value); setMealMode(null); setActiveMeal(null); }}>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: C.muted }}>
                          ⚡  Quick Add Calories
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Food entries */}
                  {items.length === 0 && mealMode !== 'action' ? (
                    <Text style={s.emptyMeal}>Tap + to add food</Text>
                  ) : (
                    items.map((e) => (
                      <Pressable key={e.id} style={s.entryRow} onPress={() => setEditing(e)}>
                        <View style={s.entryLeft}>
                          <Text style={s.entryName} numberOfLines={1}>{e.food_name}</Text>
                          <Text style={s.entryMeta}>
                            {e.serving_size}{e.serving_unit ? ` ${e.serving_unit}` : ''} · {Math.round(e.protein_g ?? 0)}g P · {Math.round(e.carbs_g ?? 0)}g C · {Math.round(e.fat_g ?? 0)}g F
                          </Text>
                        </View>
                        <View style={s.entryRight}>
                          <Text style={s.entryCal}>{Math.round(e.calories ?? 0)}</Text>
                          <Text style={s.entryCalLbl}>cal</Text>
                          <View style={s.editBtnSmall}>
                            <EditIcon/>
                          </View>
                        </View>
                      </Pressable>
                    ))
                  )}
                </View>
              );
            })}

            {/* ── Frequent foods ────────────────────────────── */}
            {frequentFoods.length > 0 && !showSearchUI && (
              <View style={[s.mealSection, { borderRadius: 14, borderWidth: 1, borderColor: C.tileBdr, ...SHADOW }]}>
                <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: C.muted, letterSpacing: 0.5 }}>YOUR FREQUENT FOODS</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.muted }}>tap to add</Text>
                </View>
                {frequentFoods.slice(0, 10).map((f, i) => (
                  <Pressable key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: C.tileBdr }}
                    onPress={() => {
                      const match = recentFoods.find(r => r.food_name.toLowerCase() === f.food_name.toLowerCase());
                      if (!match) { Alert.alert('Select meal', 'Tap + on a meal first.'); return; }
                      if (!activeMeal) { Alert.alert('Select meal', 'Tap + on a meal section first.'); return; }
                      setSelected({ name: match.food_name, brand: match.brand ?? null, calories: match.calories ?? 0, protein_g: match.protein_g ?? 0, carbs_g: match.carbs_g ?? 0, fat_g: match.fat_g ?? 0, serving_size: match.serving_size ?? 100, serving_unit: match.serving_unit ?? 'g', source: (match.source ?? 'manual') as FoodSearchItem['source'], image: null, raw: {} });
                    }}>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: C.darkText, flex: 1 }} numberOfLines={1}>{f.food_name}</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.muted }}>{f.count}×</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* ── Water tracking ────────────────────────────── */}
            <View style={[s.mealSection, { borderRadius: 14, borderWidth: 1, borderColor: C.tileBdr, paddingHorizontal: 14, paddingVertical: 12, ...SHADOW }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: C.darkText }}>💧 Water</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.muted, marginTop: 1 }}>
                    {Math.round(waterOz)} / {WATER_GOAL} oz
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => void addWater(8)}
                    style={{ backgroundColor: C.gold + '18', borderRadius: 10, borderWidth: 1, borderColor: C.gold + '40', paddingHorizontal: 14, paddingVertical: 8 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: C.gold }}>+ 8 oz</Text>
                  </Pressable>
                  <Pressable onPress={() => void addWater(16)}
                    style={{ backgroundColor: C.gold + '12', borderRadius: 10, borderWidth: 1, borderColor: C.gold + '30', paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: C.gold }}>16 oz</Text>
                  </Pressable>
                </View>
              </View>
              {/* Progress bar */}
              <View style={{ height: 6, backgroundColor: C.tileBdr, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${Math.min(100, (waterOz / WATER_GOAL) * 100)}%`, backgroundColor: '#5BC4DC', borderRadius: 3 }}/>
              </View>
            </View>

          </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Quick Add modal ────────────────────────────────────── */}
      {quickAddMeal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setQuickAddMeal(null)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => setQuickAddMeal(null)}>
            <View style={ms.backdrop}>
              <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
                <View style={ms.card}>
                  <Text style={ms.title}>Quick Add</Text>
                  <Text style={ms.brand}>{MEALS.find(m => m.value === quickAddMeal)?.label}</Text>
                  <View style={{ gap: 12, marginBottom: 20 }}>
                    <QAField label="Calories *" value={qaCal} onChange={setQaCal}/>
                    <QAField label="Protein (g)" value={qaPro} onChange={setQaPro}/>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}><QAField label="Carbs (g)" value={qaCarb} onChange={setQaCarb}/></View>
                      <View style={{ flex: 1 }}><QAField label="Fat (g)" value={qaFat} onChange={setQaFat}/></View>
                    </View>
                    <QAField label="Label (optional)" value={qaLabel} onChange={setQaLabel} keyboard="default"/>
                  </View>
                  <Pressable style={ms.addBtn} onPress={() => void saveQuickAdd()}>
                    <Text style={ms.addTxt}>Log Entry</Text>
                  </Pressable>
                  <Pressable onPress={() => setQuickAddMeal(null)} style={ms.cancel}>
                    <Text style={ms.cancelTxt}>Cancel</Text>
                  </Pressable>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* ── Add serving modal ──────────────────────────────────── */}
      {selectedItem && (
        <ServingModal item={selectedItem} onAdd={addFood} onClose={() => setSelected(null)}/>
      )}

      {/* ── Edit entry modal ───────────────────────────────────── */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onSave={saveEdit}
          onDelete={deleteEntry}
          onClose={() => setEditing(null)}
        />
      )}

    </View>
  );
}

// ── Result row sub-component ───────────────────────────────────────
function ResultRow({
  item, onSelect, isRecent = false,
}: {
  item: FoodSearchItem; onSelect: () => void; isRecent?: boolean;
}) {
  return (
    <Pressable style={s.resultRow} onPress={onSelect}>
      <View style={s.resultLeft}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {isRecent && (
            <View style={{ backgroundColor: C.gold + '20', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: C.gold }}>RECENT</Text>
            </View>
          )}
          <Text style={s.resultName} numberOfLines={1}>{item.name}</Text>
        </View>
        {item.brand && <Text style={s.resultBrand} numberOfLines={1}>{item.brand}</Text>}
        <Text style={s.resultServing}>
          Per {item.serving_size}{item.serving_unit ? ` ${item.serving_unit}` : ''}
        </Text>
        <View style={s.resultPills}>
          <MacroPill label="P" val={item.protein_g} color={C.protein}/>
          <MacroPill label="C" val={item.carbs_g}   color={C.carbs}/>
          <MacroPill label="F" val={item.fat_g}      color={C.fat}/>
        </View>
      </View>
      <View style={s.resultRight}>
        <Text style={s.resultCal}>{Math.round(item.calories)}</Text>
        <Text style={s.resultCalLbl}>cal</Text>
        <View style={s.resultAdd}>
          <PlusIcon size={16}/>
        </View>
      </View>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontFamily: 'PTSerif_400Regular', fontSize: 22, color: C.darkText },

  totalsBar:    { flexDirection: 'row', backgroundColor: C.tileBg, marginHorizontal: 16, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4, marginBottom: 10, ...SHADOW },
  totalItem:    { flex: 1, alignItems: 'center' },
  totalNum:     { fontFamily: 'DMSans_500Medium', fontSize: 17, color: C.darkText, lineHeight: 21 },
  totalLbl:     { fontFamily: 'DMSans_400Regular', fontSize: 10, color: C.muted, marginTop: 1 },
  totalDivider: { width: 1, backgroundColor: C.tileBdr, marginVertical: 4 },

  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.tileBg, marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, gap: 8, borderWidth: 1, borderColor: C.tileBdr, ...SHADOW },
  searchInput:  { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: C.darkText },

  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, gap: 10 },

  // Results
  resultsCard:      { backgroundColor: C.tileBg, borderRadius: 14, borderWidth: 1, borderColor: C.tileBdr, overflow: 'hidden', ...SHADOW },
  resultsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  resultsHeader:    { fontFamily: 'DMSans_500Medium', fontSize: 12, color: C.muted, letterSpacing: 0.5 },
  resultRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: C.tileBdr },
  resultLeft:       { flex: 1, marginRight: 10 },
  resultName:       { fontFamily: 'DMSans_500Medium', fontSize: 14, color: C.darkText },
  resultBrand:      { fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.muted, marginBottom: 2 },
  resultServing:    { fontFamily: 'DMSans_400Regular', fontSize: 10, color: C.muted, marginBottom: 6 },
  resultPills:      { flexDirection: 'row', gap: 5 },
  resultRight:      { alignItems: 'center', minWidth: 50 },
  resultCal:        { fontFamily: 'DMSans_500Medium', fontSize: 17, color: C.darkText, lineHeight: 20 },
  resultCalLbl:     { fontFamily: 'DMSans_400Regular', fontSize: 9, color: C.muted, marginBottom: 4 },
  resultAdd:        { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: C.gold + '12' },

  // Meal sections
  mealSection:      { backgroundColor: C.tileBg, borderRadius: 14, borderWidth: 1, borderColor: C.tileBdr, overflow: 'hidden', ...SHADOW },
  mealHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  mealHeaderLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealEmoji:        { fontSize: 20 },
  mealTitle:        { fontFamily: 'DMSans_500Medium', fontSize: 15, color: C.darkText },
  mealCal:          { fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.muted, marginTop: 1 },
  mealAddBtn:       { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: C.gold + '10' },
  mealAddBtnActive: { backgroundColor: C.gold, borderColor: C.gold },

  // Inline action (Search / Scan)
  actionRow:  { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.tileBdr },
  actionBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  actionTxt:  { fontFamily: 'DMSans_500Medium', fontSize: 14, color: C.gold },

  emptyMeal:  { fontFamily: 'DMSans_400Regular', fontSize: 12, color: C.muted, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2 },

  // Food entries
  entryRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 0.5, borderTopColor: C.tileBdr },
  entryLeft:      { flex: 1 },
  entryName:      { fontFamily: 'DMSans_400Regular', fontSize: 13, color: C.darkText },
  entryMeta:      { fontFamily: 'DMSans_400Regular', fontSize: 11, color: C.muted, marginTop: 2 },
  entryRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryCal:       { fontFamily: 'DMSans_500Medium', fontSize: 15, color: C.darkText },
  entryCalLbl:    { fontFamily: 'DMSans_400Regular', fontSize: 9, color: C.muted },
  editBtnSmall:   { padding: 4, opacity: 0.6 },
});
