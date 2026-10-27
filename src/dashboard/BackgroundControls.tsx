import { useEffect, useRef, useState } from 'react';
import type { DashboardBackground } from '../state/model';
import { dashboardStore, useDashboard } from '../state/store';
import { loadImage, saveImage } from '../assets/images';
import { IconButton } from '../ui/IconButton';

function useBackgroundImage(id: string | null) {
  const [value, setValue] = useState({ url: '', error: '' });
  useEffect(() => {
    let disposed = false,
      url = '';
    setValue({ url: '', error: '' });
    if (!id) return;
    void loadImage(id)
      .then((asset) => {
        if (disposed) return;
        url = URL.createObjectURL(asset.blob);
        setValue({ url, error: '' });
      })
      .catch((e) => {
        if (!disposed) setValue({ url: '', error: e.message });
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return value;
}
export function DashboardBackdrop({ background }: { background: DashboardBackground }) {
  const { url, error } = useBackgroundImage(background.assetId);
  return (
    <>
      {url && (
        <div
          className="dashboard-backdrop"
          aria-hidden="true"
          style={{ backgroundImage: `url("${url}")`, backgroundSize: background.fit }}
        >
          <div style={{ opacity: background.dim / 100 }} />
        </div>
      )}
      {error && (
        <p className="background-warning" role="status">
          Background image unavailable. Choose another in Settings.
        </p>
      )}
    </>
  );
}
export function BackgroundControls() {
  const state = useDashboard();
  const live = state.document!.background;
  const [base, setBase] = useState(() => structuredClone(live));
  const [draft, setDraft] = useState(() => structuredClone(live));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const image = useBackgroundImage(draft.assetId);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty && !busy && JSON.stringify(live) !== JSON.stringify(base)) {
      setBase(structuredClone(live));
      setDraft(structuredClone(live));
    }
  }, [live, base, dirty, busy]);
  const disabled = busy || state.pending > 0;
  return (
    <section className="background-section">
      <h2>Dashboard background</h2>
      <p>Choose a local photo or illustration. Save to apply it to your dashboard.</p>
      <form
        className="background-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || !dirty) return;
          const value = structuredClone(draft);
          setBusy(true);
          setError('');
          setMessage('');
          void dashboardStore
            .dispatch({ type: 'background', expected: base, value })
            .then(() => {
              if (active.current) {
                setBase(value);
                setMessage('Background saved.');
              }
            })
            .catch((e) => {
              if (active.current) setError(e.message + ' Your background draft is still here.');
            })
            .finally(() => {
              if (active.current) setBusy(false);
            });
        }}
      >
        <div
          className="background-preview"
          aria-label="Background preview"
          style={
            image.url
              ? { backgroundImage: `url("${image.url}")`, backgroundSize: draft.fit }
              : undefined
          }
        >
          {image.url ? (
            <span style={{ opacity: draft.dim / 100 }} />
          ) : (
            <span className="background-preview-empty">Theme background</span>
          )}
        </div>
        <div className="background-buttons">
          <IconButton
            icon="upload"
            caption="Choose image"
            label="Choose dashboard background image"
            disabled={disabled}
            onClick={() => input.current?.click()}
          />
          <IconButton
            icon="trash"
            caption="Remove"
            label="Remove dashboard background image"
            disabled={disabled || !draft.assetId}
            onClick={() => {
              setDraft({ ...draft, assetId: null });
              setMessage('');
            }}
          />
        </div>
        <input
          ref={input}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp"
          aria-label="Dashboard background file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setBusy(true);
            setError('');
            setMessage('');
            void saveImage(file)
              .then((asset) => {
                if (active.current) setDraft((old) => ({ ...old, assetId: asset.id }));
              })
              .catch((e) => {
                if (active.current) setError(e.message);
              })
              .finally(() => {
                if (active.current) setBusy(false);
              });
          }}
        />
        <div className="background-options">
          <label>
            Image fit
            <select
              aria-label="Dashboard background fit"
              value={draft.fit}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, fit: e.target.value as 'cover' | 'contain' })}
            >
              <option value="cover">Fill canvas</option>
              <option value="contain">Show whole image</option>
            </select>
          </label>
          <label>
            Soften background <output>{draft.dim}%</output>
            <input
              aria-label="Dashboard background softness"
              type="range"
              min="0"
              max="80"
              step="1"
              value={draft.dim}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, dim: Number(e.target.value) })}
            />
          </label>
        </div>
        {(error || image.error) && (
          <p className="local-error" role="alert">
            {error || image.error}
          </p>
        )}
        {dirty && <p role="status">Unsaved background changes</p>}
        {message && <p role="status">{message}</p>}
        <div className="appearance-actions">
          {dirty && (
            <button
              type="button"
              className="small"
              disabled={disabled}
              onClick={() => {
                setBase(structuredClone(live));
                setDraft(structuredClone(live));
                setError('');
                setMessage('');
              }}
            >
              Discard background changes
            </button>
          )}
          <button type="submit" className="primary" disabled={disabled || !dirty}>
            {busy ? 'Preparing…' : 'Save background'}
          </button>
        </div>
      </form>
    </section>
  );
}
