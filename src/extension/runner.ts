import { MissingDocumentError } from '../persistence/repository';
import type { Repository } from '../persistence/repository';
import { pendingEvents, nextDeadline } from '../timing/time';
import type { ExtensionAPI } from './api';
import { InvalidDataError } from '../state/validation';
export const ALARM_NAME = 'purrductivity-next';
export async function runBackground(
  repo: Repository,
  api: ExtensionAPI,
  now = Date.now(),
): Promise<void> {
  let doc;
  try {
    doc = await repo.reconcile(now);
  } catch (error) {
    if (error instanceof MissingDocumentError || error instanceof InvalidDataError) {
      // Only the dashboard can offer recovery for invalid saved data. Do not
      // repeatedly wake on stale deadlines or overwrite it from the worker.
      await api.alarms.clear(ALARM_NAME);
      return;
    }
    throw error;
  }
  for (const candidate of pendingEvents(doc, now)) {
    const event = await repo.claimEvent(candidate.id, now);
    if (!event) continue;
    // Claim is persisted before the OS side effect. An interrupted claim is never replayed.
    let result: 'delivered' | 'unavailable' | 'failed' = 'unavailable';
    try {
      if (
        event.notify &&
        (await api.permissions.contains({ permissions: ['notifications'] })) &&
        api.notifications &&
        (await api.notifications.getPermissionLevel()) === 'granted'
      ) {
        await api.notifications.create(event.id, {
          type: 'basic',
          iconUrl: api.runtime.getURL('icons/icon-128.png'),
          title: event.title,
          message: event.message,
        });
        result = 'delivered';
      }
    } catch {
      result = 'failed';
    }
    await repo.finishDelivery(event.id, result);
  }
  doc = await repo.read();
  const due = nextDeadline(doc);
  if (due === null) await api.alarms.clear(ALARM_NAME);
  else await api.alarms.create(ALARM_NAME, { when: Math.max(due, Date.now() + 1000) });
}
