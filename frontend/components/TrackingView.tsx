import { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { Text, colors, spacing, radii } from '@/components/ui';
import { getIdToken } from '@/services/auth';
import { config } from '@/config';

const SCREEN_W = Dimensions.get('window').width;
const Y_AXIS_W = 40;
const CHART_W = SCREEN_W - spacing.lg * 2 - spacing.md * 2 - Y_AXIS_W;

type WorkoutEntry = {
  createdAt: string;
  activityType: string;
  durationSeconds?: number | null;
  caloriesBurned?: number | null;
  distanceMiles?: number | null;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  elevationFeet?: number | null;
};

type BodyMetricsEntry = {
  createdAt: string;
  weightLbs?: number | null;
  bodyFatPercentage?: number | null;
  restingHeartRate?: number | null;
  leanBodyMassLbs?: number | null;
};

type TrackingData = {
  workouts: WorkoutEntry[];
  bodyMetrics: BodyMetricsEntry[];
};

type Props = {
  uid: string;
};

// ── Helpers ─────────────────────────────────────────────────────────

function formatLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** How many months the data spans. */
function dataSpanMonths(entries: { createdAt: string }[]): number {
  if (entries.length < 2) return 1;
  const first = new Date(entries[0].createdAt);
  const last = new Date(entries[entries.length - 1].createdAt);
  return Math.max(1, (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth());
}

/**
 * Spacing so ~1 month of data fills the visible chart width.
 * Total chart width = spacing * count ≈ CHART_W * months,
 * so spacing = CHART_W * months / count.
 */
function calcSpacing(count: number, months: number): number {
  if (count <= 1) return CHART_W;
  const ideal = (CHART_W * months) / count;
  return Math.max(8, Math.min(ideal, CHART_W / 2));
}

function buildLineData(entries: { createdAt: string; value: number }[]) {
  if (entries.length === 0) return [];
  const months = dataSpanMonths(entries);
  const pointsPerMonth = entries.length / Math.max(1, months);
  const labelEvery = Math.max(1, Math.round(pointsPerMonth / 4));
  return entries.map((e, i) => ({
    value: e.value,
    label: i % labelEvery === 0 || i === entries.length - 1 ? formatLabel(e.createdAt) : '',
    dataPointText: undefined,
  }));
}

// ── ChartCard ───────────────────────────────────────────────────────

function statRow(data: { value: number }[], unit: string) {
  if (data.length < 2) return null;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return (
    <View style={styles.statRow}>
      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Min</Text>
        <Text style={styles.statValue}>{fmt(min)}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Avg</Text>
        <Text style={styles.statValue}>{fmt(avg)}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Max</Text>
        <Text style={styles.statValue}>{fmt(max)}</Text>
      </View>
    </View>
  );
}

function ChartCard({
  title,
  data,
  unit,
  color,
}: {
  title: string;
  data: { createdAt: string; value: number }[];
  unit: string;
  color: string;
}) {
  if (data.length < 1) return null;

  const months = dataSpanMonths(data);
  const lineData = data.length === 1
    ? [{ value: data[0].value, label: formatLabel(data[0].createdAt) }]
    : buildLineData(data);
  const pointSpacing = calcSpacing(lineData.length, months);
  const scrollable = lineData.length > 1 && pointSpacing * lineData.length > CHART_W;

  const latest = data[data.length - 1].value;
  const first = data[0].value;
  const delta = latest - first;
  const pct = first !== 0 ? ((delta / Math.abs(first)) * 100) : 0;
  const up = delta >= 0;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={styles.chartTitleRow}>
          <View style={[styles.accentDot, { backgroundColor: color }]} />
          <Text style={styles.chartTitle}>{title}</Text>
        </View>
        <View style={styles.chartMeta}>
          <Text style={styles.chartLatest}>
            {Number.isInteger(latest) ? latest : latest.toFixed(1)}
            <Text style={styles.chartUnit}> {unit}</Text>
          </Text>
          {data.length > 1 && (
            <View style={styles.deltaRow}>
              <Ionicons
                name={up ? 'trending-up' : 'trending-down'}
                size={14}
                color={up ? '#2ecc71' : '#e74c3c'}
              />
              <Text style={[styles.chartDelta, { color: up ? '#2ecc71' : '#e74c3c' }]}>
                {up ? '+' : ''}{Number.isInteger(delta) ? delta : delta.toFixed(1)} ({Math.abs(pct).toFixed(0)}%)
              </Text>
            </View>
          )}
        </View>
      </View>

      <LineChart
        data={lineData}
        width={CHART_W}
        height={140}
        spacing={pointSpacing}
        initialSpacing={0}
        endSpacing={8}
        color={color}
        dataPointsColor={color}
        thickness={2}
        dataPointsRadius={lineData.length > 20 ? 0 : 3}
        curved
        hideRules={false}
        rulesColor={'rgba(0,0,0,0.04)'}
        rulesType="dashed"
        yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.mutedForeground, fontSize: 9 }}
        hideYAxisText={false}
        yAxisLabelWidth={Y_AXIS_W}
        isAnimated
        animationDuration={600}
        startFillColor={color}
        endFillColor="transparent"
        startOpacity={0.15}
        endOpacity={0}
        areaChart
        noOfSections={4}
        yAxisColor="transparent"
        xAxisColor={colors.border}
        scrollToEnd={scrollable}
        disableScroll={!scrollable}
      />

      {statRow(data, unit)}
    </View>
  );
}

// ── TrackingView ────────────────────────────────────────────────────

