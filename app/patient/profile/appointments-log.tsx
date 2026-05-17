/**
 * PART 3 UI — Manual appointment & treatment logging.
 * Accessed from Profile tab > Appointments section.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert, ImageBackground, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  addAppointment, addTreatment,
  fetchAllAppointments, fetchTreatmentHistory,
  updateAppointmentStatus,
  type PatientAppointment, type PatientTreatment,
} from '@/lib/patientTreatments';
import { useAppTheme } from '@/lib/theme/ThemeProvider';

const GOLD  = '#BF8D36';
const GREEN = '#5EC47A';
const PINK  = '#E07878';
const BLUE  = '#5BC4DC';
const BG_L  = require('../../../assets/images/sona-light-bg.png');
const BG_D  = require('../../../assets/images/sona-bg-dark.png');

const TREATMENT_OPTIONS = [
  'Botox / Daxxify', 'Dermal Fillers', 'HD Radiesse', 'Sculptra', 'Kybella',
  'IPL Photofacial', 'PicoLaser', 'COLite Resurfacing', 'CO2 Deep Resurfacing',
  'Erbium Laser Resurfacing', 'Skinpen Microneedling', 'RF Microneedling',
  'Salt Facial', 'Chemical Peel', 'Hydrafacial', 'Bodytone', 'CoolSculpting',
  'Semaglutide — GLP-1 Injection', 'Other',
];

type TabId = 'upcoming' | 'history' | 'add_appt' | 'log_treatment';

export default function AppointmentsLogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';

  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.86)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const SH   = { shadowColor:'#3d2b1a', shadowOffset:{width:0,height:4} as const, shadowOpacity:0.12, shadowRadius:10, elevation:6 };

  const [patientId, setPatientId] = useState<string | null>(null);
  const [tab, setTab]             = useState<TabId>('upcoming');
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [treatments, setTreatments]     = useState<PatientTreatment[]>([]);
  const [saving, setSaving]             = useState(false);

  // Add appointment form
  const [apptTreatment, setApptTreatment] = useState('');
  const [apptDate, setApptDate]           = useState('');
  const [apptTime, setApptTime]           = useState('');
  const [apptProvider, setApptProvider]   = useState('Simi Kennedy CRNA ARNP');
  const [apptNotes, setApptNotes]         = useState('');

  // Log treatment form
  const [txName, setTxName]         = useState('');
  const [txDate, setTxDate]         = useState('');
  const [txProvider, setTxProvider] = useState('Simi Kennedy CRNA ARNP');
  const [txNotes, setTxNotes]       = useState('');

  useEffect(() => {
    if (!user?.id) return;
    void fetchPatientIdForAuthUser(user.id).then((pid) => {
      setPatientId(pid);
      if (pid) {
        void fetchAllAppointments(pid).then(setAppointments);
        void fetchTreatmentHistory(pid).then(setTreatments);
      }
    });
  }, [user?.id]);

  const refresh = async () => {
    if (!patientId) return;
    const [a, t] = await Promise.all([fetchAllAppointments(patientId), fetchTreatmentHistory(patientId)]);
    setAppointments(a); setTreatments(t);
  };

  const saveAppointment = async () => {
    if (!patientId || !apptTreatment || !apptDate) {
      Alert.alert('Required', 'Treatment name and date are required.'); return;
    }
    setSaving(true);
    const { error } = await addAppointment({
      patient_id: patientId,
      treatment_name: apptTreatment,
      appointment_date: apptDate,
      appointment_time: apptTime || null,
      provider: apptProvider || null,
      status: 'upcoming',
      notes: apptNotes || null,
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error); return; }
    setApptTreatment(''); setApptDate(''); setApptTime(''); setApptNotes('');
    await refresh();
    setTab('upcoming');
    Alert.alert('Saved', 'Appointment added.');
  };

  const saveTreatment = async () => {
    if (!patientId || !txName || !txDate) {
      Alert.alert('Required', 'Treatment name and date are required.'); return;
    }
    setSaving(true);
    const { error } = await addTreatment({
      patient_id: patientId,
      treatment_name: txName,
      treatment_date: txDate,
      provider: txProvider || null,
      notes: txNotes || null,
      photos_urls: [],
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error); return; }
    setTxName(''); setTxDate(''); setTxNotes('');
    await refresh();
    setTab('history');
    Alert.alert('Saved', 'Treatment logged. Check-in reminders will be sent at 24, 48, and 72 hours.');
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = appointments.filter((a) => a.status === 'upcoming' && a.appointment_date >= todayStr);
  const past     = appointments.filter((a) => a.status !== 'upcoming' || a.appointment_date < todayStr);

  return (
    <ImageBackground source={isDark ? BG_D : BG_L} style={{ flex: 1 }} resizeMode="cover">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <Pressable onPress={() => router.back()} style={{ marginBottom: 4 }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: GOLD }}>← Back</Text>
          </Pressable>
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 30, color: TX, marginBottom: 4 }}>
            Appointments & Treatments
          </Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginBottom: 16 }}>
            Manage your Sona visits and treatment history
          </Text>

          {/* Tab row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            {([
              ['upcoming', 'Upcoming'],
              ['history', 'History'],
              ['add_appt', '+ Add Appointment'],
              ['log_treatment', '+ Log Treatment'],
            ] as [TabId, string][]).map(([id, label]) => (
              <Pressable key={id} onPress={() => setTab(id)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
                  borderColor: tab === id ? GOLD : BORD,
                  backgroundColor: tab === id ? GOLD + '20' : CARD, ...SH }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12,
                  color: tab === id ? GOLD : MT }}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ── UPCOMING ── */}
          {tab === 'upcoming' && (
            upcoming.length === 0
              ? <EmptyState msg="No upcoming appointments. Tap + Add Appointment to schedule one." CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              : upcoming.map((a) => (
                <ApptCard key={a.id} appt={a} CARD={CARD} BORD={BORD} TX={TX} MT={MT} SH={SH}
                  onMarkDone={async () => {
                    await updateAppointmentStatus(a.id, 'completed');
                    await refresh();
                  }} />
              ))
          )}

          {/* ── HISTORY ── */}
          {tab === 'history' && (
            <>
              {past.map((a) => (
                <ApptCard key={a.id} appt={a} CARD={CARD} BORD={BORD} TX={TX} MT={MT} SH={SH} />
              ))}
              {treatments.map((t) => (
                <TreatmentCard key={t.id} treatment={t} CARD={CARD} BORD={BORD} TX={TX} MT={MT} SH={SH} />
              ))}
              {past.length === 0 && treatments.length === 0 && (
                <EmptyState msg="No history yet. Log your past Sona treatments to track your aesthetic journey." CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              )}
            </>
          )}

          {/* ── ADD APPOINTMENT ── */}
          {tab === 'add_appt' && (
            <View style={{ gap: 12 }}>
              <TreatmentPicker value={apptTreatment} onChange={setApptTreatment} CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              <Field label="Date (YYYY-MM-DD)" value={apptDate} onChange={setApptDate} placeholder="2026-06-15" CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              <Field label="Time (optional)" value={apptTime} onChange={setApptTime} placeholder="10:30 AM" CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              <Field label="Provider" value={apptProvider} onChange={setApptProvider} CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              <Field label="Notes (optional)" value={apptNotes} onChange={setApptNotes} multiline CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              <Pressable onPress={() => void saveAppointment()}
                style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', ...SH }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff' }}>
                  {saving ? 'Saving…' : 'Save Appointment'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── LOG TREATMENT ── */}
          {tab === 'log_treatment' && (
            <View style={{ gap: 12 }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>
                Log a past Sona treatment to track your history and enable post-treatment check-ins.
              </Text>
              <TreatmentPicker value={txName} onChange={setTxName} CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              <Field label="Treatment Date (YYYY-MM-DD)" value={txDate} onChange={setTxDate} placeholder="2026-05-01" CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              <Field label="Provider" value={txProvider} onChange={setTxProvider} CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              <Field label="Notes (optional)" value={txNotes} onChange={setTxNotes} multiline CARD={CARD} BORD={BORD} TX={TX} MT={MT} />
              <Pressable onPress={() => void saveTreatment()}
                style={{ backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', ...SH }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff' }}>
                  {saving ? 'Saving…' : 'Log Treatment'}
                </Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function ApptCard({ appt, CARD, BORD, TX, MT, SH, onMarkDone }: {
  appt: PatientAppointment; CARD: string; BORD: string; TX: string; MT: string; SH: object;
  onMarkDone?: () => void;
}) {
  const col = appt.status === 'upcoming' ? BLUE : appt.status === 'completed' ? '#5EC47A' : '#E07878';
  const daysUntil = appt.status === 'upcoming'
    ? Math.ceil((new Date(`${appt.appointment_date}T12:00:00`).getTime() - Date.now()) / 86400000)
    : null;
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, marginBottom: 10, overflow: 'hidden', ...SH }}>
      <View style={{ height: 3, backgroundColor: col }} />
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 17, color: TX, flex: 1 }}>{appt.treatment_name}</Text>
          <View style={{ backgroundColor: col + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: col, textTransform: 'capitalize' }}>
              {appt.status}{daysUntil != null && daysUntil >= 0 ? ` · ${daysUntil === 0 ? 'Today' : `${daysUntil}d`}` : ''}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>📅 {appt.appointment_date}{appt.appointment_time ? `  🕐 ${appt.appointment_time}` : ''}</Text>
        {appt.provider && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginTop: 2 }}>👩‍⚕️ {appt.provider}</Text>}
        {appt.notes && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, marginTop: 6, fontStyle: 'italic' }}>{appt.notes}</Text>}
        {onMarkDone && (
          <Pressable onPress={onMarkDone} style={{ marginTop: 10, alignSelf: 'flex-end' }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#5EC47A' }}>✓ Mark completed</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function TreatmentCard({ treatment, CARD, BORD, TX, MT, SH }: {
  treatment: PatientTreatment; CARD: string; BORD: string; TX: string; MT: string; SH: object;
}) {
  const daysAgo = Math.floor((Date.now() - new Date(`${treatment.treatment_date}T12:00:00`).getTime()) / 86400000);
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 14, marginBottom: 10, ...SH }}>
      <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 17, color: TX, marginBottom: 4 }}>{treatment.treatment_name}</Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>📅 {treatment.treatment_date}  ·  {daysAgo} days ago</Text>
      {treatment.provider && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT, marginTop: 2 }}>👩‍⚕️ {treatment.provider}</Text>}
      {treatment.notes && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, marginTop: 6, fontStyle: 'italic' }}>{treatment.notes}</Text>}
    </View>
  );
}

