/**
 * Physique Forecast Calendar.
 *
 * Linear projection from goal start → goal date, overlaid with actual
 * weight / protein / training / wins data. Tap any tile → DayDetailModal.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { fetchForecastBundle, type ForecastBundle } from '@/lib/physiqueData';
import {
  confidenceLabel,
  currentConfidence,
  formatGoalDateLong,
  formatGoalDateShort,
  generateProjections,
  monthGridDates,
  todayISO,
  weekDates,
  type DayProjection,
} from '@/lib/physiqueProjection';

const BG = '#0F1923';
const CARD = '#1B2A3A';
const DIVIDER = 'rgba(255,255,255,0.06)';
const GOLD = '#B8962E';
const GOLD_BRIGHT = '#E0B85A';
const GREEN = '#34D399';
const RED = '#EF4444';
const BLUE = '#5BC4DC';
const PURPLE_A = '#818CF8';
const PURPLE_B = '#4C1D95';
const TEXT = '#FFFFFF';
const TEXT_DIM = '#D1D5DB';
const TEXT_MUTED = 'rgba(255,255,255,0.55)';

const SCREEN_W = Dimensions.get('window').width;
const GRID_GAP = 6;
const GRID_PAD = 12;
const TILE_W = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP * 6) / 7);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PhysiqueForecastScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [bundle, setBundle] = useState<ForecastBundle | null>(null);
  const [selected, setSelected] = useState<DayProjection | null>(null);
  const [monthCursor, setMonthCursor] = useState<{ year: number; month0: number }>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month0: d.getMonth() };
  });

  const loadBundle = useCallback(async () => {
    if (!user?.id) return;
    const pid = await fetchPatientIdForAuthUser(user.id);
    if (!pid) return;
    try {
      const b = await fetchForecastBundle(pid);
      setBundle(b);
    } catch (e) {
      console.warn('[forecast] load failed', e);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadBundle();
    }, [loadBundle]),
  );

  const projections = useMemo(() => {
    if (!bundle?.goal) return [];
    return generateProjections(bundle.goal, bundle.actuals);
  }, [bundle?.goal, bundle?.actuals]);

  const projByDate = useMemo(() => {
    const m = new Map<string, DayProjection>();
    for (const d of projections) m.set(d.date, d);
    return m;
  }, [projections]);

  const today = todayISO();
  const confidence = useMemo(() => currentConfidence(projections), [projections]);
  const confLabel = confidenceLabel(confidence);

  // Loading / empty
  if (!bundle) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <Header onBack={() => router.back()} title="Physique Forecast" />
        <View style={styles.centerFill}>
          <Text style={styles.muted}>Loading your forecast…</Text>
        </View>
      </View>
    );
  }
  if (!bundle.hasGoal || !bundle.goal) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <Header onBack={() => router.back()} title="Physique Forecast" />
        <View style={styles.centerFill}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={styles.emptyTitle}>Set Your Physique Goal</Text>
          <Text style={styles.emptySub}>Create a plan to track your progress.</Text>
          <Pressable style={styles.goldCta} onPress={() => router.push('/patient/profile/my-goals')}>
            <Text style={styles.goldCtaTxt}>Set My Goal →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const goal = bundle.goal;
  const daysLeft = bundle.daysRemaining ?? 0;
  const goalDateShort = formatGoalDateShort(goal.goalDate);
  const goalDateLong = formatGoalDateLong(goal.goalDate);
  const totalDays = projections.length || 1;
  const elapsedIdx = Math.max(0, projections.findIndex((d) => d.date === today));
  const elapsed = elapsedIdx < 0 ? totalDays : elapsedIdx;
  const elapsedPct = Math.max(0, Math.min(1, elapsed / totalDays));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Header onBack={() => router.back()} title={bundle.planName} />

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Stats bar */}
        <View style={styles.statsBar}>
          <Stat label="Days Left" value={String(daysLeft)} color={GOLD_BRIGHT} />
          <View style={styles.statDivider} />
          <Stat label="Goal BF" value={`${goal.goalBodyFat}%`} color={TEXT} />
          <View style={styles.statDivider} />
          <Stat label="On Track" value={`${confidence}%`} color={GREEN} />
        </View>

        {/* Week strip */}
        <WeekStrip today={today} projByDate={projByDate} onSelect={setSelected} />

        {/* Month/Metrics/Insights tab row (Month is the only enabled tab) */}
        <View style={styles.tabRow}>
          <View style={[styles.tab, styles.tabActive]}><Text style={styles.tabTxtActive}>Month</Text></View>
          <View style={styles.tab}><Text style={styles.tabTxt}>Metrics</Text></View>
          <View style={styles.tab}><Text style={styles.tabTxt}>Insights</Text></View>
        </View>

        {/* Month nav */}
        <MonthNav
          year={monthCursor.year}
          month0={monthCursor.month0}
          onPrev={() => setMonthCursor((m) => shiftMonth(m, -1))}
          onNext={() => setMonthCursor((m) => shiftMonth(m, 1))}
        />

        {/* Month grid */}
        <MonthGrid
          year={monthCursor.year}
          month0={monthCursor.month0}
          today={today}
          goalDate={goal.goalDate}
          projByDate={projByDate}
          onSelect={setSelected}
        />

        {/* Legend */}
        <View style={styles.legend}>
          <LegendDot color={GREEN} label="Won" />
          <LegendDot color={RED} label="Missed" />
          <LegendDot color={BLUE} label="InBody" />
          <LegendDot color={GOLD_BRIGHT} label="Milestone" />
        </View>

        <View style={styles.divider} />

        {/* Progress bar card */}
        <View style={styles.progressCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={styles.progressTitle}>✅ On track for {goal.goalBodyFat}% by {goalDateShort}</Text>
            <Text style={styles.progressMeta}>{confidence}% · {confLabel}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(elapsedPct * 100)}%` }]} />
          </View>
        </View>

        {/* Today's coaching */}
        <TodayCoachCard
          bundle={bundle}
          todayProj={projByDate.get(today)}
        />

        {/* Sona strip */}
        <SonaStrip confidence={confidence} daysLeft={daysLeft} goalDateLong={goalDateLong} />
      </ScrollView>

      <DayDetailModal
        day={selected}
        projections={projections}
        goalDateLong={goalDateLong}
        confidence={confidence}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <Pressable hitSlop={12} onPress={onBack}>
        <Text style={styles.headerBack}>←</Text>
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.headerDots}>···</Text>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WeekStrip({
  today,
  projByDate,
  onSelect,
}: {
  today: string;
  projByDate: Map<string, DayProjection>;
  onSelect: (d: DayProjection | null) => void;
}) {
  const week = weekDates(today);
  return (
    <View style={styles.weekRow}>
      {week.map((iso) => {
        const dt = new Date(iso + 'T12:00:00');
        const dayName = dt.toLocaleDateString(undefined, { weekday: 'short' });
        const d = projByDate.get(iso);
        const isToday = iso === today;
        const icon = !d
          ? ''
          : isToday
            ? '🎯'
            : d.status === 'won'
              ? '✅'
              : d.status === 'missed'
                ? '❌'
                : '';
        return (
          <Pressable
            key={iso}
            style={[
              styles.weekTile,
              isToday && styles.weekTileToday,
              d?.status === 'won' && styles.weekTileWon,
              d?.status === 'missed' && styles.weekTileMissed,
              d?.isFuture && styles.weekTileFuture,
            ]}
            onPress={() => (d ? onSelect(d) : null)}>
            <Text style={styles.weekTileDay}>{dayName}</Text>
            <Text style={styles.weekTileWeight}>
              {d ? `${Math.round(d.projectedWeight)}` : '—'}
            </Text>
            <Text style={styles.weekTileIcon}>{icon}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MonthNav({
  year,
  month0,
  onPrev,
  onNext,
}: {
  year: number;
  month0: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const label = new Date(year, month0, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  return (
    <View style={styles.monthNav}>
      <Pressable hitSlop={12} onPress={onPrev}><Text style={styles.monthNavArrow}>‹</Text></Pressable>
      <Text style={styles.monthNavTitle}>{label}</Text>
      <Pressable hitSlop={12} onPress={onNext}><Text style={styles.monthNavArrow}>›</Text></Pressable>
    </View>
  );
}

function MonthGrid({
  year,
  month0,
  today,
  goalDate,
  projByDate,
  onSelect,
}: {
  year: number;
  month0: number;
  today: string;
  goalDate: string;
  projByDate: Map<string, DayProjection>;
  onSelect: (d: DayProjection | null) => void;
}) {
  const cells = monthGridDates(year, month0);
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <View style={styles.gridWrap}>
      <View style={styles.dowRow}>
        {dows.map((d) => (
          <Text key={d} style={styles.dowLabel}>{d}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((iso) => {
          const dt = new Date(iso + 'T12:00:00');
          const dayNum = dt.getDate();
          const inMonth = dt.getMonth() === month0;
          const d = projByDate.get(iso);
          const isToday = iso === today;
          const isGoal = iso === goalDate;
          const tileState: TileState = !inMonth
            ? 'outside'
            : isToday
              ? 'today'
              : isGoal
                ? 'goal'
                : d?.isFuture
                  ? 'future'
                  : d?.status === 'won'
                    ? 'won'
                    : d?.status === 'missed'
                      ? 'missed'
                      : d?.status === 'partial'
                        ? 'partial'
                        : 'past_nodata';
          const tileStyle = tileStateStyle(tileState);
          return (
            <Pressable
              key={iso}
              style={[styles.cell, tileStyle.cell]}
              onPress={() => (d ? onSelect(d) : null)}>
              {/* Watermark for won/missed */}
              {tileState === 'won' ? <Text style={styles.cellWatermarkWon}>✓</Text> : null}
              {tileState === 'missed' ? <Text style={styles.cellWatermarkMissed}>×</Text> : null}

              <Text style={[styles.cellDate, tileStyle.dateColor && { color: tileStyle.dateColor }]}>
                {dayNum}
              </Text>
              {d && inMonth && (tileState === 'today' || tileState === 'future' || tileState === 'won' || tileState === 'missed' || tileState === 'partial') ? (
                <>
                  <Text style={[styles.cellWeight, tileStyle.bodyColor && { color: tileStyle.bodyColor }]}>
                    {Math.round(d.projectedWeight)}
                  </Text>
                  <Text style={[styles.cellBf, tileStyle.bodyColor && { color: tileStyle.bodyColor }]}>
                    {d.projectedBodyFat.toFixed(1)}%
                  </Text>
                </>
              ) : null}

              {/* Bottom bar */}
              {tileStyle.barColor ? (
                <View style={[styles.cellBar, { backgroundColor: tileStyle.barColor }]} />
              ) : null}

              {/* Badges */}
              {d?.isMilestone && inMonth ? <View style={styles.badgeMilestone} /> : null}
              {d?.isInBodyDay && inMonth ? <View style={styles.badgeInBody} /> : null}
              {isGoal ? <Text style={styles.goalIcon}>✈️</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type TileState = 'outside' | 'today' | 'future' | 'won' | 'missed' | 'partial' | 'past_nodata' | 'goal';
interface TileStyleSpec {
  cell: object;
  dateColor?: string;
  bodyColor?: string;
  barColor?: string;
}

function tileStateStyle(state: TileState): TileStyleSpec {
  switch (state) {
    case 'today':
      return {
        cell: { borderColor: GOLD_BRIGHT, borderWidth: 1.5 },
        dateColor: GOLD_BRIGHT,
        bodyColor: GOLD_BRIGHT,
        barColor: GOLD_BRIGHT,
      };
    case 'future':
      return {
        cell: { opacity: 0.85 },
        dateColor: TEXT,
        bodyColor: TEXT_DIM,
        barColor: 'rgba(255,255,255,0.18)',
      };
    case 'won':
      return {
        cell: { borderColor: GREEN, borderWidth: 1 },
        dateColor: GREEN,
        bodyColor: TEXT_DIM,
        barColor: GREEN,
      };
    case 'missed':
      return {
        cell: { borderColor: RED, borderWidth: 1, opacity: 0.5 },
        dateColor: RED,
        bodyColor: TEXT_MUTED,
        barColor: RED,
      };
    case 'partial':
      return {
        cell: { borderColor: GOLD, borderWidth: 1, opacity: 0.8 },
        dateColor: GOLD_BRIGHT,
        bodyColor: TEXT_DIM,
        barColor: GOLD,
      };
    case 'past_nodata':
      return {
        cell: { opacity: 0.4 },
        dateColor: TEXT_MUTED,
      };
    case 'goal':
      return {
        cell: {
          borderColor: GOLD_BRIGHT,
          borderWidth: 1.5,
          shadowColor: GOLD_BRIGHT,
          shadowOpacity: 0.6,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        },
        dateColor: GOLD_BRIGHT,
        bodyColor: GOLD_BRIGHT,
        barColor: GOLD_BRIGHT,
      };
    default:
      return { cell: { opacity: 0.25 }, dateColor: TEXT_MUTED };
  }
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={styles.legendTxt}>{label}</Text>
    </View>
  );
}

function TodayCoachCard({
  bundle,
  todayProj,
}: {
  bundle: ForecastBundle;
  todayProj: DayProjection | undefined;
}) {
  const proteinHit = !!todayProj && todayProj.status !== 'future' && (todayProj.actualWeight !== undefined || false);
  const trainingDone = todayProj?.status === 'won' || todayProj?.status === 'partial';
  return (
    <View style={styles.coachCard}>
      <Text style={styles.coachTitle}>✦ Today’s Coaching</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Task label={`Hit ${bundle.proteinTarget}g of protein`} done={proteinHit} />
          <Task label="Complete today’s workout" done={trainingDone} />
          <Task label="10,000 steps" done={false} />
        </View>
        <View style={styles.coachAlert}>
          <Text style={styles.coachAlertTitle}>Stay sharp</Text>
          <Text style={styles.coachAlertBody} numberOfLines={3}>
            {todayProj
              ? `You’re projected at ${todayProj.projectedWeight} lbs / ${todayProj.projectedBodyFat}% today. Hit your protein, log your workout, and we keep the curve where it needs to be.`
              : 'Log your first day to start building momentum.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Task({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.taskRow}>
      <View style={[styles.taskCircle, done && { backgroundColor: GREEN, borderColor: GREEN }]}>
        {done ? <Text style={styles.taskCheck}>✓</Text> : null}
      </View>
      <Text style={[styles.taskTxt, done && styles.taskTxtDone]}>{label}</Text>
    </View>
  );
}

function SonaStrip({
  confidence,
  daysLeft,
  goalDateLong,
}: {
  confidence: number;
  daysLeft: number;
  goalDateLong: string;
}) {
  let line: string;
  if (confidence >= 80) line = `You’re trending exactly where we want. Keep the protein anchor solid and the curve does the rest.`;
  else if (confidence >= 60) line = `Pace is holding. Tighten one more habit this week and you’ll be ahead by ${goalDateLong}.`;
  else line = `Let’s close the gap today — one strong protein day resets the trajectory.`;
  return (
    <View style={styles.sonaStrip}>
      <View style={styles.sonaOrb} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sonaLine}>{line}</Text>
        <Text style={styles.sonaMeta}>{daysLeft} days to {goalDateLong}</Text>
      </View>
    </View>
  );
}

// ─── Day Detail Modal ─────────────────────────────────────────────────────────

function DayDetailModal({
  day,
  projections,
  goalDateLong,
  confidence,
  onClose,
}: {
  day: DayProjection | null;
  projections: DayProjection[];
  goalDateLong: string;
  confidence: number;
  onClose: () => void;
}) {
  if (!day) return null;

  // 7-day window centred around `day`
  const idx = projections.findIndex((p) => p.date === day.date);
  const start = Math.max(0, idx - 3);
  const window = projections.slice(start, start + 7);

  const dt = new Date(day.date + 'T12:00:00');
  const dayName = dt.toLocaleDateString(undefined, { weekday: 'long' });
  const dateLine = dt.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  const statusColor =
    day.status === 'won' ? GREEN :
    day.status === 'missed' ? RED :
    day.status === 'today' ? GOLD_BRIGHT :
    day.status === 'partial' ? GOLD : TEXT_DIM;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <View style={modalStyles.sheet}>
        <View style={modalStyles.handle} />

        <View style={modalStyles.modalHeader}>
          <View>
            <Text style={modalStyles.modalTitle}>{dayName}</Text>
            <Text style={modalStyles.modalSub}>{dateLine}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[modalStyles.modalStatus, { color: statusColor }]}>
              {day.status.toUpperCase()}
            </Text>
            <Pressable hitSlop={12} onPress={onClose}>
              <Text style={modalStyles.modalClose}>✕</Text>
            </Pressable>
          </View>
        </View>

        <View style={modalStyles.statsRow}>
          <MiniStat
            label="Weight"
            value={`${day.actualWeight?.toFixed(1) ?? day.projectedWeight.toFixed(1)} lb`}
            isActual={day.actualWeight != null}
          />
          <MiniStat
            label="Body Fat"
            value={`${day.actualBodyFat?.toFixed(1) ?? day.projectedBodyFat.toFixed(1)}%`}
            isActual={day.actualBodyFat != null}
          />
          <MiniStat label="Lean Mass" value={`${day.projectedLeanMass.toFixed(1)} lb`} />
        </View>

        <TrendChart window={window} highlight={day.date} />

        <Text style={modalStyles.subHead}>Insights</Text>
        <InsightBullet color={GREEN} text={`Confidence ${confidence}% (${confidenceLabel(confidence)})`} />
        <InsightBullet color={GOLD_BRIGHT} text={`Day ${day.dayNumber} · ${day.daysRemaining} days remaining`} />
        <InsightBullet
          color={BLUE}
          text={day.isInBodyDay ? 'InBody check-in day — log your numbers.' : `Expected goal: ${goalDateLong}`}
        />

        <View style={{ height: 12 }} />

        <Text style={modalStyles.subHead}>Plan for today</Text>
        <Task label="Hit protein target" done={day.status === 'won'} />
        <Task label="Complete workout" done={day.status === 'won' || day.status === 'partial'} />
        <Task label="10,000 steps" done={false} />

        <Pressable style={modalStyles.cta} onPress={onClose}>
          <Text style={modalStyles.ctaTxt}>View Full Day Details →</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function MiniStat({ label, value, isActual }: { label: string; value: string; isActual?: boolean }) {
  return (
    <View style={modalStyles.miniStat}>
      <Text style={modalStyles.miniLabel}>{label}</Text>
      <Text style={modalStyles.miniValue}>{value}</Text>
      <Text style={modalStyles.miniHint}>{isActual ? 'logged' : 'projected'}</Text>
    </View>
  );
}

function InsightBullet({ color, text }: { color: string; text: string }) {
  return (
    <View style={modalStyles.insightRow}>
      <View style={[modalStyles.insightDot, { backgroundColor: color }]} />
      <Text style={modalStyles.insightTxt}>{text}</Text>
    </View>
  );
}

function TrendChart({ window, highlight }: { window: DayProjection[]; highlight: string }) {
  if (window.length < 2) return null;
  const W = SCREEN_W - 48;
  const H = 110;
  const PAD = 8;
  const xs = (i: number) => PAD + (i / (window.length - 1)) * (W - PAD * 2);
  const ys = (() => {
    const vals = window.map((d) => d.projectedWeight);
    const lo = Math.min(...vals) - 1;
    const hi = Math.max(...vals) + 1;
    return (v: number) => PAD + (1 - (v - lo) / (hi - lo)) * (H - PAD * 2);
  })();
  let path = '';
  window.forEach((d, i) => {
    const cmd = i === 0 ? 'M' : 'L';
    path += `${cmd}${xs(i).toFixed(1)} ${ys(d.projectedWeight).toFixed(1)} `;
  });
  return (
    <Svg width={W} height={H} style={{ marginVertical: 8 }}>
      <SvgPath d={path} stroke={GREEN} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {window.map((d, i) => (
        <SvgCircle
          key={d.date}
          cx={xs(i)}
          cy={ys(d.projectedWeight)}
          r={d.date === highlight ? 5 : 3}
          fill={d.date === highlight ? GOLD_BRIGHT : GREEN}
        />
      ))}
    </Svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shiftMonth(
  cur: { year: number; month0: number },
  delta: number,
): { year: number; month0: number } {
  const d = new Date(cur.year, cur.month0 + delta, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  emptyEmoji: { fontSize: 56, marginBottom: 4 },
  emptyTitle: { color: TEXT, fontFamily: 'PTSerif_700Bold', fontSize: 22 },
  emptySub: { color: TEXT_MUTED, fontFamily: 'DMSans_400Regular', fontSize: 14, textAlign: 'center' },
  muted: { color: TEXT_MUTED, fontFamily: 'DMSans_400Regular', fontSize: 13 },
  goldCta: {
    backgroundColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    marginTop: 12,
  },
  goldCtaTxt: { color: '#1a1008', fontFamily: 'DMSans_500Medium', fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  headerBack: { color: TEXT, fontSize: 22, width: 24 },
  headerTitle: { flex: 1, color: TEXT, fontFamily: 'PTSerif_700Bold', fontSize: 18 },
  headerDots: { color: TEXT_MUTED, fontSize: 20, width: 24, textAlign: 'right' },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: CARD,
    marginHorizontal: GRID_PAD,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  statDivider: { width: 1, backgroundColor: DIVIDER },
  statValue: { fontFamily: 'PTSerif_700Bold', fontSize: 22 },
  statLabel: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: TEXT_MUTED, marginTop: 2, letterSpacing: 0.5 },

  weekRow: { flexDirection: 'row', gap: GRID_GAP, paddingHorizontal: GRID_PAD, marginBottom: 14 },
  weekTile: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: CARD,
    borderRadius: 10,
    alignItems: 'center',
    gap: 2,
  },
  weekTileToday: { borderWidth: 1.5, borderColor: GOLD_BRIGHT },
  weekTileWon: { borderWidth: 1, borderColor: GREEN, opacity: 0.95 },
  weekTileMissed: { borderWidth: 1, borderColor: RED, opacity: 0.6 },
  weekTileFuture: { opacity: 0.8 },
  weekTileDay: { color: TEXT_MUTED, fontFamily: 'DMSans_500Medium', fontSize: 10 },
  weekTileWeight: { color: TEXT, fontFamily: 'DMSans_500Medium', fontSize: 14 },
  weekTileIcon: { fontSize: 11, marginTop: 2 },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: GRID_PAD,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: CARD,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { borderColor: GOLD_BRIGHT },
  tabTxt: { color: TEXT_MUTED, fontFamily: 'DMSans_500Medium', fontSize: 12 },
  tabTxtActive: { color: GOLD_BRIGHT, fontFamily: 'DMSans_500Medium', fontSize: 12 },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID_PAD + 4,
    marginBottom: 8,
  },
  monthNavArrow: { color: TEXT, fontSize: 22, width: 24, textAlign: 'center' },
  monthNavTitle: { color: TEXT, fontFamily: 'PTSerif_700Bold', fontSize: 16 },

  gridWrap: { paddingHorizontal: GRID_PAD },
  dowRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dowLabel: { width: TILE_W, textAlign: 'center', color: TEXT_MUTED, fontFamily: 'DMSans_500Medium', fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: {
    width: TILE_W,
    height: TILE_W + 14,
    backgroundColor: CARD,
    borderRadius: 8,
    padding: 4,
    overflow: 'hidden',
  },
  cellDate: { color: TEXT, fontFamily: 'DMSans_500Medium', fontSize: 11 },
  cellWeight: { color: TEXT, fontFamily: 'DMSans_500Medium', fontSize: 11, marginTop: 1 },
  cellBf: { color: TEXT_DIM, fontFamily: 'DMSans_400Regular', fontSize: 9 },
  cellBar: { position: 'absolute', left: '15%', right: '15%', bottom: 3, height: 3, borderRadius: 2, width: '70%' },
  cellWatermarkWon: { position: 'absolute', right: 4, bottom: 2, fontSize: 24, color: 'rgba(52,211,153,0.2)' },
  cellWatermarkMissed: { position: 'absolute', right: 2, bottom: -2, fontSize: 28, color: 'rgba(239,68,68,0.2)' },
  badgeMilestone: { position: 'absolute', right: 4, top: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD_BRIGHT },
  badgeInBody: { position: 'absolute', left: 4, top: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: BLUE },
  goalIcon: { position: 'absolute', right: 4, bottom: 4, fontSize: 12 },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: GRID_PAD,
    marginTop: 12,
    marginBottom: 14,
  },
  legendTxt: { color: TEXT_MUTED, fontFamily: 'DMSans_400Regular', fontSize: 11 },

  divider: { height: 1, backgroundColor: DIVIDER, marginHorizontal: GRID_PAD, marginVertical: 6 },

  progressCard: {
    marginHorizontal: GRID_PAD,
    backgroundColor: CARD,
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 12,
  },
  progressTitle: { color: TEXT, fontFamily: 'DMSans_500Medium', fontSize: 13, flex: 1 },
  progressMeta: { color: GREEN, fontFamily: 'DMSans_500Medium', fontSize: 12 },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: GREEN, borderRadius: 4 },

  coachCard: { marginHorizontal: GRID_PAD, backgroundColor: CARD, padding: 14, borderRadius: 14, marginBottom: 12 },
  coachTitle: { color: GOLD_BRIGHT, fontFamily: 'PTSerif_700Bold', fontSize: 15, marginBottom: 10 },
  coachAlert: { flex: 1, backgroundColor: 'rgba(184,150,46,0.12)', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(184,150,46,0.35)' },
  coachAlertTitle: { color: GOLD_BRIGHT, fontFamily: 'DMSans_500Medium', fontSize: 12, marginBottom: 3 },
  coachAlertBody: { color: TEXT_DIM, fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 15 },

  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  taskCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: TEXT_MUTED, alignItems: 'center', justifyContent: 'center' },
  taskCheck: { color: '#0F1923', fontSize: 11, fontWeight: '700' },
  taskTxt: { color: TEXT, fontFamily: 'DMSans_400Regular', fontSize: 13 },
  taskTxtDone: { color: TEXT_MUTED, textDecorationLine: 'line-through' },

  sonaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: GRID_PAD,
    padding: 12,
    backgroundColor: 'rgba(76,29,149,0.18)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.30)',
  },
  sonaOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PURPLE_A,
    shadowColor: PURPLE_B,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  sonaLine: { color: TEXT, fontFamily: 'PTSerif_400Regular', fontStyle: 'italic', fontSize: 13 },
  sonaMeta: { color: TEXT_MUTED, fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 3 },
});

const modalStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#161B22',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 2,
    borderTopColor: GOLD_BRIGHT,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 8 },

  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  modalTitle: { color: TEXT, fontFamily: 'PTSerif_700Bold', fontSize: 20 },
  modalSub: { color: TEXT_MUTED, fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  modalStatus: { fontFamily: 'DMSans_500Medium', fontSize: 11, letterSpacing: 1 },
  modalClose: { color: TEXT_MUTED, fontSize: 20, marginTop: 6 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  miniStat: { flex: 1, backgroundColor: '#1B2A3A', padding: 10, borderRadius: 10, gap: 2 },
  miniLabel: { color: TEXT_MUTED, fontFamily: 'DMSans_400Regular', fontSize: 10, letterSpacing: 0.5 },
  miniValue: { color: TEXT, fontFamily: 'PTSerif_700Bold', fontSize: 16 },
  miniHint: { color: TEXT_MUTED, fontFamily: 'DMSans_400Regular', fontSize: 9 },

  subHead: { color: GOLD_BRIGHT, fontFamily: 'DMSans_500Medium', fontSize: 12, marginTop: 8, marginBottom: 6, letterSpacing: 0.5 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  insightDot: { width: 8, height: 8, borderRadius: 4 },
  insightTxt: { color: TEXT_DIM, fontFamily: 'DMSans_400Regular', fontSize: 12, flex: 1 },

  cta: { backgroundColor: GOLD, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  ctaTxt: { color: '#1a1008', fontFamily: 'DMSans_500Medium', fontSize: 14 },
});
