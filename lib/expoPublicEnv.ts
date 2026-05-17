import Constants from 'expo-constants';

/**
 * Read EXPO_PUBLIC_* at runtime. Metro inlines `process.env` in dev; EAS can also
 * expose values via `expo.extra` when mirrored in app.config.ts.
 */
export function getExpoPublic(key: string): string {
  const fromProcess = (process.env[key as keyof NodeJS.ProcessEnv] as string | undefined)?.trim() ?? '';
  if (fromProcess) return fromProcess;
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const fromExtra = extra?.[key]?.trim();
  return fromExtra ?? '';
}
