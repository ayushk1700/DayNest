import { rememberDraft, forgetDraft } from '../state/drafts';
import { useEffect, useId, useRef, useState } from 'react';
interface Props {
  value: string;
  label: string;
  onSave: (expected: string, value: string) => Promise<void>;
  multiline?: boolean;
  maxLength?: number;
  className?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  selectOnFocus?: boolean;
  onBlurComplete?: () => void;
}
export function DraftField({
  value,
  label,
  onSave,
  multiline = false,
  maxLength = 100000,
  className = '',
  placeholder,
  required = false,
  autoFocus = false,
  selectOnFocus = false,
  onBlurComplete,
}: Props) {
  const draftId = useId();
  const [draft, setDraft] = useState(value);
  const [base, setBase] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const savingRef = useRef(false);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const setFieldRef = (element: HTMLInputElement | HTMLTextAreaElement | null) => {
    fieldRef.current = element;
  };
  const blurCompleteRef = useRef(onBlurComplete);
  blurCompleteRef.current = onBlurComplete;
  const completeAfterSave = useRef(false);
  const dirty = draft !== base;
  const current = useRef({ dirty, draft, label });
  current.current = { dirty, draft, label };
  useEffect(() => {
    if (dirty) rememberDraft({ id: draftId, label, text: draft, orphaned: false });
    else forgetDraft(draftId);
  }, [draftId, draft, dirty, label]);
  useEffect(
    () => () => {
      const last = current.current;
      if (last.dirty)
        rememberDraft({ id: draftId, label: last.label, text: last.draft, orphaned: true });
      else forgetDraft(draftId);
    },
    [draftId],
  );
  // A remote update only replaces a clean editor. Dirty local text remains visible.
  useEffect(() => {
    if (!dirty && !saving && value !== base) {
      setBase(value);
      setDraft(value);
    }
  }, [value, base, dirty, saving]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save(expected: string, text: string) {
    if (savingRef.current) return;
    if (required && !text.trim()) {
      setError('Enter some text before saving.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await saveRef.current(expected, text);
      setBase(text);
      current.current = { dirty: false, draft: text, label: current.current.label };
      forgetDraft(draftId);
      if (completeAfterSave.current) {
        completeAfterSave.current = false;
        blurCompleteRef.current?.();
      }
    } catch (reason) {
      setError(
        (reason instanceof Error ? reason.message : 'Could not save.') +
          ' Your draft is still here.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!dirty || saving || error) return;
    const timer = setTimeout(() => {
      void save(base, draft);
    }, 350);
    return () => clearTimeout(timer);
    // saveRef avoids restarting autosave because a parent's callback identity changed.
  }, [draft, base, dirty, saving, error]);
  useEffect(() => {
    if (!autoFocus) return;
    fieldRef.current?.focus();
    if (selectOnFocus && fieldRef.current instanceof HTMLInputElement) fieldRef.current.select();
  }, [autoFocus, selectOnFocus]);
  const common = {
    ref: setFieldRef,
    value: draft,
    'aria-label': label,
    maxLength,
    placeholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onFocus: () => {
      completeAfterSave.current = false;
    },
    onBlur: () => {
      if (!blurCompleteRef.current) return;
      if (dirty || savingRef.current) completeAfterSave.current = true;
      else blurCompleteRef.current();
    },
    'aria-invalid': !!error,
  };
  return (
    <div className={`draft-field ${className}`}>
      {multiline ? <textarea {...common} spellCheck /> : <input {...common} type="text" />}
      <span className="field-state" role="status">
        {saving ? 'Saving…' : dirty && !error ? 'Unsaved draft' : ''}
      </span>
      {error && (
        <div className="field-error" role="alert">
          <p>{error}</p>
          <div>
            <button
              type="button"
              onClick={() => {
                setBase(value);
                setDraft(value);
                setError('');
              }}
            >
              Use saved version
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void save(value, draft);
              }}
            >
              Save my draft instead
            </button>
            <button type="button" onClick={() => downloadText(`${label}-draft.txt`, draft)}>
              Download draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[^a-zA-Z0-9._-]/g, '-');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
