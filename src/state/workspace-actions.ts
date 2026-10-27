import type { DashboardDocument, TimerContent, Reminder } from './model';
import {
  availablePosition,
  arrangeLayout,
  recoveredLayout,
  createWidget,
  gestureLayout,
  minimums,
  snapLayout,
} from '../dashboard/layout';
import type { CoreType, Layout, Viewport } from '../dashboard/layout';
import { remainingMs } from '../timing/time';
import { isAmbientNote, defaultWellbeingSettings } from './model';
export type WorkspaceAction =
  | {
      type: 'zoom';
      expected: number;
      value: number;
    }
  | {
      type: 'layout';
      widgetId: string;
      expected: Layout;
      value: Layout;
    }
  | {
      type: 'front';
      widgetId: string;
    }
  | {
      type: 'nudge';
      widgetId: string;
      dx: number;
      dy: number;
      resize: boolean;
      assisted?: boolean;
    }
  | {
      type: 'arrange';
      expected: {
        id: string;
        layout: Layout;
      }[];
      view: Viewport;
    }
  | {
      type: 'recoverLayout';
      view: Viewport;
    }
  | {
      type: 'createWidget';
      kind: CoreType;
      workspace?: 'ambient';
      id: string;
      view: Viewport;
    }
  | {
      type: 'timer';
      widgetId: string;
      expected: TimerContent;
      command: 'start' | 'pause' | 'resume' | 'reset' | 'next';
      sessionId: string;
      timeZone: string;
    }
  | {
      type: 'timerSettings';
      widgetId: string;
      expected: {
        workMinutes: number;
        breakMinutes: number;
      };
      value: {
        workMinutes: number;
        breakMinutes: number;
      };
    }
  | {
      type: 'upsertReminder';
      widgetId: string;
      expected: Reminder | null;
      value: Reminder;
    }
  | {
      type: 'deleteReminder';
      widgetId: string;
      expected: Reminder;
    };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function applyWorkspace(
  next: DashboardDocument,
  action: WorkspaceAction,
  now: number,
  conflict: (message?: string) => never,
): void {
  const expect = (a: unknown, b: unknown) => {
    if (!equal(a, b)) conflict();
  };
  const view = (v: Viewport) => {
    if (
      !Number.isFinite(v.width) ||
      !Number.isFinite(v.height) ||
      v.width < 100 ||
      v.height < 100 ||
      v.width > 100000 ||
      v.height > 100000
    )
      throw Error('Invalid workspace dimensions.');
  };
  const front = (id: string) => {
    const sorted = [...next.widgets].sort((a, b) => a.zIndex - b.zIndex);
    const w = sorted.find((w) => w.id === id);
    if (!w) conflict();
    for (const [i, item] of sorted.filter((w) => w.id !== id).entries()) item.zIndex = i;
    w!.zIndex = sorted.length - 1;
  };
  if (action.type === 'zoom') {
    expect(next.zoom, action.expected);
    next.zoom = action.value;
    return;
  }
  if (action.type === 'createWidget') {
    view(action.view);
    if (next.widgets.some((w) => w.id === action.id)) conflict();
    const w = createWidget(action.kind, action.id);
    if (w.type === 'wellbeing') next.wellbeingSettings ??= defaultWellbeingSettings();
    if (action.workspace !== undefined) {
      if (action.workspace !== 'ambient' || w.type !== 'sticky')
        throw Error('Invalid note workspace.');
      w.settings.workspace = action.workspace;
    }
    w.position = availablePosition(
      next.widgets.filter((item) => isAmbientNote(item) === isAmbientNote(w)),
      w.size,
      action.view,
    );
    next.widgets.push(w);
    front(w.id);
    return;
  }
  if (action.type === 'arrange') {
    view(action.view);
    expect(
      next.widgets.map((w) => ({ id: w.id, layout: { position: w.position, size: w.size } })),
      action.expected,
    );
    const visible = next.widgets.filter((w) => !isAmbientNote(w));
    const layouts = arrangeLayout(visible, action.view);
    visible.forEach((w, i) => {
      w.position = layouts[i].position;
    });
    return;
  }
  if (action.type === 'recoverLayout') {
    view(action.view);
    for (const w of next.widgets)
      if (!w.pinned && !isAmbientNote(w)) w.position = recoveredLayout(w, action.view).position;
    return;
  }
  const w = next.widgets.find((w) => w.id === action.widgetId);
  if (!w) return conflict();
  if (w.pinned && (action.type === 'nudge' || action.type === 'layout'))
    return conflict('This card is pinned. Unpin it before moving or resizing.');
  if (action.type === 'nudge') {
    const grid =
      action.assisted !== false && next.layoutAssistance?.snap ? next.layoutAssistance.gridSize : 0;
    const dx =
      grid && action.dx ? Math.sign(action.dx) * Math.max(grid, Math.abs(action.dx)) : action.dx;
    const dy =
      grid && action.dy ? Math.sign(action.dy) * Math.max(grid, Math.abs(action.dy)) : action.dy;
    const raw = gestureLayout(w, action.resize ? 'resize' : 'move', dx, dy, 1, w.type);
    const layout = grid ? snapLayout(raw, action.resize ? 'resize' : 'move', grid, w.type) : raw;
    w.position = layout.position;
    w.size = layout.size;
    front(w.id);
    return;
  }
  if (action.type === 'front') {
    front(w.id);
    return;
  }
  if (action.type === 'layout') {
    if (
      !equal(w.size, action.value.size) &&
      (action.value.size.width < minimums[w.type].width ||
        action.value.size.height < minimums[w.type].height)
    )
      throw Error('That size is below this widget’s minimum.');
    expect({ position: w.position, size: w.size }, action.expected);
    w.position = action.value.position;
    w.size = action.value.size;
    front(w.id);
    return;
  }
  if (action.type === 'timerSettings') {
    if (w.type !== 'pomodoro' || !['idle', 'finished'].includes(w.content.status))
      return conflict();
    expect(w.settings, action.expected);
    w.settings = action.value;
    if (w.content.status === 'idle')
      w.content.remainingMs =
        (w.content.phase === 'work' ? w.settings.workMinutes : w.settings.breakMinutes) * 60000;
    return;
  }
  if (action.type === 'timer') {
    if (w.type !== 'pomodoro') return conflict();
    const comparable = (t: TimerContent) => {
      const { delivery, ...rest } = t;
      void delivery;
      return rest;
    };
    expect(comparable(w.content), comparable(action.expected));
    const t = w.content;
    if (action.command === 'reset') {
      t.status = 'idle';
      t.deadline = null;
      t.sessionId = null;
      t.remainingMs =
        (t.phase === 'work' ? w.settings.workMinutes : w.settings.breakMinutes) * 60000;
      t.delivery = 'none';
      return;
    }
    if (action.command === 'pause') {
      if (t.status !== 'running' || remainingMs(t, now) <= 0) return conflict();
      t.remainingMs = remainingMs(t, now);
      t.status = 'paused';
      t.deadline = null;
      return;
    }
    if (action.command === 'resume') {
      if (t.status !== 'paused') return conflict();
      t.status = 'running';
      t.deadline = now + t.remainingMs;
      return;
    }
    if (action.command === 'next') {
      if (t.status !== 'finished') return conflict();
      t.phase = t.phase === 'work' ? 'break' : 'work';
      t.remainingMs =
        (t.phase === 'work' ? w.settings.workMinutes : w.settings.breakMinutes) * 60000;
    } else if (t.status !== 'idle') return conflict();
    t.status = 'running';
    t.sessionId = action.sessionId;
    t.timeZone = action.timeZone;
    t.deadline = now + t.remainingMs;
    t.delivery = 'none';
    return;
  }
  if (w.type !== 'reminder') return conflict();
  if (action.type === 'deleteReminder') {
    const i = w.content.reminders.findIndex((r) => r.id === action.expected.id);
    if (i < 0) return conflict();
    expect(w.content.reminders[i], action.expected);
    w.content.reminders.splice(i, 1);
    return;
  }
  const i = w.content.reminders.findIndex((r) => r.id === action.value.id);
  if (action.expected === null) {
    if (i >= 0) return conflict();
    w.content.reminders.push(action.value);
  } else {
    if (i < 0) return conflict();
    const fields = (r: Reminder) => ({
      id: r.id,
      eventId: r.eventId,
      message: r.message,
      dueAt: r.dueAt,
      timeZone: r.timeZone,
    });
    expect(fields(w.content.reminders[i]), fields(action.expected));
    w.content.reminders[i] = action.value;
  }
}
