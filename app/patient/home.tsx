import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ForecastTeaserCard } from '@/components/forecast/ForecastTeaserCard';
import { fetchFoodLogsForDate } from '@/lib/nutritionLogData';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { localDateKey } from '@/lib/patientSupplements';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme/ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import { useDailyChecklist } from '@/hooks/useDailyChecklist';
import { useDailyGreetingStorage } from '@/hooks/useDailyGreetingStorage';
import { useGoogleReviewMilestone } from '@/hooks/useGoogleReviewMilestone';
import { usePostGreetingGoalPrompt } from '@/hooks/usePostGreetingGoalPrompt';
import { useRetentionAutomation } from '@/hooks/useRetentionAutomation';
import { useVitality } from '@/hooks/useVitality';
import { buildDailyPlan, type DailyPlan } from '@/lib/dailyPlan';
import {
  fetchDailyWins,
  fetchStreakInfo,
  upsertDailyWins,
  streakIdentityLine,
  streakMilestoneMessage,
  type DailyWinState,
} from '@/lib/dailyWins';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Brand constants ─────────────────────────────────────────────────────────
const GOLD = '#BF8D36';
const BLUE = '#5BC4DC';
const PINK = '#E07878';
const GREEN = '#5EC47A';

const ASSETS = {
  bgLight: require('../../assets/images/sona-light-bg.png'),
  bgDark:  require('../../assets/images/sona-bg-dark.png'),
  logoLight: require('../../assets/images/sona-logo-light.png'),
  logoGold:  require('../../assets/images/sona-logo-gold.png'),
  model: require('../../assets/images/model-card.png'),
} as const;

// ─── Icons ───────────────────────────────────────────────────────────────────
function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}
function AppleIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 4s-1.5-2-3.5-2" />
      <Path d="M18.5 9s2 1.5 2 5c0 5-3.5 8-8.5 8s-8.5-3-8.5-8c0-4 2.5-6.5 5-6.5 1.5 0 2.5.5 3 .5s1.5-.5 3-.5c1.5 0 2.8.8 3.5 1.5z" />
    </Svg>
  );
}
function ScaleIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 13h20M2 21h20M12 13V7M8 10l4-3 4 3" />
    </Svg>
  );
}
function RunIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={14.5} cy={3.5} r={1.5} />
      <Path d="M6 20l3.5-6.5L12 16l3-5 3 2.5M5 12.5l4-3 2 2.5 4-5.5" />
    </Svg>
  );
}
function ClipIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1z" />
      <Path d="M4 4h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <Path d="M9 11h6M9 15h4" />
    </Svg>
  );
}
function CamIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx={12} cy={13} r={4} />
    </Svg>
  );
}
function BarIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 5v3M3 16v3M21 5v3M21 16v3M7 5v14M12 5v14M17 5v14M10 5v14M15 5v14" />
    </Svg>
  );
}
function PieIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <Path d="M22 12A10 10 0 0 0 12 2v10z" />
    </Svg>
  );
}

// ─── Calorie Ring ─────────────────────────────────────────────────────────────
function CalorieRing({ current, total }: { current: number; total: number }) {
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const r = 44;
  const cx = 52;
  const cy = 52;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  const dash = pct * circ;
  return (
    <Svg width={104} height={104} viewBox="0 0 104 104">
      <Circle cx={cx} cy={cy} r={r}
        fill={isDark ? 'rgba(255,255,255,0.06)' : 'white'}
        stroke={isDark ? 'rgba(191,141,54,0.30)' : '#ede5d5'}
        strokeWidth={10} />
      <Circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={GOLD}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        rotation={-90}
        origin={`${cx},${cy}`}
      />
    </Svg>
  );
}

