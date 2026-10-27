import { useDrafts } from '../state/drafts';
import { dashboardStore, useDashboard } from '../state/store';
import { downloadText } from '../ui/DraftField';
export function StorageStatus() {
  const state = useDashboard();
  const drafts = useDrafts();
  if (state.status === 'ready')
    return (
      <p className="storage-status" role="status">
        {state.pending
          ? 'Saving locally…'
          : drafts.length
            ? 'Unsaved drafts on this page'
            : 'Saved on this device'}
      </p>
    );
  if (state.status === 'loading')
    return (
      <p className="storage-status" role="status">
        Loading your dashboard…
      </p>
    );
  return (
    <section className="storage-error" role="alert">
      <h2>Your dashboard could not be loaded or saved</h2>
      <p>{state.error}</p>
      <p>
        The existing saved data has not been replaced. Unsaved text stays in its editor; download
        important drafts before leaving.
      </p>
      <div className="recovery-actions">
        <button
          className="small"
          onClick={() => {
            void dashboardStore.retry();
          }}
        >
          Retry storage
        </button>
        <button
          className="small"
          disabled={state.raw === undefined}
          onClick={() =>
            downloadText(
              'daynest-recovery.txt',
              typeof state.raw === 'string' ? state.raw : JSON.stringify(state.raw),
            )
          }
        >
          Download saved data
        </button>
        <button
          className="small"
          disabled={state.raw === undefined}
          onClick={() => {
            if (
              confirm(
                'Save a local recovery copy of the existing data, then replace the dashboard with sample widgets? Any unsaved drafts in this page will be discarded after successful recovery.',
              )
            ) {
              void dashboardStore.recover().then(() => {
                if (dashboardStore.getSnapshot().status === 'ready') location.reload();
              });
            }
          }}
        >
          Back up and restore samples
        </button>
      </div>
    </section>
  );
}
