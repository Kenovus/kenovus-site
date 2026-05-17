import { NativeModules, Platform } from 'react-native';
import type { default as RNHealth } from 'react-native-health';

async function loadHealthKit(): Promise<typeof RNHealth | null> {
  if (Platform.OS !== 'ios' || !NativeModules.AppleHealthKit) return null;
  try {
    return (await import('react-native-health')).default;
  } catch {
    return null;
  }
}

export type AppleHealthSnapshot = {
  stepsToday: number | null;
  weightLbs: number | null;
  sleepHoursLastNight: number | null;
  restingHeartRate: number | null;
  hrvSdnnMs: number | null;
};

export function isAppleHealthNativeAvailable(): boolean {
  return Platform.OS === 'ios' && Boolean(NativeModules.AppleHealthKit);
}

export async function requestAppleHealthAuthorization(): Promise<{ ok: boolean; message?: string }> {
  const HK = await loadHealthKit();
  if (!HK) {
    return {
      ok: false,
      message:
        'Apple Health needs a dev or production build with HealthKit enabled (not available in Expo Go).',
    };
  }

  const P = HK.Constants.Permissions;

  return new Promise((resolve) => {
    HK.initHealthKit(
      {
        permissions: {
          read: [
            P.StepCount,
            P.Steps,
            P.SleepAnalysis,
            P.HeartRate,
            P.RestingHeartRate,
            P.HeartRateVariability,
            P.Weight,
          ],
          write: [],
        },
      },
      (err: string) => {
        if (err) {
          resolve({ ok: false, message: err });
          return;
        }
        resolve({ ok: true });
      },
    );
  });
}

function sleepHoursFromSamples(samples: { startDate: string; endDate: string; value: string | number }[]): number | null {
  const asleep = new Set(['ASLEEP', 'DEEP', 'CORE', 'REM']);
  let ms = 0;
  for (const s of samples) {
    if (!asleep.has(String(s.value ?? '').toUpperCase())) continue;
    const a = new Date(s.startDate).getTime();
    const b = new Date(s.endDate).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) ms += b - a;
  }
  if (ms <= 0) return null;
  return Math.round((ms / 3600000) * 10) / 10;
}

export async function fetchAppleHealthSnapshot(): Promise<AppleHealthSnapshot> {
  const HK = await loadHealthKit();
  if (!HK) {
    return {
      stepsToday: null,
      weightLbs: null,
      sleepHoursLastNight: null,
      restingHeartRate: null,
      hrvSdnnMs: null,
    };
  }

  return new Promise((resolve) => {
    const out: AppleHealthSnapshot = {
      stepsToday: null,
      weightLbs: null,
      sleepHoursLastNight: null,
      restingHeartRate: null,
      hrvSdnnMs: null,
    };
    let pending = 5;

    const done = () => {
      pending -= 1;
      if (pending <= 0) resolve(out);
    };

    HK.getStepCount({ date: new Date().toISOString(), includeManuallyAdded: true }, (err, res) => {
      if (!err && res && typeof res.value === 'number') out.stepsToday = res.value;
      done();
    });

    HK.getLatestWeight({ unit: HK.Constants.Units.pound }, (err, res) => {
      if (!err && res && typeof res.value === 'number') out.weightLbs = res.value;
      done();
    });

    const sleepStart = new Date();
    sleepStart.setHours(sleepStart.getHours() - 36);
    HK.getSleepSamples(
      { startDate: sleepStart.toISOString(), endDate: new Date().toISOString(), ascending: false, limit: 80 },
      (err, samples) => {
        if (!err && samples?.length) {
          out.sleepHoursLastNight = sleepHoursFromSamples(
            samples as { startDate: string; endDate: string; value: string | number }[],
          );
        }
        done();
      },
    );

    HK.getRestingHeartRateSamples(
      {
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        endDate: new Date().toISOString(),
        limit: 1,
      },
      (err, rows) => {
        const v = rows?.[0]?.value;
        if (!err && typeof v === 'number') out.restingHeartRate = v;
        done();
      },
    );

    HK.getHeartRateVariabilitySamples(
      {
        startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        endDate: new Date().toISOString(),
        limit: 1,
      },
      (err, rows) => {
        const v = rows?.[0]?.value;
        if (!err && typeof v === 'number') out.hrvSdnnMs = v;
        done();
      },
    );
  });
}
