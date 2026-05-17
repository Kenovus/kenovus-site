import { useCallback, useEffect, useState } from 'react';

import {
  getLastDashboardGreetingDate,
  isForceDailyGreetingEnabled,
  localDateKey,
  setLastDashboardGreetingDate,
  shouldShowDailyGreeting,
} from '@/lib/dashboardStorage';

export function useDailyGreetingStorage() {
  const [greetingDateLoaded, setGreetingDateLoaded] = useState(false);
  const [showDailyGreeting, setShowDailyGreeting] = useState(false);

  useEffect(() => {
    void (async () => {
      if (isForceDailyGreetingEnabled()) {
        setShowDailyGreeting(true);
        setGreetingDateLoaded(true);
        return;
      }
      const last = await getLastDashboardGreetingDate();
      setShowDailyGreeting(shouldShowDailyGreeting(last));
      setGreetingDateLoaded(true);
    })();
  }, []);

  const dismissDailyGreeting = useCallback(async () => {
    await setLastDashboardGreetingDate(localDateKey());
    setShowDailyGreeting(false);
  }, []);

  return {
    greetingDateLoaded,
    showDailyGreeting,
    setShowDailyGreeting,
    dismissDailyGreeting,
  };
}
