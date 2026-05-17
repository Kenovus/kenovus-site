import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminSection } from '@/components/admin/AdminSection';
import { Button } from '@/components/ui/Button';
import { colors, typography } from '@/constants/designSystem';
import { useAuth } from '@/hooks/useAuth';
import { analyzeReceiptWithClaude, listBusinessExpenses, saveBusinessExpense, uploadExpenseReceipt } from '@/lib/expenses';

type Row = {
  id: string;
  expense_date: string;
  merchant: string | null;
  amount: number | null;
  category: string | null;
  submitted_by_name: string | null;
  receipt_image_url: string | null;
};

export default function AdminExpensesScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

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
  const [processingReceipt, setProcessingReceipt] = useState(false);

  const load = useCallback(async () => {
    const { rows: listRows } = await listBusinessExpenses();
    setRows(listRows);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scanReceipt = async () => {
    setBusy(true);
    setProcessingReceipt(false);
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
        authUserId: profile?.auth_user_id ?? 'super-admin',
        base64: asset.base64,
        mimeType: mime,
      });
      if (upload.error) {
        Alert.alert('Upload failed', upload.error.message);
        return;
      }
      setReceiptStoragePath(upload.storagePath);
      setReceiptSignedUrl(upload.signedUrl);
      setProcessingReceipt(true);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 15000);
      });
      try {
        const analyzed = (await Promise.race([
          analyzeReceiptWithClaude({
            base64: asset.base64,
            mediaType: mime,
          }),
          timeoutPromise,
        ])) as Awaited<ReturnType<typeof analyzeReceiptWithClaude>>;
        if (analyzed.error) {
          Alert.alert("Couldn't read receipt — please enter manually");
          return;
        }
        setMerchant(analyzed.draft.merchant);
        setAmount(String(analyzed.draft.amount || ''));
        setCategory(analyzed.draft.category);
        setExpenseDate(analyzed.draft.expenseDate);
        setNotes(analyzed.draft.notes);
        setConfidence(analyzed.draft.confidence);
        setRawExtraction(analyzed.draft.raw);
      } catch {
        Alert.alert("Couldn't read receipt — please enter manually");
      } finally {
        setProcessingReceipt(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const saveExpense = async () => {
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
      <Text style={styles.title}>Expense Tracker</Text>
      <Text style={styles.subtitle}>Scan receipt -&gt; auto-categorize with Claude -&gt; save to clinic expenses.</Text>

      {profile?.role !== 'super_admin' ? (
        <Text style={styles.meta}>Super Admin access required for receipt scanning and clinic expense management.</Text>
      ) : null}

      <AdminSection title="New Expense">
        <Button disabled={profile?.role !== 'super_admin'} onPress={() => void scanReceipt()} loading={busy} variant="primary">
          Scan Receipt (Camera)
        </Button>
        {processingReceipt ? <Text style={styles.meta}>Processing receipt...</Text> : null}
        {receiptPreview ? <Image source={{ uri: receiptPreview }} style={styles.preview} resizeMode="cover" /> : null}

        <Field label="Merchant" value={merchant} onChangeText={setMerchant} />
        <Field label="Amount (USD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field label="Category" value={category} onChangeText={setCategory} />
        <Field label="Expense date (YYYY-MM-DD)" value={expenseDate} onChangeText={setExpenseDate} />
        <Field label="Notes" value={notes} onChangeText={setNotes} />
        <Text style={styles.meta}>Claude confidence: {(confidence * 100).toFixed(0)}%</Text>
        <Button disabled={profile?.role !== 'super_admin'} onPress={() => void saveExpense()} loading={busy} variant="ghost">
          Save Expense
        </Button>
      </AdminSection>

      <AdminSection title="Recent Expenses">
        {rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.rowMain}>
              {r.expense_date} · {r.merchant ?? 'Merchant'}
            </Text>
            <Text style={styles.rowSub}>
              ${Number(r.amount ?? 0).toFixed(2)} · {r.category ?? 'other'} · by {r.submitted_by_name ?? 'admin'}
            </Text>
          </View>
        ))}
      </AdminSection>
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
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  label: { ...typography.label, color: colors.goldLight, marginBottom: 6, marginTop: 6 },
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
  meta: { ...typography.body, color: colors.gray2, fontSize: 12, marginTop: 8 },
  row: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.darkCard,
  },
  rowMain: { ...typography.body, color: colors.white },
  rowSub: { ...typography.body, color: colors.gray1, fontSize: 13, marginTop: 4 },
});
