import { useEffect } from 'react';
import { forgetDraft, useDrafts } from '../state/drafts';
import { downloadText } from '../ui/DraftField';
export function DraftRecovery() {
  const drafts = useDrafts();
  const orphaned = drafts.filter((draft) => draft.orphaned);
  useEffect(() => {
    if (!orphaned.length) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [orphaned.length]);
  if (!orphaned.length) return null;
  return (
    <section className="draft-recovery" role="alert">
      <h2>Unsaved drafts kept on this page</h2>
      <p>
        A widget or editor was closed before these drafts could be saved. Download them before
        leaving this page.
      </p>
      {orphaned.map((draft) => (
        <div key={draft.id}>
          <strong>{draft.label}</strong>
          <pre>{draft.text || '(empty text)'}</pre>
          <button
            className="small"
            onClick={() => downloadText(`${draft.label}-draft.txt`, draft.text)}
          >
            Download draft
          </button>
          <button className="small" onClick={() => forgetDraft(draft.id)}>
            Discard draft
          </button>
        </div>
      ))}
    </section>
  );
}
