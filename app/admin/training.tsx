/**
 * Staff Training Portal — Mia's Education Hub
 * Read-only for staff. Protocols, care instructions, quizzes.
 */
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { supabase } from '@/lib/supabase';

const GOLD  = '#BF8D36';
const GREEN = '#5EC47A';
const BLUE  = '#5BC4DC';

interface Module {
  id: string;
  title: string;
  emoji: string;
  color: string;
  description: string;
  sections: Section[];
}

interface Section {
  title: string;
  content: string;
  videoUrl?: string;
  quizQuestion?: string;
  quizOptions?: string[];
  quizAnswer?: number;
}

const TRAINING_MODULES: Module[] = [
  {
    id: 'treatments', title: 'Treatment Protocols', emoji: '💉', color: GOLD,
    description: 'How to assist with each Sona service',
    sections: [
      { title: 'Botox / Daxxify', content: 'Neuromodulator injections targeting dynamic facial muscles. Key muscles: frontalis, corrugator, orbicularis. Onset 3-5 days, full effect 14 days. Post-care: upright 4hrs, no exercise, no touching.' },
      { title: 'Dermal Fillers / HD Radiesse', content: 'Hyaluronic acid and calcium hydroxyapatite fillers for volume and structure. Radiesse is biostimulatory. Post-care: ice, elevated sleep, no pressure on area for 48hrs.' },
      { title: 'IPL Photofacial', content: 'Intense pulsed light targeting pigment and vascular lesions. Treats solar damage, rosacea, sun spots. 3-5 treatments recommended. Post-care: SPF 50+, no sun for 2 weeks.' },
      { title: 'RF Microneedling', content: 'Radiofrequency energy delivered through microneedles. Stimulates collagen remodeling. Best for laxity and texture. Series of 3 recommended. Post-care: gentle skincare 48hrs, no makeup day of.' },
    ],
  },
  {
    id: 'glp1', title: 'GLP-1 Program', emoji: '⚕️', color: BLUE,
    description: 'Understanding the semaglutide / tirzepatide protocol',
    sections: [
      { title: 'How GLP-1 Works', content: 'GLP-1 receptor agonists slow gastric emptying, reduce appetite, and improve insulin sensitivity. Patients typically inject weekly. Results: 15-25% body weight reduction over 12-18 months with lifestyle support.' },
      { title: 'Monitoring Protocol', content: 'Labs every 3 months: HbA1c, CMP, CBC, lipid panel. Watch for: muscle loss (InBody critical), nutrient deficiencies, nausea leading to inadequate intake.' },
      { title: 'Nutrition Priorities', content: 'NEVER: skip protein. ALWAYS: 1.0-1.2g protein per lb goal weight. Resistance training minimum 3x/week. Creatine 3-5g daily. Calorie floor: women 1200, men 1600.' },
      { title: 'Side Effect Management', content: 'Nausea: eat slowly, cold foods, ginger tea, small frequent meals. Constipation: hydration, fiber, walking. Injection site: rotate sites, room temp medication. Escalate to Simi: vomiting preventing adequate intake.' },
    ],
  },
  {
    id: 'supplements', title: 'Supplement Education', emoji: '💊', color: GREEN,
    description: "Sona's endorsed supplement approach",
    sections: [
      { title: 'Creatine', content: 'Evidence A. 3-5g/day maintenance. Up to 10g on low-sleep days. Never exceed 20g/day. Key for muscle preservation on GLP-1. Safe for kidneys in healthy individuals. Always recommend checking with Simi first.' },
      { title: 'Thorne Supplements', content: "Sona endorses Thorne as the preferred brand for quality and purity. Key products: Basic Nutrients, Magnesium Bisglycinate, Omega-3, Vitamin D/K2. Check with Simi before adding any new supplements, especially on medications." },
      { title: 'Muscle Preservation Stack', content: 'For GLP-1 patients: Creatine (3-5g) + HMB (3g) + Magnesium (400mg) + Vitamin D (2000-5000IU) + Omega-3 (2-4g EPA/DHA). This stack supports muscle preservation during weight loss.' },
    ],
  },
  {
    id: 'app', title: 'SonaLife App Walkthrough', emoji: '📱', color: GOLD,
    description: 'How to guide patients through the app',
    sections: [
      { title: 'Onboarding Flow', content: 'Patients start at welcome screen → select GLP-1 or aesthetic path → enter clinic code → complete profile. Clinic code links them to Sona. Staff can find clinic codes in the admin panel.' },
      { title: 'Sona AI Coach', content: "Patients can ask Sona anything health-related. Sona knows their full history: weight, labs, supplements, workouts, food log. Encourage patients to use Sona daily — it's like having a personal coach available 24/7." },
      { title: 'Food Logging', content: 'Patients can describe meals in plain language (\"I had salmon and rice\") or use the barcode scanner. Sona automatically logs it. Encourage protein-first logging. Check macro bars weekly.' },
      { title: 'Progress Tracking', content: 'Weight, InBody results, body photos, skin scans all sync here. Post-treatment check-ins come through this app — critical for Simi\'s review queue. Staff should remind patients to complete check-ins.' },
    ],
  },
];