function Field({ label, value, onChange, placeholder, multiline, CARD, BORD, TX, MT }: {
  label: string; value: string; onChange: (s: string) => void; placeholder?: string;
  multiline?: boolean; CARD: string; BORD: string; TX: string; MT: string;
}) {
  return (
    <View>
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: MT, marginBottom: 6 }}>{label.toUpperCase()}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={MT}
        multiline={multiline} numberOfLines={multiline ? 3 : 1}
        style={{ backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORD,
          paddingHorizontal: 14, paddingVertical: 11, color: TX,
          fontFamily: 'DMSans_400Regular', fontSize: 15,
          minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? 'top' : undefined }} />
    </View>
  );
}

function TreatmentPicker({ value, onChange, CARD, BORD, TX, MT }: {
  value: string; onChange: (s: string) => void; CARD: string; BORD: string; TX: string; MT: string;
}) {
  return (
    <View>
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: MT, marginBottom: 8 }}>TREATMENT</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TREATMENT_OPTIONS.map((t) => (
          <Pressable key={t} onPress={() => onChange(t)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
              borderColor: value === t ? GOLD : BORD,
              backgroundColor: value === t ? GOLD + '18' : CARD }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: value === t ? GOLD : MT }}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={value} onChangeText={onChange}
        placeholder="Or type a custom treatment..."
        placeholderTextColor={MT}
        style={{ marginTop: 8, backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORD,
          paddingHorizontal: 14, paddingVertical: 10, color: TX, fontFamily: 'DMSans_400Regular', fontSize: 14 }}
      />
    </View>
  );
}

function EmptyState({ msg, CARD, BORD, TX, MT }: {
  msg: string; CARD: string; BORD: string; TX: string; MT: string;
}) {
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 24, alignItems: 'center' }}>
      <Text style={{ fontSize: 32, marginBottom: 12 }}>📅</Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, textAlign: 'center', lineHeight: 20 }}>{msg}</Text>
    </View>
  );
}
