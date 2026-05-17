import { Redirect, type Href } from 'expo-router';

const PATIENT_HOME = '/patient/home' as Href;

/** Legacy route — unified home + coach lives at `/patient/home`. */
export default function GuidedHomeRedirect() {
  return <Redirect href={PATIENT_HOME} />;
}
