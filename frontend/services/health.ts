/**
 * Apple Health workout import service.
 *
 * Uses @kingstinct/react-native-healthkit to read recent workouts
 * and map them to the app's workout model.
 */

import { Platform } from 'react-native';
import type { ActivityType } from '@/models/post';

export interface HealthWorkout {
  /** Our app's activity type */
  activityType: ActivityType;
  /** Duration in seconds */
  durationSeconds: number;
  /** Calories burned (may be 0 if unavailable) */
  caloriesBurned: number;
  /** When the workout started */
  startDate: Date;
  /** When the workout ended */
  endDate: Date;
  /** Display label, e.g. "Running · 45 min · 350 cal" */
  label: string;
}

// WorkoutActivityType enum values → our ActivityType
// Values from @kingstinct/react-native-healthkit WorkoutActivityType
const HK_ACTIVITY_MAP: Record<number, ActivityType> = {
  37: 'running',
  13: 'cycling',
  46: 'swimming',
  20: 'weightlifting',    // functionalStrengthTraining
  50: 'weightlifting',    // traditionalStrengthTraining
  11: 'crossfit',         // crossTraining
  14: 'dance',
  57: 'yoga',
  66: 'pilates',
  24: 'hiking',
  35: 'rowing',
  8:  'boxing',
  28: 'martial_arts',     // martialArts
  9:  'climbing',
  63: 'hiit',             // highIntensityIntervalTraining
  52: 'walking',
  62: 'stretching',       // flexibility
  73: 'cardio',           // mixedCardio
  64: 'cardio',           // jumpRope
  6:  'sports',           // basketball
  41: 'sports',           // soccer
  48: 'sports',           // tennis
};

function mapActivityType(hkType: number): ActivityType {
  return HK_ACTIVITY_MAP[hkType] ?? 'other';
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function buildLabel(activityType: ActivityType, durationSeconds: number, calories: number): string {
  const name = activityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const parts = [name, formatDuration(durationSeconds)];
  if (calories > 0) parts.push(`${Math.round(calories)} cal`);
  return parts.join(' · ');
}

/**
 * Check whether HealthKit is available (iOS only).
 */
export function isHealthAvailable(): boolean {
  return Platform.OS === 'ios';
}

export interface HealthBodyMetrics {
  weightLbs: number | null;
  bodyFatPercentage: number | null;
  /** Display label, e.g. "185 lbs · 15% BF" */
  label: string;
}

/**
 * Fetch the most recent body weight and body fat % from Apple Health.
 */
export async function fetchBodyMetrics(): Promise<HealthBodyMetrics | null> {
  if (!isHealthAvailable()) return null;

  const HealthKit = await import('@kingstinct/react-native-healthkit');

  await HealthKit.requestAuthorization({
    toRead: [
      'HKQuantityTypeIdentifierBodyMass' as any,
      'HKQuantityTypeIdentifierBodyFatPercentage' as any,
    ],
  });

  const [weightSample, bfSample] = await Promise.all([
    HealthKit.getMostRecentQuantitySample(
      'HKQuantityTypeIdentifierBodyMass' as any,
      'lb',
    ),
    HealthKit.getMostRecentQuantitySample(
      'HKQuantityTypeIdentifierBodyFatPercentage' as any,
      '%',
    ),
  ]);

  const weightLbs = weightSample ? Math.round(weightSample.quantity * 10) / 10 : null;
  const bodyFatPercentage = bfSample ? Math.round(bfSample.quantity * 10) / 10 : null;

  if (weightLbs === null && bodyFatPercentage === null) return null;

  const parts: string[] = [];
  if (weightLbs !== null) parts.push(`${weightLbs} lbs`);
  if (bodyFatPercentage !== null) parts.push(`${bodyFatPercentage}% BF`);

  return { weightLbs, bodyFatPercentage, label: parts.join(' · ') };
}

/**
 * Request HealthKit authorization and fetch recent workouts.
 * Returns the last `limit` workouts, sorted newest first.
 */
export async function fetchRecentWorkouts(
  limit = 20,
): Promise<HealthWorkout[]> {
  if (!isHealthAvailable()) return [];

  // Dynamic import so Android doesn't crash
  const HealthKit = await import('@kingstinct/react-native-healthkit');

  // Request read access for workouts
  await HealthKit.requestAuthorization({
    toRead: ['HKWorkoutTypeIdentifier' as any],
  });

  const samples = await HealthKit.queryWorkoutSamples({
    limit,
    ascending: false,
  });

  return samples.map((s) => {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    const durationSeconds = Math.round(s.duration.quantity);
    const caloriesBurned = Math.round(s.totalEnergyBurned?.quantity ?? 0);
    const activityType = mapActivityType(s.workoutActivityType);

    return {
      activityType,
      durationSeconds,
      caloriesBurned,
      startDate: start,
      endDate: end,
      label: buildLabel(activityType, durationSeconds, caloriesBurned),
    };
  });
}
