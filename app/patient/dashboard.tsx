import { Redirect, type Href } from 'expo-router';

const PATIENT_HOME = '/patient/home' as Href;

/** Legacy explorer home — unified at `/patient/home`. */
export default function PatientDashboardRedirect() {
  return <Redirect href={PATIENT_HOME} />;
}