export function TrackingView({ uid }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTracking = useCallback(async () => {
    setLoading(true);
    try {
      const token = getIdToken();
      const res = await fetch(`${config.apiBaseUrl}/posts/user/${uid}/tracking`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  // ── Derive chart data (hooks before early returns) ──
  const workouts = useMemo(() => data?.workouts ?? [], [data]);
  const bodyMetrics = useMemo(() => data?.bodyMetrics ?? [], [data]);

  const durationData = useMemo(() =>
    workouts.filter((w) => w.durationSeconds != null)
      .map((w) => ({ createdAt: w.createdAt, value: Math.round(w.durationSeconds! / 60) })),
    [workouts]);

  const caloriesData = useMemo(() =>
    workouts.filter((w) => w.caloriesBurned != null && w.caloriesBurned > 0)
      .map((w) => ({ createdAt: w.createdAt, value: w.caloriesBurned! })),
    [workouts]);

  const distanceData = useMemo(() =>
    workouts.filter((w) => w.distanceMiles != null && w.distanceMiles > 0)
      .map((w) => ({ createdAt: w.createdAt, value: w.distanceMiles! })),
    [workouts]);

  const avgHRData = useMemo(() =>
    workouts.filter((w) => w.avgHeartRate != null)
      .map((w) => ({ createdAt: w.createdAt, value: w.avgHeartRate! })),
    [workouts]);

  const weightData = useMemo(() =>
    bodyMetrics.filter((m) => m.weightLbs != null)
      .map((m) => ({ createdAt: m.createdAt, value: m.weightLbs! })),
    [bodyMetrics]);

  const bodyFatData = useMemo(() =>
    bodyMetrics.filter((m) => m.bodyFatPercentage != null)
      .map((m) => ({ createdAt: m.createdAt, value: m.bodyFatPercentage! })),
    [bodyMetrics]);

  const rhrData = useMemo(() =>
    bodyMetrics.filter((m) => m.restingHeartRate != null)
      .map((m) => ({ createdAt: m.createdAt, value: m.restingHeartRate! })),
    [bodyMetrics]);

  const lbmData = useMemo(() =>
    bodyMetrics.filter((m) => m.leanBodyMassLbs != null)
      .map((m) => ({ createdAt: m.createdAt, value: m.leanBodyMassLbs! })),
    [bodyMetrics]);

  const hasWorkoutCharts = durationData.length >= 1 || caloriesData.length >= 1 ||
    distanceData.length >= 1 || avgHRData.length >= 1;
  const hasBodyCharts = weightData.length >= 1 || bodyFatData.length >= 1 ||
    rhrData.length >= 1 || lbmData.length >= 1;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data || (!hasWorkoutCharts && !hasBodyCharts)) {
    return (
      <View style={styles.center}>
        <Ionicons name="analytics-outline" size={48} color={colors.border} />
        <Text muted style={{ marginTop: spacing.md, textAlign: 'center' }}>
          No tracking data yet.{'\n'}Post workouts or body stats to see charts.
        </Text>
      </View>
    );
  }

  // Summary stats
  const totalWorkouts = workouts.length;
  const totalBodyEntries = bodyMetrics.length;
  const allDates = [...workouts.map(w => w.createdAt), ...bodyMetrics.map(m => m.createdAt)].sort();
  const spanWeeks = allDates.length >= 2
    ? Math.max(1, Math.round((new Date(allDates[allDates.length - 1]).getTime() - new Date(allDates[0]).getTime()) / (7 * 24 * 60 * 60 * 1000)))
    : 1;
  const perWeek = (totalWorkouts / spanWeeks).toFixed(1);

  return (
    <View>
      {/* ── Summary Banner ── */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalWorkouts}</Text>
          <Text style={styles.summaryLabel}>Workouts</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{perWeek}</Text>
          <Text style={styles.summaryLabel}>Per Week</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalBodyEntries}</Text>
          <Text style={styles.summaryLabel}>Body Logs</Text>
        </View>
      </View>

      {hasWorkoutCharts && (
        <>
          <View style={styles.sectionHeader}>
            <Ionicons name="fitness-outline" size={18} color={colors.brandPurple} />
            <Text style={styles.sectionTitle}>Workouts</Text>
          </View>
          <ChartCard title="Duration" data={durationData} unit="min" color={colors.brandPurple} />
          <ChartCard title="Calories" data={caloriesData} unit="cal" color={colors.brandRed} />
          <ChartCard title="Distance" data={distanceData} unit="mi" color="#3498db" />
          <ChartCard title="Avg Heart Rate" data={avgHRData} unit="bpm" color="#e74c3c" />
        </>
      )}
      {hasBodyCharts && (
        <>
          <View style={styles.sectionHeader}>
            <Ionicons name="body-outline" size={18} color="#2C3E50" />
            <Text style={styles.sectionTitle}>Body Stats</Text>
          </View>
          <ChartCard title="Weight" data={weightData} unit="lbs" color="#2C3E50" />
          <ChartCard title="Body Fat" data={bodyFatData} unit="%" color="#e67e22" />
          <ChartCard title="Resting Heart Rate" data={rhrData} unit="bpm" color="#e74c3c" />
          <ChartCard title="Lean Mass" data={lbmData} unit="lbs" color="#27ae60" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  // ── Summary Banner ──
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: 0.2,
  },
  // ── Chart Card ──
  chartCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  chartMeta: {
    alignItems: 'flex-end',
  },
  chartLatest: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  chartUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  chartDelta: {
    fontSize: 11,
    fontWeight: '600',
  },
  // ── Stat Row (Min/Avg/Max) ──
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 1,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: colors.border,
  },
});
