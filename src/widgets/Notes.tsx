import type { ReactNode } from 'react';
import type { Widget } from '../state/model';
import { noteSkin } from '../state/model';
import { dashboardStore } from '../state/store';
import { DraftField } from '../ui/DraftField';
import { WidgetSkinControls } from './WidgetSkinControls';

export function Notes({
  widget,
  header,
}: {
  widget: Extract<Widget, { type: 'notes' }>;
  header: ReactNode;
}) {
  return (
    <section
      className={`widget notes-card paper-${noteSkin(widget.settings)}`}
      aria-label={widget.title || 'Notes'}
    >
      {header}
      <div className="notebook">
        <DraftField
          multiline
          label="Notes text"
          value={widget.content.text}
          placeholder="Write something here…"
          onSave={(expected, value) =>
            dashboardStore.dispatch({ type: 'text', widgetId: widget.id, expected, value })
          }
        />
      </div>
      <WidgetSkinControls widget={widget} />
    </section>
  );
}
