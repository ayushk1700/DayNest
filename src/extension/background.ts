import { Repository } from '../persistence/repository';
import { createStorageAdapter, DOCUMENT_KEY } from '../persistence/adapter';
import { extensionAPI } from './api';
import { ALARM_NAME, runBackground } from './runner';
import './music-background';
const api = extensionAPI();
if (api) {
  const repo = new Repository(createStorageAdapter());
  let running = false,
    again = false;
  const wake = () => {
    again = true;
    if (running) return;
    running = true;
    void (async () => {
      try {
        while (again) {
          again = false;
          await runBackground(repo, api);
        }
      } catch (error) {
        console.error('DayNest background reconciliation failed; saved data was retained.', error);
      } finally {
        running = false;
      }
    })();
  };
  // Register listeners synchronously, before starting asynchronous work.
  api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) wake();
  });
  api.runtime.onStartup.addListener(wake);
  api.runtime.onInstalled.addListener(wake);
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && DOCUMENT_KEY in changes) wake();
  });
  wake();
}
