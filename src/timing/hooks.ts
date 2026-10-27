import { useEffect, useState } from 'react';
import { dashboardStore } from '../state/store';
import { nextDeadline, pendingEvents } from './time';
export function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function useReconciliation() {
  useEffect(() => {
    const reconcile = () => {
      void dashboardStore.reconcile();
    };
    const tick = () => {
      const doc = dashboardStore.getSnapshot().document;
      if (!doc) return;
      const due = nextDeadline(doc);
      if (
        (due !== null && due <= Date.now()) ||
        (location.protocol !== 'chrome-extension:' && pendingEvents(doc, Date.now()).length)
      )
        reconcile();
    };
    const timer = setInterval(tick, 1000);
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    reconcile();
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', reconcile);
      document.removeEventListener('visibilitychange', reconcile);
    };
  }, []);
}
