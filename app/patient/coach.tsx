import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

const SONA = '/patient/sona' as Href;

/** @deprecated Open the Sona tab instead. */
export default function PatientCoachRedirect() {
  const { prefill } = useLocalSearchParams<{ prefill?: string | string[] }>();
  const raw = Array.isArray(prefill) ? prefill[0] : prefill;
  if (raw && String(raw).trim()) {
    return <Redirect href={{ pathname: SONA, params: { prefill: String(raw) } } as unknown as Href} />;
  }
  return <Redirect href={SONA} />;
}
