import { useEffect, useState } from 'react';
import { extensionAPI } from '../extension/api';
export function NotificationSettings() {
  const api = extensionAPI();
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (api)
      void api.permissions
        .contains({ permissions: ['notifications'] })
        .then(setAllowed)
        .catch(() => setMessage('Notification permission could not be read.'));
  }, []);
  function toggle() {
    if (!api || busy) return;
    setBusy(true);
    const removing = allowed;
    const operation = removing
      ? api.permissions.remove({ permissions: ['notifications'] })
      : api.permissions.request({ permissions: ['notifications'] });
    void operation
      .then(async (granted) => {
        setAllowed(removing ? !granted : granted);
        if (removing) {
          setMessage(
            granted ? 'Notifications disabled.' : 'Notification permission could not be removed.',
          );
          return;
        }
        if (!granted) {
          setMessage(
            'Notifications were not allowed. In-app timer and reminder states still work.',
          );
          return;
        }
        const level = await api.notifications?.getPermissionLevel();
        setMessage(
          level === 'granted'
            ? 'Notifications enabled.'
            : 'Permission granted, but alerts are blocked in Edge or Windows. In-app states still work.',
        );
      })
      .catch(() => setMessage('Notifications are unavailable. In-app states still work.'))
      .finally(() => setBusy(false));
  }
  return (
    <section className="notification-settings">
      <h2>Notifications</h2>
      <p>
        {api
          ? 'Optional system alerts for timers and reminders.'
          : 'System notifications need the installed extension. Preview reminders are checked while a dashboard is open.'}
      </p>
      <button className="small" disabled={!api || busy} onClick={toggle}>
        {allowed ? 'Disable notifications' : 'Enable notifications'}
      </button>
      {message && <p role="status">{message}</p>}
      <p>
        Alarms may arrive late after sleep. No alerts are guaranteed while Edge or the computer is
        closed; missed events are reconciled when Edge starts again.
      </p>
    </section>
  );
}
