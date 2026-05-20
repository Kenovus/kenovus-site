import * as ImagePicker from 'expo-image-picker';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ConsumerPaywallCard } from '@/components/patient/ConsumerPaywallCard';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { canUseNutritionPremium } from '@/lib/consumerTier';
import { lookupBarcodeFood } from '@/lib/nutritionFoodApi';
import { upsertFoodLogEntry } from '@/lib/nutritionLogData';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { estimatePlateFoodsStructuredWithSona } from '@/lib/nutritionVision';
import { useAppTheme } from '@/lib/theme/ThemeProvider';

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type Slot = (typeof SLOTS)[number];
type Mode = 'plate' | 'barcode';

export default function NutritionScan() {
  const insets = useSafeAreaInsets();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string | string[] }>();
  const rawMode = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const initialMode: Mode =
    typeof rawMode === 'string' && rawMode.toLowerCase() === 'barcode' ? 'barcode' : 'plate';
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  const { profile, user } = useAuth();
  const allowed = canUseNutritionPremium(profile);
  const [mode, setMode] = useState<Mode>(initialMode);
  useFocusEffect(
    useCallback(() => {
      setMode(initialMode);
    }, [initialMode]),
  );
  const [mealSlot, setMealSlot] = useState<Slot>('lunch');
  const [cameraPerm, requestCameraPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [scannerOn, setScannerOn] = useState(false);
  const [servingGrams, setServingGrams] = useState('100');
  const [barcodePer100, setBarcodePer100] = useState<{
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null>(null);

  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [barcodeValue, setBarcodeValue] = useState('');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [notes, setNotes] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [plateItems, setPlateItems] = useState<
    Array<{ name: string; estimated_grams: number; calories: number; protein: number; carbs: number; fat: number }>
  >([]);

  const resetForm = () => {
    setPreviewUri(null);
    setBarcodeValue('');
    setFoodName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setNotes('');
    setConfidence(null);
    setPlateItems([]);
    setServingGrams('100');
    setBarcodePer100(null);
  };

  const servingMultiplier = useMemo(() => {
    const g = Number(servingGrams);
    if (!Number.isFinite(g) || g <= 0) return 1;
    return g / 100;
  }, [servingGrams]);

  const saveEntry = async () => {
    if (!user) return;
    if (!foodName.trim()) {
      Alert.alert('Food required', 'Add or confirm the food name first.');
      return;
    }
    setBusy(true);
    try {
      const patientId = await fetchPatientIdForAuthUser(user.id);
      if (!patientId) {
        Alert.alert('Setup', 'Patient profile not found.');
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const error = await upsertFoodLogEntry({
        patient_id: patientId,
        log_date: today,
        meal_type: mealSlot,
        food_name: foodName.trim(),
        calories: Number(calories) || 0,
        protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0,
        fat_g: Number(fat) || 0,
        serving_size: Number(servingGrams) || 1,
        serving_unit: 'g',
        source: mode === 'barcode' ? 'barcode' : 'photo',
        notes: notes || null,
      });
      if (error) {
        Alert.alert('Save failed', error);
        return;
      }
      Alert.alert('Saved', 'Food entry added to your log.');
      resetForm();
    } finally {
      setBusy(false);
    }
  };

  const estimateFromPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera required', 'Allow camera access to analyze meal photos.');
      return;
    }
    setBusy(true);
    try {
      const photo = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
        base64: true,
      });
      if (photo.canceled || !photo.assets?.[0]) return;
      const asset = photo.assets[0];
      if (!asset.base64) {
        Alert.alert('Capture failed', 'Could not read image data.');
        return;
      }
      setPreviewUri(asset.uri ?? null);
      const mediaType = asset.mimeType ?? 'image/jpeg';
      const { estimate, error } = await estimatePlateFoodsStructuredWithSona({
        base64: asset.base64,
        mediaType,
      });
      if (error) {
        Alert.alert('Estimation warning', `${error.message}\n\nYou can edit values and save manually.`);
      }
      setPlateItems(estimate.foods);
      const total = estimate.foods.reduce(
        (a, f) => ({
          calories: a.calories + Number(f.calories || 0),
          protein: a.protein + Number(f.protein || 0),
          carbs: a.carbs + Number(f.carbs || 0),
          fat: a.fat + Number(f.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      setFoodName(estimate.foods.map((f) => f.name).join(', ') || 'Meal photo');
      setCalories(String(Math.round(total.calories)));
      setProtein(String(Math.round(total.protein * 10) / 10));
      setCarbs(String(Math.round(total.carbs * 10) / 10));
      setFat(String(Math.round(total.fat * 10) / 10));
      setBarcodePer100(null);
      setServingGrams('100');
      setConfidence(estimate.confidence);
      setNotes(estimate.notes);
    } finally {
      setBusy(false);
    }
  };

  const onBarcodeScanned = useCallback(
    async (scan: BarcodeScanningResult) => {
      if (!scannerOn) return;
      setScannerOn(false);
      setBusy(true);
      setLookingUp(true);
      try {
        const code = String(scan.data ?? '').trim();
        setBarcodeValue(code);
        const result = await lookupBarcodeFood(code);
        if (!result) {
          Alert.alert('Lookup warning', 'Not found in FatSecret, Open Food Facts, or USDA.');
          return;
        }
        setFoodName(result.name);
        setBarcodePer100({
          calories: result.calories,
          protein_g: result.protein_g,
          carbs_g: result.carbs_g,
          fat_g: result.fat_g,
        });
        setServingGrams('100');
        setCalories(String(result.calories || ''));
        setProtein(String(result.protein_g || ''));
        setCarbs(String(result.carbs_g || ''));
        setFat(String(result.fat_g || ''));
        setConfidence(result.source === 'openfoodfacts' ? 0.82 : result.source === 'fatsecret' ? 0.88 : 0.72);
        setNotes(
          result.source === 'openfoodfacts'
            ? 'Open Food Facts barcode match.'
            : result.source === 'fatsecret'
              ? 'FatSecret barcode match.'
              : 'USDA / generic fallback.',
        );
      } finally {
        setBusy(false);
        setLookingUp(false);
      }
    },
    [scannerOn],
  );

  const [lookingUp, setLookingUp] = useState(false);

  const startBarcodeFlow = async () => {
    // Already granted — open immediately
    if (cameraPerm?.granted) { setScannerOn(true); return; }

    // Can still ask — request once
    if (cameraPerm?.canAskAgain !== false) {
      const ask = await requestCameraPermission();
      if (ask.granted) { setScannerOn(true); return; }
    }

    // Permanently denied — show ONE prompt with Settings link
    Alert.alert(
      'Camera access needed',
      'Please allow camera access in Settings to scan barcodes.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ],
      { cancelable: false },
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
      <Text style={styles.title}>Nutrition scan</Text>
      {!allowed ? (
        <ConsumerPaywallCard
          title="Scan is a Core feature"
          body="Upgrade to Core or GLP-1+ to log packaged foods with a barcode. Manual logging stays available on Free."
        />
      ) : (
        <>
          <View style={styles.switchRow}>
            <Pressable onPress={() => setMode('plate')} style={[styles.switchBtn, mode === 'plate' && styles.switchOn]}>
              <Text style={[styles.switchText, mode === 'plate' && styles.switchTextOn]}>Plate photo</Text>
            </Pressable>
            <Pressable onPress={() => setMode('barcode')} style={[styles.switchBtn, mode === 'barcode' && styles.switchOn]}>
              <Text style={[styles.switchText, mode === 'barcode' && styles.switchTextOn]}>Barcode</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Meal slot</Text>
          <View style={styles.chipsRow}>
            {SLOTS.map((slot) => (
              <Pressable key={slot} onPress={() => setMealSlot(slot)} style={[styles.chip, mealSlot === slot && styles.chipOn]}>
                <Text style={[styles.chipText, mealSlot === slot && styles.chipTextOn]}>{slot}</Text>
              </Pressable>
            ))}
          </View>

          {mode === 'plate' ? (
            <View style={styles.block}>
              <Text style={styles.body}>Snap your plate and Sona will estimate calories and macros.</Text>
              <Button loading={busy} onPress={() => void estimateFromPhoto()} variant="primary">
                Snap plate photo
              </Button>
            </View>
          ) : (
            <View style={styles.block}>
              <Text style={styles.body}>Scan packaged food barcode for auto-filled macros (per 100g).</Text>
              <Button loading={busy} onPress={() => void startBarcodeFlow()} variant="primary">
                {scannerOn ? 'Scanning...' : 'Start barcode scanner'}
              </Button>
              {scannerOn ? (
                <View style={styles.cameraWrap}>
                  <CameraView
                    barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
                    onBarcodeScanned={(r) => void onBarcodeScanned(r)}
                    style={styles.camera}
                  />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ borderWidth: 2, borderColor: '#B8962E', width: 220, height: 100, borderRadius: 8, opacity: 0.7 }}/>
                  </View>
                </View>
              ) : null}
              {lookingUp && (
                <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8 }}>
                  <ActivityIndicator size="large" color={'#B8962E'}/>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#9CA3AF' }}>Looking up barcode…</Text>
                </View>
              )}
              {barcodeValue ? <Text style={styles.meta}>Last scanned: {barcodeValue}</Text> : null}
              <Text style={styles.smallLabel}>Serving size (grams)</Text>
              <TextInput
                value={servingGrams}
                onChangeText={setServingGrams}
                keyboardType="decimal-pad"
                placeholder="100"
                placeholderTextColor={'#6B7280'}
                style={styles.input}
              />
              <Button
                disabled={!barcodePer100}
                onPress={() => {
                  if (!barcodePer100) return;
                  const m = servingMultiplier;
                  setCalories(String(Math.round(barcodePer100.calories * m * 10) / 10));
                  setProtein(String(Math.round(barcodePer100.protein_g * m * 10) / 10));
                  setCarbs(String(Math.round(barcodePer100.carbs_g * m * 10) / 10));
                  setFat(String(Math.round(barcodePer100.fat_g * m * 10) / 10));
                }}
                style={styles.applyBtn}
                variant="ghost">
                Apply serving multiplier
              </Button>
              {barcodePer100 ? (
                <Text style={styles.meta}>Scaled from per-100g nutrition × {servingMultiplier.toFixed(2)}.</Text>
              ) : null}
            </View>
          )}

          {previewUri ? <Image source={{ uri: previewUri }} resizeMode="cover" style={styles.preview} /> : null}
          {mode === 'plate' ? (
            <View style={styles.block}>
              <Text style={styles.meta}>AI estimates — tap to adjust quantities. Looks wrong? Edit manually.</Text>
              {plateItems.map((p, i) => (
                <View key={`${p.name}-${i}`} style={styles.itemRow}>
                  <TextInput
                    value={p.name}
                    onChangeText={(t) =>
                      setPlateItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: t } : x)))
                    }
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TextInput
                    value={String(p.estimated_grams)}
                    onChangeText={(t) =>
                      setPlateItems((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, estimated_grams: Number(t) || 0 } : x,
                        ),
                      )
                    }
                    keyboardType="decimal-pad"
                    style={[styles.input, { width: 84 }]}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.label}>Detected food</Text>
          <TextInput
            value={foodName}
            onChangeText={setFoodName}
            placeholder="Food name"
            placeholderTextColor={'#6B7280'}
            style={styles.input}
          />

          <Text style={styles.label}>Macros</Text>
          <View style={styles.grid}>
            <Field label="Cal" value={calories} onChangeText={setCalories} />
            <Field label="Protein g" value={protein} onChangeText={setProtein} />
            <Field label="Carbs g" value={carbs} onChangeText={setCarbs} />
            <Field label="Fat g" value={fat} onChangeText={setFat} />
          </View>

          {confidence != null ? <Text style={styles.meta}>Confidence: {(confidence * 100).toFixed(0)}%</Text> : null}
          {!!notes && <Text style={styles.meta}>{notes}</Text>}

          <Button loading={busy} onPress={() => void saveEntry()} variant="ghost">
            Save to food log
          </Button>
        </>
      )}
    </ScrollView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (t: string) => void }) {
  const { tokens } = useAppTheme();
  const styles = createStyles(tokens);
  return (
    <View style={styles.field}>
      <Text style={styles.smallLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={'#6B7280'}
        style={styles.input}
      />
    </View>
  );
}

const createStyles = (_tokens: ReturnType<typeof useAppTheme>['tokens']) => {
  // Scan screen is always dark regardless of app theme setting
  const D = {
    bg:       '#0F1923',
    card:     '#1B2A3A',
    gold:     '#B8962E',
    goldDim:  'rgba(184,150,46,0.35)',
    white:    '#FFFFFF',
    cream:    '#E8D5B7',
    muted:    '#9CA3AF',
  };
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: D.bg },
  title: { fontFamily: 'PTSerif_400Regular', fontSize: 28, color: D.cream, marginBottom: 12 },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: D.muted, lineHeight: 24, marginBottom: 12 },
  block: { marginBottom: 16 },
  switchRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  switchBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: D.goldDim,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  switchOn: { backgroundColor: 'rgba(184,150,46,0.18)', borderColor: D.gold },
  switchText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: D.muted },
  switchTextOn: { color: D.white },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 11, color: D.gold, letterSpacing: 1.2, marginTop: 12, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: D.goldDim,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: D.card,
  },
  chipOn: { borderColor: D.gold, backgroundColor: D.gold },
  chipText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: D.muted, textTransform: 'capitalize' as const },
  chipTextOn: { color: D.white },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: D.goldDim,
  },
  cameraWrap: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: D.goldDim,
    borderRadius: 12,
    overflow: 'hidden' as const,
    height: 200,
  },
  camera: { flex: 1 },
  applyBtn: { marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: D.goldDim,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: D.card,
    color: D.white,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  smallLabel: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: D.muted, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { width: '47%' },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: D.muted, marginTop: 8 },
  itemRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
};
