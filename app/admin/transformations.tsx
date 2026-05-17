/**
 * Admin — Transformation Stories (full-featured with before/after photos)
 *
 * CREATE TABLE IF NOT EXISTS transformation_stories (
 *   id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   patient_name   TEXT NOT NULL,
 *   treatment_used TEXT NOT NULL,
 *   timeframe      TEXT NOT NULL DEFAULT '3 months',
 *   testimonial    TEXT NOT NULL,
 *   before_photo_url TEXT,
 *   after_photo_url  TEXT,
 *   featured       BOOLEAN DEFAULT FALSE,
 *   created_at     TIMESTAMPTZ DEFAULT NOW()
 * );
 */
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Alert, FlatList, Image, KeyboardAvoidingView,
  Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { supabase } from '@/lib/supabase';

const GOLD  = '#BF8D36';
const GREEN = '#5EC47A';
const PINK  = '#E07878';

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

// ── Photo upload helper ────────────────────────────────────────────────────────
async function uploadStoryPhoto(uri: string, slot: 'before' | 'after', storyId: string): Promise<string | null> {
  const ext  = uri.split('.').pop() ?? 'jpg';
  const path = `transformations/${storyId}/${slot}.${ext}`;
  const body = { uri, type: `image/${ext}`, name: `${slot}.${ext}` };
  const { error } = await supabase.storage
    .from('story-photos')
    .upload(path, body as unknown as Blob, { upsert: true, contentType: `image/${ext}` });
  if (error) return null;
  const { data } = supabase.storage.from('story-photos').getPublicUrl(path);
  return data.publicUrl + `?t=${Date.now()}`;
}

