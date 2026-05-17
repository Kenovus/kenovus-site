/**
 * Provider — Clinical Notes
 * Add notes per patient per visit. Read-only for patients in their Journey tab.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert, FlatList, KeyboardAvoidingView, Platform,
  Pressable, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { supabase } from '@/lib/supabase';

const GOLD = '#BF8D36';

interface ClinicalNote {
  id: string;
  note_date: string;
  content: string;
  note_type: string;
  provider_name: string | null;
  created_at: string;
}

export default function ClinicalNotesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName: string }>();
  const { profile } = useAuth();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.15)';
  const TX = tokens.colors.text, MT = tokens.colors.textMuted;
  const BG = tokens.colors.background;

  const [notes, setNotes]         = useState<ClinicalNote[]>([]);
  const [newNote, setNewNote]     = useState('');
  const [noteType, setNoteType]   = useState('general');
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  const NOTE_TYPES = ['general', 'post_treatment', 'lab_review', 'follow_up'];

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    const { data } = await supabase
      .from('clinical_notes')
      .select('*')
      .eq('patient_id', patientId)
      .order('note_date', { ascending: false });
    setNotes((data ?? []) as ClinicalNote[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const addNote = async () => {
    if (!newNote.trim() || !patientId) return;
    setSaving(true);
    const { error } = await supabase.from('clinical_notes').insert({
      patient_id: patientId,
      provider_id: profile?.id,
      provider_name: profile?.full_name ?? 'Provider',
      content: newNote.trim(),
      note_type: noteType,
      note_date: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setNewNote('');
    await load();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 4 }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: GOLD }}>← Back</Text>
        </Pressable>
        <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 22, color: TX }}>Clinical Notes</Text>
        {patientName && <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT }}>{patientName}</Text>}
      </View>

      {/* Add note */}
      <View style={{ margin: 16, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 14 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
          {NOTE_TYPES.map((t) => (
            <Pressable key={t} onPress={() => setNoteType(t)}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
                borderColor: noteType === t ? GOLD : BORD, backgroundColor: noteType === t ? GOLD + '18' : 'transparent' }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: noteType === t ? GOLD : MT }}>
                {t.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={newNote} onChangeText={setNewNote}
          placeholder="Add a clinical note..."
          placeholderTextColor={MT}
          multiline numberOfLines={3}
          style={{ color: TX, fontFamily: 'DMSans_400Regular', fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: 10 }}
        />
        <Pressable onPress={() => void addNote()} disabled={saving || !newNote.trim()}
          style={{ backgroundColor: GOLD, borderRadius: 10, paddingVertical: 10, alignItems: 'center', opacity: saving || !newNote.trim() ? 0.5 : 1 }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#fff' }}>
            {saving ? 'Saving…' : 'Save Note'}
          </Text>
        </Pressable>
      </View>

      {/* Notes list */}
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        renderItem={({ item: n }) => (
          <View style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD, padding: 14, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ backgroundColor: GOLD + '18', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: GOLD }}>{n.note_type.replace('_', ' ')}</Text>
              </View>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT }}>{n.note_date}</Text>
            </View>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX, lineHeight: 20, marginBottom: 4 }}>{n.content}</Text>
            {n.provider_name && (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT }}>— {n.provider_name}</Text>
            )}
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}
