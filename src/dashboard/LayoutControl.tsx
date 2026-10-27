import { IconButton } from '../ui/IconButton';
import { useState } from 'react';
import type { Widget } from '../state/model';
import { Overlay } from '../ui/Overlay';
import { dashboardStore } from '../state/store';
import { minimums } from './layout';
export function LayoutControl({ widget }: { widget: Widget }) {
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState({ position: widget.position, size: widget.size });
  const [value, setValue] = useState({ ...widget.position, ...widget.size });
  const [error, setError] = useState('');
  return (
    <>
      <IconButton
        icon="layout"
        caption="Layout"
        label={`Layout for ${widget.title || widget.type}`}
        disabled={innerWidth < 1100 || widget.pinned}
        title={widget.pinned ? 'Unpin this card before moving or resizing' : undefined}
        onClick={() => {
          setBase(structuredClone({ position: widget.position, size: widget.size }));
          setValue({ ...widget.position, ...widget.size });
          setOpen(true);
        }}
      />
      {open && (
        <Overlay modal label="Widget layout" onClose={() => setOpen(false)}>
          <h1>Widget layout</h1>
          <p className="confirm-copy">
            Move and resize this widget. You can also focus its header and use arrow keys to move,
            Alt + arrows to resize, and Shift for fine steps.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void dashboardStore
                .dispatch({
                  type: 'layout',
                  widgetId: widget.id,
                  expected: base,
                  value: {
                    position: { x: value.x, y: value.y },
                    size: { width: value.width, height: value.height },
                  },
                })
                .then(() => setOpen(false))
                .catch((e) => setError(e.message));
            }}
          >
            <div className="layout-fields">
              {(['x', 'y', 'width', 'height'] as const).map((key) => (
                <label key={key}>
                  {key}
                  <input
                    type="number"
                    required
                    step="any"
                    min={
                      key === 'width'
                        ? minimums[widget.type].width
                        : key === 'height'
                          ? minimums[widget.type].height
                          : 0
                    }
                    max={key === 'width' || key === 'height' ? 5000 : 100000}
                    value={value[key]}
                    onChange={(e) => setValue({ ...value, [key]: e.target.valueAsNumber })}
                  />
                </label>
              ))}
            </div>
            {error && <p role="alert">{error}</p>}
            <div className="confirm-actions">
              <button type="button" className="small" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="primary">Save layout</button>
            </div>
          </form>
        </Overlay>
      )}
    </>
  );
}