// ─── Macro Bar ────────────────────────────────────────────────────────────────
function MacroBar({ label, val, max, color, textColor }: {
  label: string; val: number; max: number; color: string; textColor: string;
}) {
  const pct = max > 0 ? Math.min(val / max, 1) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <Text style={{ fontSize: 12, color: textColor, fontFamily: 'DMSans_500Medium' }}>{label}</Text>
        <Text style={{ fontSize: 11, color: textColor + 'AA', fontFamily: 'DMSans_400Regular' }}>
          {Math.round(val)}g{' '}
          <Text style={{ fontSize: 10, opacity: 0.6 }}>/ {max}g</Text>
        </Text>
      </View>
      <View style={{ height: 7, backgroundColor: color + '28', borderRadius: 999 }}>
        <View style={{
          height: '100%',
          width: pct > 0 ? `${Math.round(pct * 100)}%` : '5%',
          backgroundColor: color,
          borderRadius: 999,
        }} />
      </View>
    </View>
  );
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PatientHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, user, superAdminViewMode, setSuperAdminViewMode } = useAuth();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';

  useRetentionAutomation();
  useVitality();
  const checklist = useDailyChecklist();
  useGoogleReviewMilestone(checklist.streak);
  const { showDailyGreeting, greetingDateLoaded } = useDailyGreetingStorage();
  usePostGreetingGoalPrompt(showDailyGreeting, greetingDateLoaded);

  const [macros, setMacros] = useState({ cal: 0, protein: 0, fat: 0, carbs: 0 });
  const [goals, setGoals] = useState({ cal: 2500, protein: 220, fat: 90, carbs: 250 });
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  // Win the Day checkboxes — persisted to Supabase daily_wins
  const [winChecks, setWinChecks] = useState<Omit<DailyWinState, 'all_three'>>({ protein_hit: false, training_done: false, steps_hit: false });
  const [winCelebrated, setWinCelebrated] = useState(false);
  // Streak from patient_streaks table
  const [dbStreak, setDbStreak] = useState(0);
  const [dbLongest, setDbLongest] = useState(0);
  // Patient ID cache
  const [patientId, setPatientId] = useState<string | null>(null);
  // Focus Mode (hides non-essential home screen content)
  const [focusMode, setFocusMode] = useState(false);

  const refreshMacros = useCallback(async () => {
    if (!user?.id) return;
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (!pid) return;
      const logs = await fetchFoodLogsForDate(pid, localDateKey(new Date()));
      let cal = 0, protein = 0, fat = 0, carbs = 0;
      for (const e of logs) {
        cal += e.calories ?? 0;
        protein += e.protein_g ?? 0;
        fat += e.fat_g ?? 0;
        carbs += e.carbs_g ?? 0;
      }
      setMacros({ cal: Math.round(cal), protein: Math.round(protein), fat: Math.round(fat), carbs: Math.round(carbs) });
      const { data } = await supabase
        .from('patient_macro_goals')
        .select('calories,protein_g,fat_g,carbs_g')
        .eq('patient_id', pid)
        .maybeSingle();
      if (data) setGoals({ cal: data.calories ?? 2500, protein: data.protein_g ?? 220, fat: data.fat_g ?? 90, carbs: data.carbs_g ?? 250 });
    } catch (e) {
      console.warn('[home] macro refresh failed', e);
    }
  }, [user?.id]);

  // Load daily plan + focus mode + win-the-day state from Supabase
  const refreshPlan = useCallback(async () => {
    if (!user?.id) return;
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (!pid) return;
      setPatientId(pid);
      const today = new Date().toISOString().slice(0, 10);
      const [plan, wins, streak, fm] = await Promise.all([
        buildDailyPlan(pid, user.id),
        fetchDailyWins(pid, today),
        fetchStreakInfo(pid),
        AsyncStorage.getItem('focus_mode'),
      ]);
      setDailyPlan(plan);
      setWinChecks({ protein_hit: wins.protein_hit, training_done: wins.training_done, steps_hit: wins.steps_hit });
      if (wins.all_three) setWinCelebrated(true);
      setDbStreak(streak.current_streak);
      setDbLongest(streak.longest_streak);
      setFocusMode(fm === '1');
    } catch (e) { console.warn('[home] plan refresh failed', e); }
  }, [user?.id]);

  const toggleWin = useCallback(async (key: 'protein_hit' | 'training_done' | 'steps_hit') => {
    if (!patientId) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = { ...winChecks, [key]: !winChecks[key] };
    setWinChecks(next);
    await upsertDailyWins(patientId, today, next);
    if (next.protein_hit && next.training_done && next.steps_hit && !winCelebrated) {
      setWinCelebrated(true);
      // Refresh streak after all-three achieved
      const streak = await fetchStreakInfo(patientId);
      setDbStreak(streak.current_streak);
      setDbLongest(streak.longest_streak);
    }
  }, [winChecks, winCelebrated, patientId]);

  useFocusEffect(useCallback(() => { void refreshMacros(); void refreshPlan(); }, [refreshMacros, refreshPlan]));

  const s = useMemo(() => makeStyles(isDark), [isDark]);

  const firstName = profile?.full_name?.split(/\s+/)[0] ?? 'there';
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const showAdminExit = profile?.role === 'super_admin' && superAdminViewMode === 'patient';

  const iconColor = isDark ? GOLD : GOLD;
  const textPrimary = isDark ? '#F4F1E8' : '#1a1008';
  const textMuted = isDark ? 'rgba(244,241,232,0.62)' : '#9a826a';

  return (
    <ImageBackground
      source={isDark ? ASSETS.bgDark : ASSETS.bgLight}
      style={s.root}
      resizeMode="cover">

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 6 }]}
        showsVerticalScrollIndicator={false}>

        {showAdminExit && (
          <Pressable onPress={() => { setSuperAdminViewMode('admin'); router.replace('/admin/command'); }} style={s.adminPill}>
            <Text style={s.adminPillText}>← Admin</Text>
          </Pressable>
        )}

        {/* ── Header ── */}
        <View style={s.header}>
          <Pressable style={s.iconBtn}>
            <BellIcon color={textPrimary} />
          </Pressable>
          <View style={s.logoWrap}>
            <Image
              source={isDark ? ASSETS.logoGold : ASSETS.logoLight}
              style={s.logoImg}
              resizeMode="contain"
            />
          </View>
          <Pressable style={s.avatarRing} onPress={() => router.push('/patient/profile' as Href)}>
            <Image source={ASSETS.model} style={s.avatarImg} resizeMode="cover" />
          </Pressable>
        </View>

        {/* ── Greeting ── */}
        <Text style={[s.greet, { color: textPrimary }]}>{timeGreeting()} {firstName}</Text>
        <Text style={[s.date, { color: textMuted }]}>{dateLine}</Text>

        {/* ── Streak ── */}
        {(dbStreak > 0 || checklist.streak > 0) && (() => {
          const streak = Math.max(dbStreak, checklist.streak);
          const milestone = streakMilestoneMessage(streak);
          return (
            <View style={s.streakBadge}>
              <Text style={s.streakText}>🔥 {streak} day{streak !== 1 ? 's' : ''} on track</Text>
              <Text style={[s.streakText, { fontSize: 11, opacity: 0.8 }]}>{milestone ?? streakIdentityLine(streak)}</Text>
            </View>
          );
        })()}

        {/* ── Daily Plan Card ── */}
        {dailyPlan && (
          <View style={[s.planCard, { backgroundColor: isDark ? 'rgba(191,141,54,0.12)' : 'rgba(191,141,54,0.10)' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 16, color: textPrimary }}>
                {dailyPlan.trainingFocus === 'Rest Day' ? '😴 Rest Day' : `🏋️ ${dailyPlan.trainingFocus}`}
              </Text>
              <View style={{ backgroundColor: GOLD + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: GOLD }}>
                  {dailyPlan.isTrainingDay ? 'Training Day' : 'Rest Day'}
                </Text>
              </View>
            </View>

            {/* Calorie + Protein targets */}
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
              <View>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 22, color: GOLD, fontWeight: '700' }}>
                  {dailyPlan.calorieTarget.toLocaleString()}
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: textMuted }}>kcal target</Text>
              </View>
              <View style={{ width: 1, backgroundColor: GOLD + '30' }}/>
              <View>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 22, color: '#5BC4DC', fontWeight: '700' }}>
                  {dailyPlan.proteinTarget}g
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: textMuted }}>protein (non-negotiable)</Text>
              </View>
              <View style={{ width: 1, backgroundColor: GOLD + '30' }}/>
              <View>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 18, color: textPrimary, fontWeight: '700' }}>
                  {(dailyPlan.stepsTarget / 1000).toFixed(0)}k
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: textMuted }}>steps</Text>
              </View>
            </View>

            {/* Focus actions */}
            {dailyPlan.focusActions.map((action, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                <Text style={{ color: GOLD, fontSize: 14 }}>⭐</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: textPrimary, flex: 1, lineHeight: 18 }}>{action}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Win the Day ── */}
        {dailyPlan && (
          <View style={[s.planCard, { backgroundColor: winCelebrated ? GOLD + '18' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.80)' }]}>
            {winCelebrated ? (
              <>
                <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 18, color: GOLD, textAlign: 'center', marginBottom: 4 }}>
                  You won today! 🏆
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: textMuted, textAlign: 'center' }}>
                  {dbStreak > 0 ? `${dbStreak}-day streak · ${streakIdentityLine(dbStreak)}` : 'Every win builds the streak.'}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: textMuted, letterSpacing: 1.3, marginBottom: 10 }}>WIN THE DAY</Text>
                {([
                  { key: 'protein_hit' as const,   label: `Hit protein goal (${dailyPlan.proteinTarget}g)`,                              done: winChecks.protein_hit },
                  { key: 'training_done' as const,  label: dailyPlan.isTrainingDay ? 'Complete training session' : 'Active recovery done', done: winChecks.training_done },
                  { key: 'steps_hit' as const,      label: `Hit ${(dailyPlan.stepsTarget / 1000).toFixed(0)}k steps`,                    done: winChecks.steps_hit },
                ]).map(({ key, label, done }) => (
                  <Pressable key={key} onPress={() => void toggleWin(key)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
                      borderColor: done ? GOLD : textMuted + '60',
                      backgroundColor: done ? GOLD : 'transparent',
                      alignItems: 'center', justifyContent: 'center' }}>
                      {done && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
                    </View>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14,
                      color: done ? textMuted : textPrimary,
                      textDecorationLine: done ? 'line-through' : 'none', flex: 1 }}>{label}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}

        {/* ── Focus Mode: only show quick log, hide everything else ── */}
        {focusMode && (
          <Pressable
            onPress={() => router.push('/patient/nutrition' as Href)}
            style={{ backgroundColor: GOLD, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10,
              shadowColor: GOLD, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: '#fff' }}>+ Quick Log</Text>
          </Pressable>
        )}

        {/* ── Non-focus-mode content ── */}
        {!focusMode && <>

        {/* ── Physique Forecast teaser (only renders when goal exists) ── */}
        <ForecastTeaserCard variant="home" />

        {/* ── Upcoming appointment card (shows when appt within 7 days) ── */}
        <Pressable style={s.apptCard} onPress={() => router.push('/patient/appointments' as Href)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.apptTitle, { color: textPrimary }]}>Upcoming: Botox — Forehead</Text>
              <Text style={[s.apptSub, { color: textMuted }]}>May 22  ·  10:30 AM  ·  Dr. Simi Batra</Text>
            </View>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 18, color: textMuted }}>›</Text>
          </View>
        </Pressable>

        {/* ── Post-treatment check-in banner (shows 72 hrs after procedure) ── */}
        <Pressable style={s.checkinBanner} onPress={() => router.push('/patient/check-in' as Href)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18 }}>💊</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.checkinTitle}>Recovery Check-In Due</Text>
              <Text style={s.checkinSub}>72-hr follow-up after your Hydrafacial on May 8</Text>
            </View>
            <View style={{ backgroundColor: '#BF8D36', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#fff' }}>Start →</Text>
            </View>
          </View>
        </Pressable>

        {/* ── Coach Card ── */}
        <View style={s.coachShadow}>
          <Pressable style={s.coachCard} onPress={() => router.push('/patient/sona' as Href)}>
            <View style={s.coachLeft}>
              <View>
                <Text style={[s.coachTitle, { color: textPrimary }]}>AI Coach – "Sona" ✦</Text>
                <Text style={[s.coachSub, { color: textMuted }]}>Your personalized plan{'\n'}is on track</Text>
              </View>
              <Pressable style={s.askBtn} onPress={() => router.push('/patient/sona' as Href)}>
                <Text style={s.askTxt}>Ask anything...</Text>
                <Text style={s.askTxt}>›</Text>
              </Pressable>
            </View>
            <View style={s.modelWrap}>
              <Image
                source={ASSETS.model}
                style={s.modelImg}
                resizeMode="cover"
              />
            </View>
          </Pressable>
        </View>

        {/* ── 3 Log Tiles ── */}
        <View style={s.tiles3}>
          {([
            { icon: <AppleIcon color={iconColor} />, label: 'Log my food',   href: '/patient/nutrition' },
            { icon: <ScaleIcon color={iconColor} />, label: 'Log my weight', href: '/patient/progress' },
            { icon: <RunIcon   color={iconColor} />, label: 'Log exercise',  href: '/patient/progress' },
          ] as const).map(({ icon, label, href }, i) => (
            <Pressable key={i} style={s.tile3} onPress={() => router.push(href as Href)}>
              {icon}
              <Text style={[s.tile3Lbl, { color: textPrimary }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Stats Card ── */}
        <View style={s.statsCard}>
          <View style={s.ringWrap}>
            <CalorieRing current={macros.cal} total={goals.cal} />
            <View style={StyleSheet.absoluteFillObject}>
              <View style={s.ringCenter}>
                <Text style={[s.ringNum, { color: textPrimary }]}>{macros.cal}</Text>
                <Text style={[s.ringOf, { color: textMuted }]}>of {goals.cal}{'\n'}kcal</Text>
              </View>
            </View>
          </View>
          <View style={s.macrosCol}>
            <MacroBar label="Protein" val={macros.protein} max={goals.protein} color={BLUE}  textColor={textPrimary} />
            <MacroBar label="Fat"     val={macros.fat}     max={goals.fat}     color={PINK}  textColor={textPrimary} />
            <MacroBar label="Carbs"   val={macros.carbs}   max={goals.carbs}   color={GREEN} textColor={textPrimary} />
          </View>
        </View>

        {/* ── 4 Action Tiles ── */}
        <View style={s.tiles4}>
          {([
            { icon: <ClipIcon color={iconColor} />, label: 'Build my Plan', href: '/patient/profile/my-goals' },
            { icon: <CamIcon  color={iconColor} />, label: 'Meal scan',     href: '/patient/nutrition/scan?mode=plate' },
            { icon: <BarIcon  color={iconColor} />, label: 'Barcode scan',  href: '/patient/nutrition/scan?mode=barcode' },
            { icon: <PieIcon  color={iconColor} />, label: 'Skin scan',     href: '/patient/progress/scan' },
          ] as const).map(({ icon, label, href }, i) => (
            <Pressable key={i} style={s.tile4} onPress={() => router.push(href as Href)}>
              {icon}
              <Text style={[s.tile4Lbl, { color: textPrimary }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        </>}  {/* end !focusMode */}

      </ScrollView>
    </ImageBackground>
  );
}

// ─── Styles factory ───────────────────────────────────────────────────────────
function makeStyles(isDark: boolean) {
  const CARD   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.82)';
  const BORDER  = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.20)';
  const sc  = isDark ? '#000000' : '#3d2b1a';
  const sop = isDark ? 0.35 : 0.22;
  const srd = isDark ? 16 : 14;
  const sh  = { shadowColor: sc, shadowOffset: { width: 0 as const, height: 6 as const }, shadowOpacity: sop, shadowRadius: srd, elevation: 10 };

  return StyleSheet.create({
    root:   { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingBottom: 90 },

    adminPill: { alignSelf: 'flex-start', marginBottom: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(191,141,54,0.15)', borderRadius: 8 },
    adminPillText: { fontSize: 13, color: GOLD, fontFamily: 'DMSans_400Regular' },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    iconBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER, ...sh },
    logoWrap: { flex: 1, alignItems: 'center' },
    logoImg:  { width: 90, height: 64 },
    avatarRing: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: GOLD, backgroundColor: isDark ? '#2a2218' : '#fff' },
    avatarImg:  { width: 93, height: 124, marginTop: -29, marginLeft: -27 },

    // Greeting
    // Streak + Daily Plan
    streakBadge: { backgroundColor: GOLD + '18', borderRadius: 10, borderWidth: 1, borderColor: GOLD + '40', paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 8 },
    streakText:  { fontFamily: 'DMSans_500Medium', fontSize: 13, color: GOLD },
    planCard:    { borderRadius: 16, borderWidth: 1, borderColor: GOLD + '35', padding: 16, marginBottom: 10, ...sh },
    // Appointment + check-in cards
    apptCard: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 8, ...sh },
    apptTitle: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
    apptSub:   { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 2 },
    checkinBanner: { backgroundColor: GOLD + (isDark ? '26' : '18'), borderRadius: 14, borderWidth: 1, borderColor: GOLD + '50', padding: 12, marginBottom: 10 },
    checkinTitle: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: isDark ? GOLD : '#232426' },
    checkinSub:   { fontFamily: 'DMSans_400Regular', fontSize: 11, color: isDark ? GOLD : '#232426', opacity: isDark ? 0.8 : 0.75, marginTop: 2 },
    greet: { fontFamily: 'PTSerif_400Regular', fontSize: 30, marginBottom: 2, lineHeight: 36 },
    date:  { fontFamily: 'DMSans_400Regular', fontSize: 12, marginBottom: 8 },

    // Coach card
    coachShadow: { borderRadius: 20, marginBottom: 10, ...sh },
    coachCard: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', height: 200, overflow: 'hidden' },
    coachLeft: { width: '58%', padding: 14, justifyContent: 'space-between' },
    coachTitle: { fontFamily: 'PTSerif_400Regular', fontSize: 20, lineHeight: 26, marginBottom: 6 },
    coachSub:   { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 18 },
    askBtn:   { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    askTxt:   { color: '#fff', fontSize: 13, fontFamily: 'DMSans_400Regular' },
    modelWrap: { width: '42%', height: 200, overflow: 'hidden' },
    modelImg:  { position: 'absolute', top: -148, left: -168, width: 540, height: 720 },

    // 3 tiles
    tiles3: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    tile3: {
      flex: 1, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
      paddingVertical: 14, alignItems: 'center', gap: 8,
      ...sh,
    },
    tile3Lbl: { fontFamily: 'DMSans_400Regular', fontSize: 10.5, textAlign: 'center', lineHeight: 14 },

    // Stats card
    statsCard: {
      backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER,
      padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8,
      ...sh,
    },
    ringWrap:   { width: 104, height: 104, position: 'relative' },
    ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    ringNum: { fontFamily: 'DMSans_500Medium', fontSize: 24, fontWeight: '700', lineHeight: 28 },
    ringOf:  { fontFamily: 'DMSans_400Regular', fontSize: 9, lineHeight: 12, textAlign: 'center', marginTop: 1 },
    macrosCol: { flex: 1 },

    // 4 tiles
    tiles4: { flexDirection: 'row', gap: 6 },
    tile4: {
      flex: 1, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
      paddingVertical: 10, alignItems: 'center', gap: 5,
      ...sh,
    },
    tile4Lbl: { fontFamily: 'DMSans_400Regular', fontSize: 9, textAlign: 'center', lineHeight: 12 },
  });
}
