import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import { fetchPatientGoals, type PatientGoalsRow } from '@/lib/patientGoals';

export function usePatientGoals() {
  const { user } = useAuth();
  const [row, setRow] = useState<PatientGoalsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pid = await fetchPatientIdForAuthUser(user.id);
      if (!pid) {
        setRow(null);
        return;
      }
      const data = await fetchPatientGoals(pid);
      setRow(data);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { row, loading, refresh };
}
