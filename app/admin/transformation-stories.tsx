/**
 * Admin — Transformation Stories
 * Lance documents 10-20 real beta success stories during beta.
 */
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Alert, FlatList, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { supabase } from '@/lib/supabase';

const GOLD  = '#BF8D36';
const GREEN = '#5EC47A';

interface Story {
  id: string;
  patient_name: string;
  treatment_used: string;
  timeframe: string;
  testimonial: string;
  before_photo_url: string | null;
  after_photo_url: string | null;
  featured: boolean;
  created_at: string;
}

// ── SQL to run once ─────────────────────────────────────────────────────────
export const STORIES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS transformation_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  treatment_used TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  testimonial TEXT NOT NULL,
  before_photo_url TEXT,
  after_photo_url TEXT,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export default function TransformationStoriesScreen() {
  const insets = useSafeAreaInsets();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const TX = tokens.colors.text, MT = tokens.colors.textMuted;
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)' : 'rgba(191,141,54,0.18)';
  const BG = tokens.colors.background;
  const SH = { shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 3 } as const, shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 };

  const [stories, setStories]     = useState<Story[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  // Form fields
  const [name, setName]           = useState('');
  const [treatment, setTreatment] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [testimonial, setTestimonial] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('transformation_stories')
      .select('*')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });
    setStories((data ?? []) as Story[]);
  };

  useEffect(() => { void load(); }, []);

  const resetForm = () => { setName(''); setTreatment(''); setTimeframe(''); setTestimonial(''); setShowForm(false); };

  const saveStory = async () => {
    if (!name.trim() || !treatment.trim() || !testimonial.trim()) {
      Alert.alert('Required', 'Name, treatment, and testimonial are required.'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('transformation_stories').insert({
      patient_name: name.trim(),
      treatment_used: treatment.trim(),
      timeframe: timeframe.trim() || 'Unknown',
      testimonial: testimonial.trim(),
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    resetForm();
    await load();
    Alert.alert('Saved!', 'Story added to the collection.');
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    await supabase.from('transformation_stories').update({ featured: !current }).eq('id', id);
    setStories((prev) => prev.map((s) => s.id === id ? { ...s, featured: !current } : s));
  };

  const deleteStory = (id: string) => {
    Alert.alert('Delete story', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('transformation_stories').delete().eq('id', id);
        await load();
      }},
    ]);
  };

  const inputStyle = { backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORD,
    paddingHorizontal: 14, paddingVertical: 11, color: TX, fontFamily: 'DMSans_400Regular', fontSize: 15, marginBottom: 12 };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 24, color: TX }}>Transformation Stories</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>{stories.length} stories · {stories.filter(s => s.featured).length} featured</Text>
        </View>
        <Pressable onPress={() => setShowForm(!showForm)}
          style={{ backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#fff' }}>{showForm ? 'Cancel' : '+ Add Story'}</Text>
        </Pressable>
      </View>

      {/* Add form */}
      {showForm && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, marginBottom: 16, ...SH }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 14 }}>NEW STORY</Text>
            {[
              { label: 'Patient Name (first name only for privacy)', value: name, set: setName, placeholder: 'e.g. Sarah' },
              { label: 'Treatment Used', value: treatment, set: setTreatment, placeholder: 'e.g. GLP-1 + RF Microneedling' },
              { label: 'Timeframe', value: timeframe, set: setTimeframe, placeholder: 'e.g. 6 months' },
            ].map(({ label, value, set, placeholder }) => (
              <View key={label}>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginBottom: 5 }}>{label}</Text>
                <TextInput value={value} onChangeText={set} placeholder={placeholder} placeholderTextColor={MT} style={inputStyle}/>
              </View>
            ))}
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginBottom: 5 }}>Testimonial Quote</Text>
            <TextInput value={testimonial} onChangeText={setTestimonial}
              placeholder="In their own words..." placeholderTextColor={MT}
              multiline numberOfLines={4}
              style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}/>
            <Pressable onPress={() => void saveStory()} disabled={saving}
              style={{ backgroundColor: GOLD, borderRadius: 12, paddingVertical: 13, alignItems: 'center', ...SH }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff' }}>
                {saving ? 'Saving…' : 'Save Story'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Stories list */}
      {!showForm && (
        <FlatList
          data={stories}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 32, alignItems: 'center', ...SH }}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>📸</Text>
              <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 20, color: TX, marginBottom: 6 }}>No stories yet</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, textAlign: 'center' }}>
                Add your first transformation story using the button above.
              </Text>
            </View>
          }
          renderItem={({ item: s }) => (
            <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: s.featured ? GOLD + '60' : BORD, marginBottom: 12, overflow: 'hidden', ...SH }}>
              {s.featured && <View style={{ height: 3, backgroundColor: GOLD }}/>}
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 18, color: TX }}>{s.patient_name}</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: GOLD, marginTop: 2 }}>
                      {s.treatment_used} · {s.timeframe}
                    </Text>
                  </View>
                  {s.featured && (
                    <View style={{ backgroundColor: GOLD + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: GOLD + '50' }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: GOLD }}>FEATURED</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, lineHeight: 20, fontStyle: 'italic', marginBottom: 14 }}>
                  "{s.testimonial}"
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => void toggleFeatured(s.id, s.featured)}
                    style={{ flex: 1, backgroundColor: s.featured ? GREEN + '18' : CARD, borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: s.featured ? GREEN + '50' : BORD }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: s.featured ? GREEN : MT }}>
                      {s.featured ? '★ Featured' : 'Feature'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => deleteStory(s.id)}
                    style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: BORD }}>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#E07878' }}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
