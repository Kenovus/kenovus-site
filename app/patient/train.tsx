/**
 * Train tab — 5-day rotating split, weekly calendar, workout history.
 *
 * Split:
 *  Day 1: Back & Biceps
 *  Day 2: Chest & Triceps
 *  Day 3: Shoulders
 *  Day 4: Arms
 *  Day 5: Legs
 *  Day 6+: Rest (cycle restarts next session)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { useAuth } from '@/hooks/useAuth';
import { fetchDailyWins, upsertDailyWins } from '@/lib/dailyWins';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { insertTrainingLog, fetchTrainingLogs, totalWorkingSetsForLog, type TrainingLogRow } from '@/lib/trainingLogs';
import { formatDisplayDate } from '@/lib/dateUsFormat';
import { useAppTheme } from '@/lib/theme/ThemeProvider';

const GOLD  = '#BF8D36';
const BLUE  = '#5BC4DC';
const GREEN = '#5EC47A';
const CYCLE_START_KEY = 'train_cycle_start_date';

// ── 5-day split definition ─────────────────────────────────────────────────────
const SPLIT = [
  { day: 1, label: 'Back & Biceps',   emoji: '🏋️', color: BLUE },
  { day: 2, label: 'Chest & Triceps', emoji: '💪', color: '#E07878' },
  { day: 3, label: 'Shoulders',       emoji: '🎯', color: GREEN },
  { day: 4, label: 'Arms',            emoji: '🦾', color: GOLD },
  { day: 5, label: 'Legs',            emoji: '🦵', color: '#A87BCF' },
];

const REST = { day: 0, label: 'Rest', emoji: '😴', color: 'rgba(255,255,255,0.25)' };

function getCycleDay(cycleStartDate: string | null): number {
  if (!cycleStartDate) return 1;
  const start = new Date(cycleStartDate);
  const today = new Date();
  const daysSince = Math.floor((today.getTime() - start.getTime()) / 86400000);
  return (daysSince % 5) + 1; // 1-5
}

function getSplitForDay(cycleDay: number) {
  return SPLIT.find((s) => s.day === cycleDay) ?? REST;
}

function weekDays(): { date: string; label: string; dow: string }[] {
  const days = [];
  const today = new Date();
  // Monday-based week
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: String(d.getDate()),
      dow: DOW[i]!,
    });
  }
  return days;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function DumbbellIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={2} y={10} width={4} height={4} rx={1}/>
      <Rect x={18} y={10} width={4} height={4} rx={1}/>
      <Path d="M6 12h12M4 8v8M20 8v8"/>
    </Svg>
  );
}

// ── Monthly Calendar Component ────────────────────────────────────────────────
function MonthlyCalendar({ history, today, CARD, BORD, TX, MT, GOLD, GREEN }: {
  history: TrainingLogRow[]; today: string;
  CARD: string; BORD: string; TX: string; MT: string; GOLD: string; GREEN: string;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DOW_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  // Build calendar cells (nulls for empty leading slots)
  const cells: (number | null)[] = Array.from({ length: firstDow }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Stats
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthLogs = history.filter((l) => l.workout_date.startsWith(monthPrefix));
  const totalWorkouts = monthLogs.length;
  const totalVolume = monthLogs.reduce((sum, l) => sum + totalWorkingSetsForLog(l), 0);
  const muscleCounts = new Map<string, number>();
  monthLogs.forEach((l) => { const k = l.muscle_focus ?? 'other'; muscleCounts.set(k, (muscleCounts.get(k) ?? 0) + 1); });
  const topMuscle = [...muscleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]?.replace(/_/g, ' ') ?? '—';

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 8 }}>
        {MONTH_NAMES[month].toUpperCase()} {year}
      </Text>
      <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 12, marginBottom: 10 }}>
        {/* Day-of-week headers */}
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {DOW_SHORT.map((d) => (
            <Text key={d} style={{ flex: 1, textAlign: 'center', fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT }}>{d}</Text>
          ))}
        </View>
        {/* Calendar grid */}
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row', marginBottom: 4 }}>
            {Array.from({ length: 7 }, (_, col) => {
              const day = cells[row * 7 + col];
              if (day == null) return <View key={col} style={{ flex: 1 }} />;
              const iso = `${monthPrefix}-${String(day).padStart(2, '0')}`;
              const isToday = iso === today;
              const log = history.find((l) => l.workout_date === iso);
              return (
                <View key={col} style={{ flex: 1, alignItems: 'center', paddingVertical: 3 }}>
                  <View style={{
                    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isToday ? GOLD : log ? GREEN + '28' : 'transparent',
                    borderWidth: isToday ? 0 : log ? 1 : 0,
                    borderColor: GREEN + '60',
                  }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: isToday ? '#fff' : log ? GREEN : TX }}>{day}</Text>
                  </View>
                  {log && <Text style={{ fontSize: 9, marginTop: 1 }}>
                    {SPLIT.find((s) => s.label.toLowerCase().includes((log.muscle_focus ?? '').replace(/_/g,' ')))?.emoji ?? '🏋️'}
                  </Text>}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {/* Monthly stats */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { label: 'Workouts', value: String(totalWorkouts) },
          { label: 'Sets', value: String(totalVolume) },
          { label: 'Top muscle', value: topMuscle },
        ].map(({ label, value }) => (
          <View key={label} style={{ flex: 1, backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORD, padding: 10, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: GOLD }}>{value}</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: MT, marginTop: 2 }}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TrainScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { user } = useAuth();
  const { tokens, resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const TX   = tokens.colors.text;
  const MT   = tokens.colors.textMuted;
  const CARD = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)';
  const BORD = isDark ? 'rgba(191,141,54,0.22)'  : 'rgba(191,141,54,0.18)';
  const BG   = tokens.colors.background;

  const today = new Date().toISOString().slice(0, 10);
  const [cycleStart, setCycleStart]   = useState<string | null>(null);
  const [history, setHistory]          = useState<TrainingLogRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading]          = useState(true);
  const [calView, setCalView]           = useState<'weekly' | 'monthly'>('weekly');
  const week = weekDays();

  // Compute today's cycle day and the selected day's cycle day
  const todayCycleDay = getCycleDay(cycleStart);
  const selectedDayIdx = week.findIndex((d) => d.date === selectedDate);
  // The selected date's cycle day = today's cycle day ± offset
  const todayIdx = week.findIndex((d) => d.date === today);
  const offset = selectedDayIdx >= 0 && todayIdx >= 0 ? selectedDayIdx - todayIdx : 0;
  const selectedCycleDay = ((((todayCycleDay - 1 + offset) % 5) + 5) % 5) + 1;
  const selectedSplit = getSplitForDay(selectedCycleDay);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cs] = await Promise.all([
        AsyncStorage.getItem(CYCLE_START_KEY),
      ]);
      setCycleStart(cs);
      if (user?.id) {
        const pid = await fetchPatientIdForAuthUser(user.id);
        if (pid) {
          const logs = await fetchTrainingLogs(pid, 20);
          setHistory(logs);
        }
      }
    } catch (e) {
      console.warn('[Train] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const resetCycleToToday = async () => {
    Alert.alert(
      'Reset Cycle',
      'Set today as Day 1 (Back & Biceps) of your cycle?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Day 1', onPress: async () => {
            await AsyncStorage.setItem(CYCLE_START_KEY, today);
            setCycleStart(today);
          },
        },
      ],
    );
  };

  const setCustomCycleDay = async (day: number) => {
    // Compute what date would give us `day` as today's cycle day
    const daysBack = (todayCycleDay - day + 5) % 5;
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    const isoDate = d.toISOString().slice(0, 10);
    await AsyncStorage.setItem(CYCLE_START_KEY, isoDate);
    setCycleStart(isoDate);
  };

  const todaySplit = getSplitForDay(todayCycleDay);
  const workoutForSelectedDate = history.find((l) => l.workout_date === selectedDate);
  const todayLogged = history.some((l) => l.workout_date === today);

  const quickLogWorkout = async (splitLabel: string) => {
    Alert.alert(
      'Log Workout',
      `Log ${splitLabel} for today?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log It ✓',
          onPress: async () => {
            if (!user?.id) return;
            const pid = await fetchPatientIdForAuthUser(user.id);
            if (!pid) return;
            const muscleFocus = splitLabel.toLowerCase().replace(/\s*[&+]\s*/g, '_').replace(/\s+/g, '_');
            await insertTrainingLog({
              patientId: pid,
              workout_date: today,
              muscle_focus: muscleFocus,
              exercises: [],
              duration_minutes: null,
              notes: `${splitLabel} — quick logged from split`,
              weight_unit: 'lb',
            });
            try {
              const wins = await fetchDailyWins(pid, today);
              await upsertDailyWins(pid, today, {
                protein_hit: wins.protein_hit,
                training_done: true,
                steps_hit: wins.steps_hit,
              });
            } catch { /* non-critical */ }
            await load();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 26, color: TX, marginBottom: 2 }}>Train</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>
              5-day split · Day {todayCycleDay} today
            </Text>
          </View>
          {/* Weekly / Monthly toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 3 }}>
            {(['weekly', 'monthly'] as const).map((v) => (
              <Pressable key={v} onPress={() => setCalView(v)}
                style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: calView === v ? GOLD : 'transparent' }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: calView === v ? '#fff' : MT }}>
                  {v === 'weekly' ? 'Weekly' : 'Monthly'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Today's Split Card ── */}
        <View style={{
          backgroundColor: todaySplit.color + '22',
          borderRadius: 20, borderWidth: 1.5,
          borderColor: todaySplit.color + '55',
          padding: 18, marginBottom: 14,
          shadowColor: todaySplit.color, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8,
        }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 6 }}>TODAY — DAY {todayCycleDay}</Text>
          <Text style={{ fontSize: 36, marginBottom: 4 }}>{todaySplit.emoji}</Text>
          <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 24, color: TX, marginBottom: 12 }}>{todaySplit.label}</Text>
          <Pressable
            onPress={() => router.push('/patient/progress/log-workout' as never)}
            style={{
              backgroundColor: GOLD, borderRadius: 14, paddingVertical: 13,
              alignItems: 'center',
              shadowColor: GOLD, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6,
            }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#fff' }}>Log Today's Workout →</Text>
          </Pressable>
        </View>

        {calView === 'monthly' && <MonthlyCalendar history={history} today={today} CARD={CARD} BORD={BORD} TX={TX} MT={MT} GOLD={GOLD} GREEN={GREEN} />}

        {/* ── Weekly Calendar ── */}
        {calView === 'weekly' && <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 8 }}>THIS WEEK</Text>}
        {calView === 'weekly' && <View style={{
          backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD,
          padding: 12, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between',
        }}>
          {week.map((day, i) => {
            const isToday = day.date === today;
            const isSelected = day.date === selectedDate;
            // Show actual logged workout, not inferred split sequence
            const logForDay = history.find((l) => l.workout_date === day.date);
            const logEmoji = logForDay
              ? (SPLIT.find((s) => s.label.toLowerCase().includes((logForDay.muscle_focus ?? '').replace(/_/g,' ')))?.emoji ?? '🏋️')
              : null;
            return (
              <Pressable
                key={day.date}
                onPress={() => setSelectedDate(day.date)}
                style={{
                  alignItems: 'center', gap: 4, flex: 1,
                  backgroundColor: isSelected ? GOLD + '22' : 'transparent',
                  borderRadius: 10, paddingVertical: 6,
                  borderWidth: isSelected ? 1 : 0,
                  borderColor: GOLD + '55',
                }}>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: isToday ? GOLD : MT }}>{day.dow}</Text>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: isToday ? GOLD : (isSelected ? GOLD + '40' : 'transparent'),
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: isToday ? '#fff' : TX }}>{day.label}</Text>
                </View>
                {logEmoji
                  ? <Text style={{ fontSize: 12 }}>{logEmoji}</Text>
                  : <View style={{ width: 12, height: 12 }}/>}
                {logForDay && <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: GREEN }}/>}
              </Pressable>
            );
          })}
        </View>}

        {/* ── Selected Day Detail (weekly view only) ── */}
        {calView === 'weekly' && <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, padding: 14, marginBottom: 14 }}>
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 8 }}>
            {selectedDate === today ? 'TODAY' : formatDisplayDate(selectedDate, 'short')} — DAY {selectedCycleDay}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Text style={{ fontSize: 28 }}>{selectedSplit.emoji}</Text>
            <Text style={{ fontFamily: 'PTSerif_700Bold', fontSize: 20, color: TX }}>{selectedSplit.label}</Text>
          </View>
          {workoutForSelectedDate ? (
            <View style={{ backgroundColor: GREEN + '18', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: GREEN + '40' }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: GREEN, marginBottom: 4 }}>✓ Logged</Text>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: TX }}>
                {workoutForSelectedDate.exercises.length} exercise{workoutForSelectedDate.exercises.length !== 1 ? 's' : ''} · {totalWorkingSetsForLog(workoutForSelectedDate)} sets
                {workoutForSelectedDate.duration_minutes ? ` · ${workoutForSelectedDate.duration_minutes} min` : ''}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/patient/progress/log-workout' as never)}
              style={{ backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: BORD, paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: MT }}>No workout logged — tap to log</Text>
            </Pressable>
          )}
        </View>}

        {/* ── Full 5-Day Split Reference ── */}
        <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 8 }}>5-DAY SPLIT</Text>
        <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORD, overflow: 'hidden', marginBottom: 14 }}>
          {SPLIT.map((s, i) => (
            <Pressable
              key={s.day}
              onPress={() => void setCustomCycleDay(s.day)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 14, paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: BORD,
                backgroundColor: s.day === todayCycleDay ? s.color + '14' : 'transparent',
              }}>
              <View style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: s.color + '28', alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: s.color + '50',
              }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: s.color }}>D{s.day}</Text>
              </View>
              <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: TX, flex: 1 }}>{s.label}</Text>
              {s.day === todayCycleDay && (
                todayLogged ? (
                  <View style={{ backgroundColor: GREEN + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: GREEN + '50' }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: GREEN }}>✅ Done</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); void quickLogWorkout(s.label); }}
                    style={{ backgroundColor: GOLD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#fff' }}>Log ✓</Text>
                  </Pressable>
                )
              )}
            </Pressable>
          ))}
          <Pressable
            onPress={resetCycleToToday}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORD }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: MT, textAlign: 'center' }}>Tap a day above to set as today · Reset cycle</Text>
          </Pressable>
        </View>

        {/* ── Recent Workouts ── */}
        {history.length > 0 && (
          <>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 10, color: MT, letterSpacing: 1.4, marginBottom: 8 }}>RECENT WORKOUTS</Text>
            {history.slice(0, 8).map((log) => (
              <View key={log.id} style={{
                backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD,
                padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: GOLD + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <DumbbellIcon color={GOLD}/>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: TX }}>
                    {log.muscle_focus.replace(/_/g, ' ')}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: MT, marginTop: 2 }}>
                    {formatDisplayDate(log.workout_date, 'short')} · {log.exercises.length} exercises · {totalWorkingSetsForLog(log)} sets
                    {log.duration_minutes ? ` · ${log.duration_minutes} min` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {!loading && history.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 16 }}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🏋️</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: MT, textAlign: 'center' }}>
              No workouts logged yet.{'\n'}Log your first session above.
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
