import { useState } from 'react';
import type { CardAppearance } from '../state/model';
import { dashboardStore, useDashboard } from '../state/store';
import { curatedPresets } from '../ui/presets';

export function PresetControls({
  draft,
  onLoad,
}: {
  draft: CardAppearance;
  onLoad: (value: CardAppearance) => void;
}) {
  const state = useDashboard(),
    saved = state.document?.presets ?? [];
  const [selected, setSelected] = useState(''),
    [name, setName] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const preset = [...curatedPresets, ...saved].find((p) => p.id === selected),
    editable = saved.find((p) => p.id === selected);
  const busy = state.pending > 0;
  function commit(value: typeof saved, success: string) {
    setError('');
    setMessage('');
    const names = value.map((p) => p.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      setError('Choose a unique preset name.');
      return;
    }
    void dashboardStore
      .dispatch({ type: 'presets', expected: saved, value })
      .then(() => setMessage(success))
      .catch((e) => setError(e.message));
  }
  return (
    <details className="preset-controls">
      <summary>Reusable appearance presets</summary>
      <p className="appearance-help">
        Preview a preset at the current scope, then Save appearance to apply it. Copies stay
        independent of the library.
      </p>
      <label>
        Choose preset
        <select
          aria-label="Choose appearance preset"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setName([...curatedPresets, ...saved].find((p) => p.id === e.target.value)?.name ?? '');
            setMessage('');
          }}
        >
          <option value="">Select a preset</option>
          <optgroup label="Curated · theme compatible">
            {curatedPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Your presets">
            {saved.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <button
        type="button"
        className="small"
        disabled={!preset || busy}
        onClick={() => {
          if (preset) {
            onLoad(structuredClone(preset.appearance));
            setMessage('Preset loaded into the preview. Save appearance to apply.');
          }
        }}
      >
        Preview preset
      </button>
      <label>
        Preset name
        <input
          aria-label="Preset name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="preset-actions">
        <button
          type="button"
          className="small"
          disabled={busy || !name.trim() || saved.length >= 100}
          onClick={() => {
            const id = crypto.randomUUID();
            commit(
              [...saved, { id, name: name.trim(), appearance: structuredClone(draft) }],
              'Preset created.',
            );
            setSelected(id);
          }}
        >
          Create from appearance draft
        </button>
        <button
          type="button"
          className="small"
          disabled={busy || !editable || !name.trim()}
          onClick={() =>
            commit(
              saved.map((p) => (p.id === selected ? { ...p, name: name.trim() } : p)),
              'Preset renamed.',
            )
          }
        >
          Rename
        </button>
        <button
          type="button"
          className="small"
          disabled={busy || !editable}
          onClick={() =>
            commit(
              saved.map((p) =>
                p.id === selected ? { ...p, appearance: structuredClone(draft) } : p,
              ),
              'Preset updated. Previously styled widgets kept their appearance.',
            )
          }
        >
          Update from draft
        </button>
        <button
          type="button"
          className="small"
          disabled={busy || !editable}
          onClick={() => {
            commit(
              saved.filter((p) => p.id !== selected),
              'Preset deleted. Undo can restore it.',
            );
            setSelected('');
          }}
        >
          Delete preset
        </button>
      </div>
      <p className="appearance-help">
        Library buttons save one undoable change immediately. Presets contain appearance only.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && (
        <p role="status" className="appearance-help">
          {message}
        </p>
      )}
    </details>
  );
}
