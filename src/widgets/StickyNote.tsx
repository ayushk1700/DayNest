import type { Widget } from '../state/model';
import { dashboardStore } from '../state/store';
import { DraftField } from '../ui/DraftField';
import { WidgetHeader } from './WidgetHeader';

/** Shared sticky note for the dashboard and Ambient workspace. */
export function StickyNote({ widget }: { widget: Extract<Widget, { type: 'sticky' }> }) {
  return (
    <aside
      className={`sticky sticky-${widget.settings.color}`}
      aria-label={widget.title || 'Sticky Note'}
    >
      <span className="sticky-paper" aria-hidden="true" />
      <WidgetHeader widget={widget} />
      <DraftField
        multiline
        maxLength={20000}
        label="Sticky note text"
        value={widget.content.text}
        placeholder="A little reminder…"
        onSave={(expected, value) =>
          dashboardStore.dispatch({ type: 'text', widgetId: widget.id, expected, value })
        }
      />
    </aside>
  );
}