// ── Photo picker button ────────────────────────────────────────────────────────
function PhotoSlot({
  label, uri, onPick, CARD, BORD, MT,
}: {
  label: string; uri: string | null; onPick: () => void;
  CARD: string; BORD: string; MT: string;
}) {
  return (
    <Pressable onPress={onPick}
      style={{ flex: 1, aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: BORD,
        backgroundColor: CARD, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFillObject as object} resizeMode="cover"/>
      ) : (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 28 }}>📷</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT }}>{label}</Text>
        </View>
      )}
      {uri && (
        <View style={{ position: 'absolute', bottom: 6, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: '#fff' }}>Tap to replace</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function TransformationsScreen() {
  const insets = useSafeAreaInsets();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const BG   = tokens.colors.background;
  const SH   = { shadowColor: '#3d2b1a', shadowOffset: { width: 0, height: 3 } as const, shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 };

  const [stories, setStories]           = useState<Story[]>([]);
  const [showForm, setShowForm]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter]   = useState(false);

  // Form fields
  const [name, setName]           = useState('');
  const [treatment, setTreatment] = useState('');
  const [timeframe, setTimeframe] = useState('3 months');
  const [testimonial, setTestimonial] = useState('');
  const [beforeUri, setBeforeUri] = useState<string | null>(null);
  const [afterUri, setAfterUri]   = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('transformation_stories')
      .select('*')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });
    setStories((data ?? []) as Story[]);
  };

  useEffect(() => { void load(); }, []);

  const resetForm = () => {
    setName(''); setTreatment(''); setTimeframe('3 months');
    setTestimonial(''); setBeforeUri(null); setAfterUri(null);
    setShowForm(false);
  };

  const pickPhoto = async (slot: 'before' | 'after') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo library access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [3, 4], quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    if (slot === 'before') setBeforeUri(result.assets[0].uri);
    else setAfterUri(result.assets[0].uri);
  };

  const saveStory = async () => {
    if (!name.trim() || !treatment.trim() || !testimonial.trim()) {
      Alert.alert('Required', 'Name, treatment, and testimonial are required.'); return;
    }
    setSaving(true);
    try {
      // Insert story first to get ID for photo paths
      const { data: inserted, error: insErr } = await supabase
        .from('transformation_stories')
        .insert({
          patient_name: name.trim(),
          treatment_used: treatment.trim(),
          timeframe: timeframe.trim() || '3 months',
          testimonial: testimonial.trim(),
        })
        .select('id')
        .single();
      if (insErr || !inserted) { Alert.alert('Error', insErr?.message ?? 'Insert failed'); return; }

      const storyId = inserted.id as string;
      let beforeUrl: string | null = null;
      let afterUrl:  string | null = null;

      // Upload before photo
      if (beforeUri) {
        setUploadingBefore(true);
        beforeUrl = await uploadStoryPhoto(beforeUri, 'before', storyId);
        setUploadingBefore(false);
      }
      // Upload after photo
      if (afterUri) {
        setUploadingAfter(true);
        afterUrl = await uploadStoryPhoto(afterUri, 'after', storyId);
        setUploadingAfter(false);
      }

      // Update with photo URLs if we have them
      if (beforeUrl || afterUrl) {
        await supabase.from('transformation_stories').update({
          before_photo_url: beforeUrl,
          after_photo_url:  afterUrl,
        }).eq('id', storyId);
      }

      resetForm();
      await load();
      Alert.alert('Saved!', 'Story added.');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    await supabase.from('transformation_stories').update({ featured: !current }).eq('id', id);
    setStories((prev) => prev.map((s) => s.id === id ? { ...s, featured: !current } : s));
  };

  const deleteStory = (id: string) => {
    Alert.alert('Delete story', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('transformation_stories').delete().eq('id', id);
        await load();
      }},
    ]);
  };

  const inp = (label: string, value: string, set: (v: string) => void, opts?: { multiline?: boolean; placeholder?: string }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={value} onChangeText={set}
        placeholder={opts?.placeholder ?? label}
        placeholderTextColor={MT}
        multiline={opts?.multiline}
        numberOfLines={opts?.multiline ? 4 : 1}
        style={{
          backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORD,
          paddingHorizontal: 14, paddingVertical: 11,
          color: TX, fontFamily: 'DMSans_400Regular', fontSize: 15,
          ...(opts?.multiline ? { minHeight: 100, textAlignVertical: 'top' } : {}),
        }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 10,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 24, color: TX }}>Transformations</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT }}>
            {stories.length} stories · {stories.filter(s => s.featured).length} featured
          </Text>
        </View>
        <Pressable onPress={() => setShowForm(!showForm)}
          style={{ backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9, ...SH }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#fff' }}>
            {showForm ? 'Cancel' : '+ Add Story'}
          </Text>
        </Pressable>
      </View>

      {/* Add form */}
      {showForm && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 16, ...SH }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 14 }}>NEW STORY</Text>

              {inp('Patient Name (first name for privacy)', name, setName, { placeholder: 'e.g. Sarah' })}
              {inp('Treatment Used', treatment, setTreatment, { placeholder: 'e.g. GLP-1 + RF Microneedling' })}
              {inp('Timeframe', timeframe, setTimeframe, { placeholder: 'e.g. 6 months' })}

              {/* Before / After photos */}
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginBottom: 8 }}>Before & After Photos</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <PhotoSlot label={uploadingBefore ? 'Uploading…' : 'Before Photo'} uri={beforeUri}
                  onPick={() => void pickPhoto('before')} CARD={CARD} BORD={BORD} MT={MT}/>
                <PhotoSlot label={uploadingAfter ? 'Uploading…' : 'After Photo'} uri={afterUri}
                  onPick={() => void pickPhoto('after')} CARD={CARD} BORD={BORD} MT={MT}/>
              </View>

              {inp('Testimonial Quote', testimonial, setTestimonial, {
                multiline: true, placeholder: 'In their own words…',
              })}

              <Pressable onPress={() => void saveStory()} disabled={saving}
                style={{ backgroundColor: GOLD, borderRadius: 12, paddingVertical: 13, alignItems: 'center', ...SH }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff' }}>
                  {saving ? (uploadingBefore || uploadingAfter ? 'Uploading photos…' : 'Saving…') : 'Save Story'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Stories list */}
      {!showForm && (
        <FlatList
          data={stories}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 32, alignItems: 'center', ...SH }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>✨</Text>
              <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 20, color: TX, marginBottom: 6 }}>No stories yet</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, textAlign: 'center' }}>
                Add your first patient transformation above.
              </Text>
            </View>
          }
          renderItem={({ item: s }) => (
            <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1,
              borderColor: s.featured ? GOLD + '60' : BORD, marginBottom: 12, overflow: 'hidden', ...SH }}>
              {s.featured && <View style={{ height: 3, backgroundColor: GOLD }}/>}

              {/* Before / After photos */}
              {(s.before_photo_url || s.after_photo_url) && (
                <View style={{ flexDirection: 'row', height: 160 }}>
                  {s.before_photo_url ? (
                    <View style={{ flex: 1, position: 'relative' }}>
                      <Image source={{ uri: s.before_photo_url }} style={{ flex: 1 }} resizeMode="cover"/>
                      <View style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.55)',
                        borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontFamily: 'DMSans_500Medium', fontSize: 10 }}>BEFORE</Text>
                      </View>
                    </View>
                  ) : <View style={{ flex: 1, backgroundColor: BORD }}/>}
                  {s.after_photo_url ? (
                    <View style={{ flex: 1, position: 'relative' }}>
                      <Image source={{ uri: s.after_photo_url }} style={{ flex: 1 }} resizeMode="cover"/>
                      <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)',
                        borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontFamily: 'DMSans_500Medium', fontSize: 10 }}>AFTER</Text>
                      </View>
                    </View>
                  ) : <View style={{ flex: 1, backgroundColor: BORD }}/>}
                </View>
              )}

              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 18, color: TX }}>{s.patient_name}</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: GOLD, marginTop: 2 }}>
                      {s.treatment_used} · {s.timeframe}
                    </Text>
                  </View>
                  {s.featured && (
                    <View style={{ backgroundColor: GOLD + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                      borderWidth: 1, borderColor: GOLD + '50' }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: GOLD }}>FEATURED</Text>
                    </View>
                  )}
                </View>

                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, lineHeight: 20,
                  fontStyle: 'italic', marginBottom: 14 }}>"{s.testimonial}"</Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => void toggleFeatured(s.id, s.featured)}
                    style={{ flex: 1, backgroundColor: s.featured ? GREEN + '18' : CARD, borderRadius: 10,
                      paddingVertical: 9, alignItems: 'center', borderWidth: 1,
                      borderColor: s.featured ? GREEN + '50' : BORD }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: s.featured ? GREEN : MT }}>
                      {s.featured ? '★ Featured' : 'Feature'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => deleteStory(s.id)}
                    style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: BORD }}>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: PINK }}>Delete</Text>
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
