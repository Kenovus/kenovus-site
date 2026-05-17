import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { analyzeReceiptWithClaude, listBusinessExpenses, saveBusinessExpense, uploadExpenseReceipt } from '@/lib/expenses';
import { listClinicOwnerRoiReports } from '@/lib/roiReports';

export default function ProviderFinance() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<{ id: string; period_start: string; period_end: string; report_text: string; created_at: string }>>([]);
  const [expenseRows, setExpenseRows] = useState<
    Array<{
      id: string;
      expense_date: string;
      merchant: string | null;
      amount: number | null;
      category: string | null;
      submitted_by_name: string | null;
      receipt_image_url: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [rawExtraction, setRawExtraction] = useState<Record<string, unknown>>({});
  const [receiptStoragePath, setReceiptStoragePath] = useState<string | null>(null);
  const [receiptSignedUrl, setReceiptSignedUrl] = useState<string | null>(null);

  const canScanReceipts = profile?.role === 'clinic_owner';

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ clinicName: cn, rows: reportRows }, { rows: expenses }] = await Promise.all([
        listClinicOwnerRoiReports(user.id),
        listBusinessExpenses(30),
      ]);
      setClinicName(cn);
      setRows(reportRows);
      setExpenseRows(expenses);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const scanReceipt = async () => {
    if (!canScanReceipts) return;
    setBusy(true);
    try {
      const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPerm.granted) {
        Alert.alert('Camera required', 'Allow camera access to scan receipts.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Capture failed', 'Could not read image data.');
        return;
      }
      setReceiptPreview(asset.uri ?? null);

      const mime = asset.mimeType ?? 'image/jpeg';
      const upload = await uploadExpenseReceipt({
        authUserId: profile?.auth_user_id ?? user?.id ?? 'clinic-owner',
        base64: asset.base64,
        mimeType: mime,
      });
      if (upload.error) {
        Alert.alert('Upload failed', upload.error.message);
        return;
      }
      setReceiptStoragePath(upload.storagePath);
      setReceiptSignedUrl(upload.signedUrl);

      const analyzed = await analyzeReceiptWithClaude({
        base64: asset.base64,
        mediaType: mime,
      });
      if (analyzed.error) {
        Alert.alert('Claude analysis warning', `${analyzed.error.message}\n\nYou can still edit and save manually.`);
      }
      setMerchant(analyzed.draft.merchant);
      setAmount(String(analyzed.draft.amount || ''));
      setCategory(analyzed.draft.category);
      setExpenseDate(analyzed.draft.expenseDate);
      setNotes(analyzed.draft.notes);
      setConfidence(analyzed.draft.confidence);
      setRawExtraction(analyzed.draft.raw);
    } finally {
      setBusy(false);
    }
  };

  const saveExpense = async () => {
    if (!canScanReceipts) return;
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      Alert.alert('Amount required', 'Enter a valid amount.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await saveBusinessExpense({
        profile,
        merchant: merchant.trim() || 'Unknown merchant',
        amount: amountNum,
        category: category.trim() || 'other',
        notes: notes.trim(),
        expenseDate: expenseDate.trim() || new Date().toISOString().slice(0, 10),
        confidence,
        receiptStoragePath,
        receiptImageUrl: receiptSignedUrl ?? receiptPreview,
        rawExtraction,
      });
      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }
      Alert.alert('Saved', 'Expense added.');
      setMerchant('');
      setAmount('');
      setCategory('other');
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setConfidence(0);
      setRawExtraction({});
      setReceiptPreview(null);
      setReceiptStoragePath(null);
      setReceiptSignedUrl(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 30, paddingHorizontal: 20 }}>
      <Text style={styles.title}>Finance · ROI Reports</Text>
      <Text style={styles.subtitle}>
        {clinicName ? `${clinicName} performance narrative and value delivery summary.` : 'Clinic ROI reports.'}
      </Text>
      <Button variant="ghost" onPress={() => router.push('/provider/clinical-metrics' as never)} style={{ marginBottom: 10 }}>
        Open Clinical Metrics
      </Button>
      {loading ? <Text style={styles.meta}>Loading...</Text> : null}

      {rows.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.label}>
            Period {r.period_start} -&gt; {r.period_end}
          </Text>
          <Text style={styles.meta}>Generated {new Date(r.created_at).toLocaleString()}</Text>
          <Text style={styles.body}>{r.report_text}</Text>
        </View>
      ))}
      {!loading && rows.length === 0 ? <Text style={styles.meta}>No ROI reports generated yet.</Text> : null}

      <Text style={[styles.title, { marginTop: 10 }]}>Clinic Expenses</Text>
      <Text style={styles.subtitle}>
        {canScanReceipts
          ? 'Scan receipt with Claude Vision, review autofill, then save to clinic expenses.'
          : 'Receipt scanning is available for clinic owners.'}
      </Text>

      <View style={styles.card}>
        <Button disabled={!canScanReceipts} onPress={() => void scanReceipt()} loading={busy} variant="primary">
          Scan Receipt (Camera)
        </Button>
        {receiptPreview ? <Image source={{ uri: receiptPreview }} style={styles.preview} resizeMode="cover" /> : null}

        <Field label="Merchant" value={merchant} onChangeText={setMerchant} />
        <Field label="Amount (USD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field label="Category" value={category} onChangeText={setCategory} />
        <Field label="Expense date (YYYY-MM-DD)" value={expenseDate} onChangeText={setExpenseDate} />
        <Field label="Notes" value={notes} onChangeText={setNotes} />
        <Text style={styles.meta}>Claude confidence: {(confidence * 100).toFixed(0)}%</Text>
        <Button disabled={!canScanReceipts} onPress={() => void saveExpense()} loading={busy} variant="ghost">
          Save Expense
        </Button>
      </View>

      {expenseRows.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.label}>
            {r.expense_date} - {r.merchant ?? 'Merchant'}
          </Text>
          <Text style={styles.meta}>
            ${Number(r.amount ?? 0).toFixed(2)} - {r.category ?? 'other'} - by {r.submitted_by_name ?? 'staff'}
          </Text>
        </View>
      ))}
      {!loading && expenseRows.length === 0 ? <Text style={styles.meta}>No clinic expenses saved yet.</Text> : null}

      <Button variant="ghost" onPress={() => void load()} loading={loading}>
        Refresh
      </Button>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        style={styles.input}
        placeholder={props.label}
        placeholderTextColor={colors.gray2}
        keyboardType={props.keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.dark },
  title: { ...typography.h1, color: colors.white, marginBottom: 8 },
  subtitle: { ...typography.body, color: colors.gray1, marginBottom: 14 },
  card: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.darkCard,
    marginBottom: 10,
  },
  label: { ...typography.label, color: colors.gold, marginBottom: 8 },
  body: { ...typography.body, color: colors.white, lineHeight: 21 },
  meta: { ...typography.body, color: colors.gray2, fontSize: 12, marginBottom: 8 },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  input: {
    ...typography.body,
    color: colors.white,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.dark2,
  },
});