export default function TrainingScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.15)';
  const TX = tokens.colors.text, MT = tokens.colors.textMuted;
  const BG = tokens.colors.background;

  const [activeModule, setActiveModule]   = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<number>(0);
  const [quizAnswered, setQuizAnswered]   = useState<Record<string, number>>({});
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());

  const module = TRAINING_MODULES.find((m) => m.id === activeModule);

  const markComplete = async (moduleId: string) => {
    setCompletedModules((prev) => new Set([...prev, moduleId]));
    if (profile?.id) {
      await supabase.from('staff_training_progress').upsert({
        user_id: profile.id, module_id: moduleId, completed: true, completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,module_id' });
    }
  };

  const pct = Math.round((completedModules.size / TRAINING_MODULES.length) * 100);

  if (activeModule && module) {
    const sec = module.sections[activeSection];
    return (
      <ScrollView style={{ flex: 1, backgroundColor: BG }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}>
        <Pressable onPress={() => { setActiveModule(null); setActiveSection(0); }} style={{ marginBottom: 8 }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: GOLD }}>← Back to Modules</Text>
        </Pressable>
        <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 22, color: TX, marginBottom: 2 }}>{module.title}</Text>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, marginBottom: 16 }}>
          Section {activeSection + 1} of {module.sections.length}
        </Text>

        {/* Section nav */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
          {module.sections.map((s, i) => (
            <Pressable key={i} onPress={() => setActiveSection(i)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                borderColor: activeSection === i ? module.color : BORD,
                backgroundColor: activeSection === i ? module.color + '20' : CARD }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: activeSection === i ? module.color : MT }}>{s.title}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 20, color: TX, marginBottom: 12 }}>{sec.title}</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: TX, lineHeight: 24 }}>{sec.content}</Text>
          {sec.videoUrl && (
            <Pressable onPress={() => Linking.openURL(sec.videoUrl!)}
              style={{ marginTop: 14, backgroundColor: module.color + '18', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: module.color + '40', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>▶️</Text>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: module.color }}>Watch Training Video</Text>
            </Pressable>
          )}
        </View>

        {/* Navigation */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {activeSection > 0 && (
            <Pressable onPress={() => setActiveSection(activeSection - 1)}
              style={{ flex: 1, backgroundColor: CARD, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: BORD }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: TX }}>← Previous</Text>
            </Pressable>
          )}
          {activeSection < module.sections.length - 1 ? (
            <Pressable onPress={() => setActiveSection(activeSection + 1)}
              style={{ flex: 1, backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#fff' }}>Next →</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => { void markComplete(module.id); setActiveModule(null); }}
              style={{ flex: 1, backgroundColor: GREEN, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#fff' }}>✓ Complete Module</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}>
      <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 28, color: TX, marginBottom: 4 }}>Staff Training</Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, marginBottom: 16 }}>
        Sona protocols, treatment care, and app training
      </Text>

      {/* Progress bar */}
      <View style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD, padding: 14, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: TX }}>Training Progress</Text>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: GOLD }}>{pct}%</Text>
        </View>
        <View style={{ height: 8, backgroundColor: BORD, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: GOLD, borderRadius: 4 }} />
        </View>
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginTop: 6 }}>
          {completedModules.size} of {TRAINING_MODULES.length} modules completed
        </Text>
      </View>

      {TRAINING_MODULES.map((m) => {
        const done = completedModules.has(m.id);
        return (
          <Pressable key={m.id} onPress={() => { setActiveModule(m.id); setActiveSection(0); }}
            style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORD, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: m.color + '18', borderWidth: 1, borderColor: m.color + '40', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24 }}>{done ? '✅' : m.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'PTSerif_400Regular', fontSize: 18, color: TX, marginBottom: 2 }}>{m.title}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>{m.description}</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginTop: 2 }}>{m.sections.length} sections</Text>
            </View>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 18, color: MT }}>›</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
