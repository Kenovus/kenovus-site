/**
 * Provider Dashboard — Patient Overview
 * Clinic owners and providers see all patients at their clinic.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { supabase } from '@/lib/supabase';

const GOLD  = '#BF8D36';
const GREEN = '#5EC47A';
const BLUE  = '#5BC4DC';
const PINK  = '#E07878';

interface PatientRow {
  id: string;
  full_name: string;
  consumer_tier: string | null;
  role: string;
  last_active: string | null;
  glp1_medication_name: string | null;
  next_appointment: string | null;
  next_appointment_treatment: string | null;
  simi_flagged: boolean;
}

export default function ProviderPatientsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';

  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.15)';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const BG   = tokens.colors.background;

  const [patients, setPatients]     = useState<PatientRow[]>([]);
  const [filtered, setFiltered]     = useState<PatientRow[]>([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [filterGlp1, setFilterGlp1] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('patients')
      .select(`
        id, role, glp1_medication_name,
        profiles!inner(full_name, consumer_tier, last_sign_in_at),
        patient_appointments(appointment_date, treatment_name, status)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    const rows: PatientRow[] = (data ?? []).map((p: any) => {
      const upcoming = (p.patient_appointments ?? [])
        .filter((a: any) => a.status === 'upcoming')
        .sort((a: any, b: any) => a.appointment_date.localeCompare(b.appointment_date))[0];
      return {
        id: p.id,
        full_name: p.profiles?.full_name ?? 'Unknown',
        consumer_tier: p.profiles?.consumer_tier ?? null,
        role: p.role,
        last_active: p.profiles?.last_sign_in_at ?? null,
        glp1_medication_name: p.glp1_medication_name,
        next_appointment: upcoming?.appointment_date ?? null,
        next_appointment_treatment: upcoming?.treatment_name ?? null,
        simi_flagged: false,
      };
    });
    setPatients(rows);
    setFiltered(rows);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let f = patients;
    if (search) f = f.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));
    if (filterGlp1) f = f.filter((p) => !!p.glp1_medication_name);
    setFiltered(f);
  }, [search, filterGlp1, patients]);

  const tierColor = (tier: string | null, role: string) => {
    if (role === 'clinic_patient') return GOLD;
    if (tier === 'glp1_plus') return BLUE;
    if (tier === 'core') return GREEN;
    return MT;
  };

  const tierLabel = (tier: string | null, role: string) => {
    if (role === 'clinic_patient') return 'Clinic';
    if (tier === 'glp1_plus') return 'GLP-1+';
    if (tier === 'core') return 'Core';
    return 'Free';
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: BG }}>
        <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 26, color: TX, marginBottom: 10 }}>Patients</Text>
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Search by name..."
          placeholderTextColor={MT}
          style={{ backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORD,
            paddingHorizontal: 14, paddingVertical: 10, color: TX, fontFamily: 'DMSans_400Regular', fontSize: 15, marginBottom: 8 }}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['All', false], ['GLP-1', true]].map(([label, val]) => (
            <Pressable key={String(label)} onPress={() => setFilterGlp1(val as boolean)}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                borderColor: filterGlp1 === val ? GOLD : BORD,
                backgroundColor: filterGlp1 === val ? GOLD + '20' : 'transparent' }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: filterGlp1 === val ? GOLD : MT }}>{label as string}</Text>
            </Pressable>
          ))}
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, alignSelf: 'center', marginLeft: 'auto' }}>
            {filtered.length} patients
          </Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item: p }) => {
          const col = tierColor(p.consumer_tier, p.role);
          const lastActive = p.last_active
            ? `${Math.floor((Date.now() - new Date(p.last_active).getTime()) / 86400000)}d ago`
            : 'Never';
          return (
            <Pressable onPress={() => router.push({ pathname: '/provider/patient/[id]', params: { id: p.id } } as never)}
              style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD,
                padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {/* Avatar initial */}
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: col + '22',
                borderWidth: 1.5, borderColor: col, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: col }}>{p.full_name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: TX }}>{p.full_name}</Text>
                  <View style={{ backgroundColor: col + '18', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: col + '40' }}>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: col }}>{tierLabel(p.consumer_tier, p.role)}</Text>
                  </View>
                  {p.glp1_medication_name && <Text style={{ fontSize: 10 }}>💉</Text>}
                  {p.simi_flagged && <Text style={{ fontSize: 10 }}>⚠️</Text>}
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT }}>Active: {lastActive}</Text>
                  {p.next_appointment && (
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: GOLD }}>
                      📅 {p.next_appointment_treatment} {p.next_appointment}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 18, color: MT }}>›</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
