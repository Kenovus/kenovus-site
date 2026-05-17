import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { fetchPatientIdForAuthUser } from '@/lib/onboarding/patient';
import {
  deletePatientSupplement,
  fetchDailyLogsForDate,
  fetchPatientSupplements,
  localDateKey,
  mergeSupplementsForUi,
  setDailySupplementLog,
  upsertPatientSupplement,
  type MergedSupplementItem,
  type PatientSupplementRow,
} from '@/lib/patientSupplements';
import { useAuth } from '@/hooks/useAuth';

export function usePatientSupplements() {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [rows, setRows] = useState<PatientSupplementRow[]>([]);
  const [todayLogs, setTodayLogs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const merged = mergeSupplementsForUi(rows);

  const load = useCallback(async () => {
    if (!user?.id) {
      setPatientId(null);
      setRows([]);
      setTodayLogs({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const pid = await fetchPatientIdForAuthUser(user.id);
    setPatientId(pid);
    if (!pid) {
      setRows([]);
      setTodayLogs({});
      setLoading(false);
      return;
    }
    const today = localDateKey();
    const [r, logs] = await Promise.all([fetchPatientSupplements(pid), fetchDailyLogsForDate(pid, today)]);
    setRows(r);
    const m: Record<string, boolean> = {};
    for (const l of logs) {
      m[l.supplement_id] = l.taken;
    }
    setTodayLogs(m);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const saveMergedItem = useCallback(
    async (item: MergedSupplementItem) => {
      if (!patientId) return { id: null, error: 'No patient profile' };
      return upsertPatientSupplement({
        patientId,
        id: item.isCustom ? item.id : null,
        presetKey: item.presetKey,
        customName: item.isCustom ? item.displayName : null,
        dose: item.dose,
        frequency: item.frequency,
        isActive: item.isActive,
      });
    },
    [patientId],
  );

  const toggleTakenToday = useCallback(
    async (supplementId: string, taken: boolean) => {
      if (!patientId) return { error: 'No patient profile' };
      const today = localDateKey();
      const err = await setDailySupplementLog({ patientId, supplementId, logDate: today, taken });
      if (!err.error) {
        setTodayLogs((prev) => ({ ...prev, [supplementId]: taken }));
      }
      return err;
    },
    [patientId],
  );

  const removeCustom = useCallback(
    async (id: string) => {
      if (!patientId) return { error: 'No patient profile' };
      const res = await deletePatientSupplement(patientId, id);
      if (!res.error) await load();
      return res;
    },
    [patientId, load],
  );

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return {
    patientId,
    merged,
    rows,
    todayLogs,
    loading,
    refresh,
    saveMergedItem,
    toggleTakenToday,
    removeCustom,
  };
}
