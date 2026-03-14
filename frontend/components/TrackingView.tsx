import { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
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
  const sign = delta >= 0 ? '+' : '';

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.chartMeta}>
          <Text style={styles.chartLatest}>
            {Number.isInteger(latest) ? latest : latest.toFixed(1)} {unit}
          </Text>
          {data.length > 1 && (
            <Text
              style={[
                styles.chartDelta,
                { color: delta >= 0 ? '#2ecc71' : '#e74c3c' },
              ]}
            >
              {sign}
              {Number.isInteger(delta) ? delta : delta.toFixed(1)}
            </Text>
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
        hideRules
        yAxisTextStyle={{ color: colors.mutedForeground, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.mutedForeground, fontSize: 9 }}
        hideYAxisText={false}
        yAxisLabelWidth={Y_AXIS_W}
        isAnimated
        animationDuration={600}
        startFillColor={color}
        endFillColor={colors.background}
        startOpacity={0.2}
        endOpacity={0}
        areaChart
        noOfSections={4}
        yAxisColor="transparent"
        xAxisColor={colors.border}
        scrollToEnd={scrollable}
        disableScroll={!scrollable}
      />
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
        <Text muted>No tracking data yet. Post workouts or body stats to see charts.</Text>
      </View>
    );
  }

  return (
    <View>
      {hasWorkoutCharts && (
        <>
          <Text style={styles.sectionTitle}>Workouts</Text>
          <ChartCard title="Duration" data={durationData} unit="min" color={colors.brandPurple} />
          <ChartCard title="Calories" data={caloriesData} unit="cal" color={colors.brandRed} />
          <ChartCard title="Distance" data={distanceData} unit="mi" color="#3498db" />
          <ChartCard title="Avg Heart Rate" data={avgHRData} unit="bpm" color="#e74c3c" />
        </>
      )}
      {hasBodyCharts && (
        <>
          <Text style={styles.sectionTitle}>Body Stats</Text>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  chartCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  chartDelta: {
    fontSize: 12,
    fontWeight: '600',
  },
});
