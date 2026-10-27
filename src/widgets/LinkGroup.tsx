import { useState } from 'react';
import type { FormEvent } from 'react';
import type { LinkShortcut, LinkShortcutColor, LinkShortcutIcon, Widget } from '../state/model';
import { LINK_SHORTCUT_COLORS, LINK_SHORTCUT_ICONS } from '../state/model';
import { dashboardStore } from '../state/store';
import { Icon } from '../ui/Icon';
import type { Name } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Overlay } from '../ui/Overlay';
import { WidgetHeader } from './WidgetHeader';
import { normalizeShortcutUrl } from '../state/linkShortcuts';

const MAX_SHORTCUTS = 18;
const iconLabels: Record<LinkShortcutIcon, string> = {
  link: 'Link',
  search: 'Search',
  music: 'Music',
  calendar: 'Calendar',
  notes: 'Notes',
  todo: 'Tasks',
  weather: 'Weather',
  image: 'Photos',
  timer: 'Focus',
  habit: 'Habits',
  external: 'Website',
  location: 'Places',
};
const colorLabels: Record<LinkShortcutColor, string> = {
  coral: 'Coral',
  amber: 'Amber',
  sage: 'Sage',
  sky: 'Sky',
  lavender: 'Lavender',
  rose: 'Rose',
};

export function LinkGroup({ widget }: { widget: Extract<Widget, { type: 'linkGroup' }> }) {
  const [editing, setEditing] = useState<LinkShortcut | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState<LinkShortcutIcon>('link');
  const [color, setColor] = useState<LinkShortcutColor>('sky');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditing(null);
    setTitle('');
    setUrl('');
    setIcon('link');
    setColor('sky');
    setError('');
    setFormOpen(true);
  }
  function openEdit(link: LinkShortcut) {
    setEditing(link);
    setTitle(link.title);
    setUrl(link.url);
    setIcon(link.icon);
    setColor(link.color);
    setError('');
    setFormOpen(true);
  }
  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setError('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > 50) {
      setError('Give this shortcut a name up to 50 characters.');
      return;
    }
    let normalized: string;
    try {
      normalized = normalizeShortcutUrl(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enter a valid website address.');
      return;
    }
    const value: LinkShortcut = {
      id: editing?.id ?? crypto.randomUUID(),
      title: trimmed,
      url: normalized,
      icon,
      color,
    };
    setSaving(true);
    setError('');
    try {
      await dashboardStore.dispatch({
        type: 'linkShortcutUpsert',
        widgetId: widget.id,
        expected: editing,
        value,
      });
      setFormOpen(false);
      setEditing(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this shortcut.');
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!editing || saving) return;
    setSaving(true);
    setError('');
    try {
      await dashboardStore.dispatch({
        type: 'linkShortcutDelete',
        widgetId: widget.id,
        expected: editing,
      });
      setFormOpen(false);
      setEditing(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove this shortcut.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="widget link-group-card" aria-label={widget.title || 'Quick Links'}>
      <WidgetHeader widget={widget} />
      <div className="link-group-intro">
        <p>
          {widget.content.links.length
            ? 'Your favorite places, all together.'
            : 'A little home for your favorite places.'}
        </p>
        {widget.content.links.length > 0 && (
          <span>
            {widget.content.links.length} / {MAX_SHORTCUTS}
          </span>
        )}
      </div>
      <div className="shortcut-grid" aria-label="Saved shortcuts">
        {widget.content.links.map((link) => (
          <div className="shortcut-tile" key={link.id}>
            <a
              className="shortcut-open"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${link.title}`}
              title={link.title}
            >
              <span className={`shortcut-icon-tile shortcut-color-${link.color}`}>
                <Icon name={link.icon as Name} />
              </span>
              <span className="shortcut-title">{link.title}</span>
            </a>
            <button
              className="shortcut-edit"
              type="button"
              aria-label={`Edit ${link.title}`}
              title={`Edit ${link.title}`}
              onClick={() => openEdit(link)}
            >
              <Icon name="pencil" />
            </button>
          </div>
        ))}
        {widget.content.links.length < MAX_SHORTCUTS && (
          <button className="shortcut-add" type="button" onClick={openAdd}>
            <span>
              <Icon name="plus" />
            </span>
            <span>{widget.content.links.length ? 'Add shortcut' : 'Add your first shortcut'}</span>
          </button>
        )}
      </div>
      {formOpen && (
        <Overlay
          modal
          label={editing ? `Edit ${editing.title}` : 'Add a shortcut'}
          onClose={closeForm}
        >
          <h1>{editing ? 'Edit shortcut' : 'Add a shortcut'}</h1>
          <IconButton
            icon="close"
            className="close"
            label="Close shortcut editor"
            onClick={closeForm}
          />
          <form className="link-shortcut-form" onSubmit={(event) => void save(event)}>
            <label>
              Shortcut name
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={50}
                placeholder="Example: Design board"
                required
              />
            </label>
            <label>
              Website address
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                maxLength={2048}
                placeholder="example.com"
                required
              />
              <span>Web links open in a new tab. If you leave off https://, we’ll add it.</span>
            </label>
            <fieldset>
              <legend>Choose an icon</legend>
              <div className="shortcut-icon-options">
                {LINK_SHORTCUT_ICONS.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={icon === option ? 'selected' : ''}
                    aria-label={iconLabels[option]}
                    aria-pressed={icon === option}
                    onClick={() => setIcon(option)}
                  >
                    <Icon name={option as Name} />
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Tile color</legend>
              <div className="shortcut-color-options">
                {LINK_SHORTCUT_COLORS.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={`shortcut-color-dot shortcut-color-${option} ${color === option ? 'selected' : ''}`}
                    aria-label={colorLabels[option]}
                    aria-pressed={color === option}
                    onClick={() => setColor(option)}
                  />
                ))}
              </div>
            </fieldset>
            {error && (
              <p className="link-form-error" role="alert">
                {error}
              </p>
            )}
            <div className="link-form-actions">
              {editing && (
                <button
                  className="small link-remove"
                  type="button"
                  disabled={saving}
                  onClick={() => void remove()}
                >
                  <Icon name="trash" />
                  Remove
                </button>
              )}
              <button className="primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add shortcut'}
              </button>
            </div>
          </form>
        </Overlay>
      )}
    </section>
  );
}
