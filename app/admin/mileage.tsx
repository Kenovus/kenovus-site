/**
 * Mileage & Expense Tracker
 * SQL:
 * CREATE TABLE IF NOT EXISTS mileage_logs (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL,
 *   trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
 *   start_location TEXT NOT NULL DEFAULT '',
 *   end_location TEXT NOT NULL DEFAULT '',
 *   miles NUMERIC(8,2) NOT NULL DEFAULT 0,
 *   purpose TEXT NOT NULL DEFAULT 'Business',
 *   category TEXT NOT NULL DEFAULT 'other',
 *   deductible_amount NUMERIC(8,2) NOT NULL DEFAULT 0,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */
import { useEffect, useState } from 'react';
import {
  Alert, ImageBackground, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { supabase } from '@/lib/supabase';

const GOLD  = '#BF8D36';
const GREEN = '#5EC47A';
const IRS_RATE_2025 = 0.67; // $0.67/mile business 2025

const PURPOSES = ['Business', 'Medical', 'Charity', 'Personal'];
const CATEGORIES = [
  { id: 'client_meeting',   label: 'Client Meeting' },
  { id: 'supply_pickup',    label: 'Supply Pickup' },
  { id: 'bank_post',        label: 'Bank / Post Office' },
  { id: 'medical',          label: 'Medical' },
  { id: 'training',         label: 'Training' },
  { id: 'other',            label: 'Other' },
];

interface MileageRow {
  id: string;
  trip_date: string;
  start_location: string;
  end_location: string;
  miles: number;
  purpose: string;
  category: string;
  deductible_amount: number;
  notes: string | null;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function MileageScreen() {
  const insets = useSafeAreaInsets();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const SH   = { shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 4 } as const, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5 };

  const [tab, setTab] = useState<'log' | 'history' | 'reports'>('log');
  const [logs, setLogs]     = useState<MileageRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [tripDate, setTripDate]       = useState(todayStr());
  const [startLoc, setStartLoc]       = useState('');
  const [endLoc, setEndLoc]           = useState('');
  const [miles, setMiles]             = useState('');
  const [purpose, setPurpose]         = useState('Business');
  const [category, setCategory]       = useState('client_meeting');
  const [notes, setNotes]             = useState('');

  const load = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: rows } = await supabase
      .from('mileage_logs')
      .select('*')
      .eq('user_id', data.user.id)
      .order('trip_date', { ascending: false })
      .limit(100);
    setLogs((rows ?? []) as MileageRow[]);
  };

  useEffect(() => { void load(); }, []);

  const deductible = (m: number, p: string) => {
    if (p === 'Business') return Math.round(m * IRS_RATE_2025 * 100) / 100;
    if (p === 'Medical')  return Math.round(m * 0.21 * 100) / 100;
    if (p === 'Charity')  return Math.round(m * 0.14 * 100) / 100;
    return 0;
  };

  const saveTrip = async () => {
    const m = parseFloat(miles);
    if (!m || m <= 0) { Alert.alert('Miles required', 'Enter the number of miles driven.'); return; }
    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('Not logged in');
      const ded = deductible(m, purpose);
      const { error } = await supabase.from('mileage_logs').insert({
        user_id: data.user.id,
        trip_date: tripDate,
        start_location: startLoc.trim() || 'Not specified',
        end_location: endLoc.trim() || 'Not specified',
        miles: m,
        purpose,
        category,
        deductible_amount: ded,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      setMiles(''); setStartLoc(''); setEndLoc(''); setNotes('');
      await load();
      setTab('history');
      Alert.alert('Logged! ✓', `${m} miles · $${ded.toFixed(2)} deductible`);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // YTD totals
  const currentYear = new Date().getFullYear().toString();
  const ytdLogs = logs.filter((l) => l.trip_date.startsWith(currentYear));
  const ytdMiles = ytdLogs.reduce((s, l) => s + l.miles, 0);
  const ytdDeductible = ytdLogs.reduce((s, l) => s + l.deductible_amount, 0);

  // Monthly
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthLogs = logs.filter((l) => l.trip_date.startsWith(currentMonth));
  const monthMiles = monthLogs.reduce((s, l) => s + l.miles, 0);

  const exportCSV = async () => {
    if (!ytdLogs.length) { Alert.alert('No data', 'No mileage logged this year.'); return; }
    const header = 'Date,From,To,Miles,Purpose,Category,Deductible,Notes';
    const rows = ytdLogs.map((l) =>
      `${l.trip_date},"${l.start_location}","${l.end_location}",${l.miles},${l.purpose},${l.category},$${l.deductible_amount},"${l.notes ?? ''}"`,
    );
    const csv = [header, ...rows].join('\n');
    await Share.share({
      title: `Mileage Log ${currentYear}`,
      message: `Mileage Log ${currentYear}\n\nYTD: ${ytdMiles.toFixed(1)} miles · $${ytdDeductible.toFixed(2)} deductible\n\n${csv}`,
    });
  };

  const inp = (label: string, val: string, set: (v: string) => void, opts?: { numeric?: boolean; placeholder?: string }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={val}
        onChangeText={set}
        placeholder={opts?.placeholder ?? ''}
        placeholderTextColor={MT}
        keyboardType={opts?.numeric ? 'decimal-pad' : 'default'}
        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)', borderRadius: 12, borderWidth: 1, borderColor: BORD, paddingHorizontal: 14, paddingVertical: 11, color: TX, fontFamily: 'DMSans_400Regular', fontSize: 15 }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      {/* Header + YTD strip */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: isDark ? 'rgba(191,141,54,0.10)' : 'rgba(191,141,54,0.08)', borderBottomWidth: 1, borderBottomColor: BORD }}>
        <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 24, color: TX, marginBottom: 2 }}>Mileage Tracker</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginBottom: 10 }}>IRS 2025 rate: $0.67/mile business</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {[
            { label: 'YTD Miles', value: ytdMiles.toFixed(1) },
            { label: 'YTD Deductible', value: `$${ytdDeductible.toFixed(0)}` },
            { label: 'This Month', value: `${monthMiles.toFixed(1)} mi` },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORD, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 18, color: GOLD }}>{s.value}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: MT, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2, gap: 8 }}>
        {(['log', 'history', 'reports'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)}
            style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10, backgroundColor: tab === t ? GOLD : CARD, borderWidth: 1, borderColor: tab === t ? GOLD : BORD }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: tab === t ? '#fff' : MT }}>
              {t === 'log' ? 'Log Trip' : t === 'history' ? 'History' : 'Reports'}
            </Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── LOG TRIP ── */}
          {tab === 'log' && (
            <View style={[{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 18 }, SH]}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 14 }}>NEW TRIP</Text>
              {inp('Date', tripDate, setTripDate, { placeholder: 'YYYY-MM-DD' })}
              {inp('From', startLoc, setStartLoc, { placeholder: 'Starting location' })}
              {inp('To', endLoc, setEndLoc, { placeholder: 'Destination' })}
              {inp('Miles', miles, setMiles, { numeric: true, placeholder: '0.0' })}

              {miles ? (
                <View style={{ backgroundColor: GOLD + '15', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: GOLD + '40', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: TX }}>Deductible ({purpose})</Text>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: GOLD }}>${deductible(parseFloat(miles) || 0, purpose).toFixed(2)}</Text>
                </View>
              ) : null}

              {/* Purpose */}
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginBottom: 6 }}>PURPOSE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {PURPOSES.map((p) => (
                  <Pressable key={p} onPress={() => setPurpose(p)}
                    style={{ borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: purpose === p ? GOLD : CARD, borderColor: purpose === p ? GOLD : BORD }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: purpose === p ? '#fff' : TX }}>{p}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Category */}
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginBottom: 6 }}>CATEGORY</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {CATEGORIES.map((c) => (
                  <Pressable key={c.id} onPress={() => setCategory(c.id)}
                    style={{ borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: category === c.id ? GOLD + '22' : CARD, borderColor: category === c.id ? GOLD : BORD }}>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: category === c.id ? GOLD : TX }}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>

              {inp('Notes (optional)', notes, setNotes, { placeholder: 'Client name, purpose detail…' })}

              <Pressable onPress={() => void saveTrip()} disabled={saving}
                style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: saving ? 0.6 : 1 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: '#fff' }}>{saving ? 'Saving…' : 'Log Trip'}</Text>
              </Pressable>
            </View>
          )}

          {/* ── HISTORY ── */}
          {tab === 'history' && (
            <>
              {logs.length === 0 ? (
                <View style={[{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 32, alignItems: 'center' }, SH]}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🚗</Text>
                  <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 20, color: TX }}>No trips yet</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginTop: 6, textAlign: 'center' }}>Log your first trip using the Log Trip tab.</Text>
                </View>
              ) : logs.map((l) => (
                <View key={l.id} style={[{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD, padding: 14, marginBottom: 8 }, SH]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: TX }}>{l.trip_date}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: GOLD }}>{l.miles} mi</Text>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: GREEN }}>${l.deductible_amount.toFixed(2)}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>
                    {l.start_location} → {l.end_location}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginTop: 3 }}>
                    {l.purpose} · {CATEGORIES.find((c) => c.id === l.category)?.label ?? l.category}
                  </Text>
                  {l.notes ? <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginTop: 3, fontStyle: 'italic' }}>{l.notes}</Text> : null}
                </View>
              ))}
            </>
          )}

          {/* ── REPORTS ── */}
          {tab === 'reports' && (
            <View style={[{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 20 }, SH]}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 16 }}>YEAR-TO-DATE {currentYear}</Text>

              {[
                { label: 'Total Miles', value: `${ytdMiles.toFixed(1)} miles` },
                { label: 'Business Deductible', value: `$${ytdDeductible.toFixed(2)}` },
                { label: 'Total Trips', value: String(ytdLogs.length) },
                { label: 'IRS Rate Applied', value: '$0.67/mile (2025)' },
              ].map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: BORD }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT }}>{s.label}</Text>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: TX }}>{s.value}</Text>
                </View>
              ))}

              <Pressable onPress={() => void exportCSV()}
                style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 8 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff' }}>Export CSV for CPA</Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
