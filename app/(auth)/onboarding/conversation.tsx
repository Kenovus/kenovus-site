import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { OnboardingChat } from '@/components/patient/OnboardingChat';
import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser, upsertOnboardingContext } from '@/lib/onboarding/patient';
import type {
  OnboardingConversationAnswers,
  PatientOnboardingContextRow,
} from '@/types/onboarding';

function toContextRow(
  patientId: string,
  a: OnboardingConversationAnswers,
): PatientOnboardingContextRow {
  return {
    patient_id: patientId,
    past_struggle: a.past_struggle,
    success_definition: a.success_definition,
    readiness_score: a.readiness_score,
    commitment_response: a.commitment_response,
    is_glp1_patient: a.is_glp1_patient,
    glp1_medication: a.glp1_medication,
    glp1_dose: a.glp1_dose,
    clinic_connection: a.clinic_connection,
  };
}

export default function OnboardingConversation() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const persistAndGo = async (answers: OnboardingConversationAnswers) => {
    if (!user) {
      Alert.alert('Session', 'Sign in again to continue.');
      return;
    }
    setLoading(true);
    try {
      const patientId = await fetchPatientIdForAuthUser(user.id);
      if (!patientId) {
        Alert.alert(
          'Setup required',
          'No patient record is linked to this account yet. Ask your clinic to finish provisioning.',
        );
        return;
      }
      const { error } = await upsertOnboardingContext(toContextRow(patientId, answers));
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      router.replace('/(auth)/onboarding/profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingChat
      continueLoading={loading}
      onContinue={(a) => void persistAndGo(a)}
      onSkip={() => router.replace('/(auth)/onboarding/profile')}
    />
  );
}
