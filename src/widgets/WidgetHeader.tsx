import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { Widget } from '../state/model';
import { dashboardStore, useDashboard } from '../state/store';
import { defaultPresentation } from '../state/model';
import { useWorkspaceTools, workspaceTools } from '../state/workspace-tools';
import { appearanceSnapshot } from '../ui/appearanceSnapshot';
import { LayoutControl } from '../dashboard/LayoutControl';
import { AppearanceControls } from '../dashboard/AppearanceControls';
import { IconButton } from '../ui/IconButton';
import { WidgetMenu } from '../ui/WidgetMenu';
import { Overlay } from '../ui/Overlay';
import { DraftField } from '../ui/DraftField';
import { WidgetSkinControls } from './WidgetSkinControls';
export function WidgetHeader({
  widget,
  leading,
  subtitle,
  tools: headerTools,
}: {
  leading?: ReactNode;
  subtitle?: ReactNode;
  tools?: ReactNode;
  widget: Widget;
}) {
  const [rename, setRename] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(widget);
  const [error, setError] = useState('');
  const state = useDashboard(),
    tools = useWorkspaceTools();
  const presentation = widget.presentation ?? defaultPresentation();
  useEffect(() => {
    if (rename)
      Array.from(
        document.querySelectorAll<HTMLInputElement>(
          `[data-widget-id="${widget.id}"] .rename-editor input`,
        ),
      )
        .find((input) => !input.closest('[inert]'))
        ?.focus();
  }, [rename, widget.id]);
  return (
    <>
      <div
        className="widget-heading"
        tabIndex={0}
        role="group"
        aria-label={
          widget.pinned
            ? `Pinned ${widget.title || widget.type}; unpin in card menu to move or resize`
            : `Move ${widget.title || widget.type}; arrows move, Alt arrows resize`
        }
      >
        {leading}
        {subtitle ? (
          <div className="insight-heading-copy">
            <h2>{widget.title || 'Untitled widget'}</h2>
            {subtitle}
          </div>
        ) : (
          <h2>{widget.title || 'Untitled widget'}</h2>
        )}
        {headerTools}
        <WidgetMenu title={widget.title || widget.type}>
          <div className="card-menu-group">
            <LayoutControl widget={widget} />
            <IconButton
              icon="customize"
              caption="Customize"
              label={`Customize ${widget.title || widget.type}`}
              onClick={() => setCustomizing(true)}
            />
          </div>
          {tools.advanced && (
            <>
              <div className="card-menu-group">
                <IconButton
                  icon="customize"
                  caption="Copy appearance"
                  label={`Copy appearance of ${widget.title || widget.type}`}
                  onClick={() => {
                    const frame = Array.from(
                      document.querySelectorAll<HTMLElement>(`[data-widget-id="${widget.id}"]`),
                    ).find((el) => !el.closest('[inert]'));
                    const card = frame?.querySelector<HTMLElement>('.widget,.sticky');
                    if (card && state.document) {
                      workspaceTools.update({
                        copied: appearanceSnapshot(state.document, widget, card),
                        message: 'Appearance copied. Paste it onto another widget.',
                      });
                    }
                  }}
                />
                <IconButton
                  icon="customize"
                  caption="Paste appearance"
                  label={`Paste appearance onto ${widget.title || widget.type}`}
                  disabled={!tools.copied}
                  onClick={() => {
                    if (!tools.copied) return;
                    void dashboardStore
                      .dispatch({
                        type: 'appearanceBatch',
                        targets: [{ id: widget.id, expected: widget.appearance }],
                        patch: structuredClone(tools.copied),
                      })
                      .then(() =>
                        workspaceTools.update({
                          message: 'Appearance pasted. Content and layout kept.',
                        }),
                      )
                      .catch((e) => setError(e.message));
                  }}
                />
              </div>
              <div className="card-menu-group">
                <label className="presentation-control">
                  Presentation
                  <select
                    aria-label={`Presentation for ${widget.title || widget.type}`}
                    value={presentation.mode}
                    onChange={(e) => {
                      void dashboardStore
                        .dispatch({
                          type: 'presentation',
                          widgetId: widget.id,
                          expected: presentation,
                          value: {
                            ...presentation,
                            mode: e.target.value as typeof presentation.mode,
                          },
                        })
                        .catch((e) => setError(e.message));
                    }}
                  >
                    <option value="full">Full</option>
                    <option value="compact">Compact</option>
                    <option value="content-only">Content only</option>
                  </select>
                </label>
                <IconButton
                  icon="layout"
                  caption={presentation.collapsed ? 'Expand' : 'Collapse'}
                  label={`${presentation.collapsed ? 'Expand' : 'Collapse'} ${widget.title || widget.type}`}
                  onClick={() => {
                    void dashboardStore
                      .dispatch({
                        type: 'presentation',
                        widgetId: widget.id,
                        expected: presentation,
                        value: { ...presentation, collapsed: !presentation.collapsed },
                      })
                      .catch((e) => setError(e.message));
                  }}
                />
              </div>
            </>
          )}
          <div className="card-menu-group">
            <IconButton
              icon="pin"
              caption={widget.pinned ? 'Unpin' : 'Pin in place'}
              label={`${widget.pinned ? 'Unpin' : 'Pin'} ${widget.title || widget.type}`}
              aria-pressed={widget.pinned}
              onClick={() => {
                setError('');
                void dashboardStore
                  .dispatch({
                    type: 'pin',
                    widgetId: widget.id,
                    expected: widget.pinned,
                    value: !widget.pinned,
                  })
                  .catch((e) => setError(e.message));
              }}
            />
            <IconButton
              icon="pencil"
              caption="Rename"
              label={`Rename ${widget.title || widget.type}`}
              aria-expanded={rename}
              onClick={() => setRename(!rename)}
            />
          </div>
          <div className="card-menu-group card-menu-danger">
            <IconButton
              icon="trash"
              caption="Delete"
              destructive
              label={`Delete ${widget.title || widget.type}`}
              onClick={() => {
                setDeleteTarget(structuredClone(widget));
                setDeleting(true);
              }}
            />
          </div>
        </WidgetMenu>
      </div>
      {customizing && (
        <Overlay modal label="Customize card" onClose={() => setCustomizing(false)}>
          <h1>Customize {widget.title || 'card'}</h1>
          <IconButton
            icon="close"
            className="close"
            label="Close card customization"
            onClick={() => setCustomizing(false)}
          />
          <WidgetSkinControls widget={widget} customization />
          <AppearanceControls
            widgetId={widget.id}
            onSaved={() => setCustomizing(false)}
            onCancel={() => setCustomizing(false)}
          />
        </Overlay>
      )}
      {error && !deleting && (
        <p className="header-action-error" role="alert">
          {error}
          <button onClick={() => setError('')}>Dismiss</button>
        </p>
      )}
      {rename && (
        <div className="rename-editor">
          <DraftField
            label={`Title for ${widget.type}`}
            value={widget.title}
            maxLength={200}
            onSave={(expected, value) =>
              dashboardStore.dispatch({ type: 'rename', widgetId: widget.id, expected, value })
            }
          />
        </div>
      )}
      {deleting && (
        <Overlay modal label="Delete widget" onClose={() => setDeleting(false)}>
          <h1>Delete {widget.title || 'widget'}?</h1>
          <p className="confirm-copy">
            This removes this widget, all its content and any unsaved drafts. You can restore it
            with Undo.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="confirm-actions">
            <button className="small" onClick={() => setDeleting(false)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() => {
                void dashboardStore
                  .dispatch({ type: 'deleteWidget', widgetId: widget.id, expected: deleteTarget })
                  .catch((reason) => setError(String(reason.message)));
              }}
            >
              Delete widget
            </button>
          </div>
        </Overlay>
      )}
    </>
  );
}
