import { WidgetHeader } from './WidgetHeader';
import { StickyNote } from './StickyNote';
import { isAmbientNote } from '../state/model';
import { Clock } from './Clock';
import { Notes } from './Notes';
import { DateWidget } from './DateWidget';
import { HabitTracker } from './HabitTracker';
import { Calendar } from './Calendar';
import { ImageWidget } from './ImageWidget';
import { Weather } from './Weather';

import { WidgetFrame } from '../dashboard/WidgetFrame';
import { Pomodoro } from './Pomodoro';
import { Reminders } from './Reminders';
import { useViewport } from '../dashboard/useViewport';
import { useDashboard } from '../state/store';
import { useEffect, useState } from 'react';
import { IconButton } from '../ui/IconButton';


import { Icon } from '../ui/Icon';
import { Overlay } from '../ui/Overlay';
import { DraftField } from '../ui/DraftField';
import { dashboardStore } from '../state/store';
import type { Widget, Task } from '../state/model';
import type { Action } from '../state/actions';
import type { ReactNode } from 'react';
function Todo({ widget }: {
    widget: Extract<Widget, {
        type: 'todo';
    }>;
}) {
    const [task, setTask] = useState('');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [clearing, setClearing] = useState(false);
    const [clearSnapshot, setClearSnapshot] = useState<Task[]>([]);
    async function run(action: Action) {
        setError('');
        try {
            await dashboardStore.dispatch(action);
            return true;
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not save.');
            return false;
        }
    }
    return <section className="widget todo-card" aria-label={widget.title || 'Todo List'}>
    <WidgetHeader widget={widget}/><p className="count">{widget.content.tasks.filter(t => t.completed).length} of {widget.content.tasks.length} completed</p>
    <form className="task-entry" onSubmit={event => {
            event.preventDefault();
            const input = event.currentTarget.querySelector('input');
            if (!task.trim() || pending)
                return;
            setPending(true);
            void run({ type: 'addTask', widgetId: widget.id, task: { id: crypto.randomUUID(), text: task.trim(), completed: false } }).then(ok => {
                if (ok) {
                    setTask('');
                    input?.focus();
                }
            }).finally(() => setPending(false));
        }}>
      <input aria-label="New task" placeholder="Add a new task..." value={task} maxLength={20000} onChange={e => setTask(e.target.value)} readOnly={pending}/><button type="submit" disabled={!task.trim() || pending} aria-label="Add task"><Icon name="plus"/></button>
    </form>
    <div className="task-list">{widget.content.tasks.length === 0 && <p className="empty-copy">A fresh start. Add your first task above.</p>}{widget.content.tasks.map(t => <TaskRow key={t.id} task={t} widgetId={widget.id} run={run}/>)}</div>
    {error && <p className="task-error" role="alert">{error}</p>}
    <button className="small todo-reset" disabled={!widget.content.tasks.length} onClick={() => { setClearSnapshot(structuredClone(widget.content.tasks)); setClearing(true); }}><Icon name="trash"/>Clear all tasks</button>
    {clearing && <Overlay modal label="Clear all tasks" onClose={() => setClearing(false)}><h1>Clear all tasks?</h1><p className="confirm-copy">Delete all {clearSnapshot.length} tasks, including completed tasks, from this list. You can restore these tasks with Undo.</p>{error && <p role="alert">{error}</p>}<div className="confirm-actions"><button className="small" onClick={() => setClearing(false)}>Cancel</button><button className="primary" onClick={() => {
                void run({ type: 'clearTasks', widgetId: widget.id, expected: clearSnapshot }).then(ok => {
                    if (ok)
                        setClearing(false);
                });
            }}>Delete all tasks</button></div></Overlay>}
  </section>;
}
function TaskRow({ task, widgetId, run }: {
    task: Task;
    widgetId: string;
    run: (action: Action) => Promise<boolean>;
}) {
    const [editing, setEditing] = useState(false);
    const [checked, setChecked] = useState(task.completed);
    const [toggling, setToggling] = useState(false);
    useEffect(() => {
        if (!toggling)
            setChecked(task.completed);
    }, [task.completed, toggling]);
    return <div className={`task-row ${checked ? 'completed' : ''}`}>
    <label><input type="checkbox" checked={checked} disabled={toggling} onChange={event => {
            const next = event.target.checked;
            setChecked(next);
            setToggling(true);
            void run({ type: 'toggleTask', widgetId, taskId: task.id, expected: task.completed, value: next }).then(ok => {
                if (!ok)
                    setChecked(task.completed);
            }).finally(() => setToggling(false));
        }} aria-label={`Complete ${task.text}`}/>{!editing && <span>{task.text}</span>}</label>
    <div className="task-editor" hidden={!editing}><DraftField label="Edit task" value={task.text} required multiline maxLength={20000} onSave={(expected, value) => dashboardStore.dispatch({ type: 'editTask', widgetId, taskId: task.id, expected, value })}/></div>
    <div className="task-actions"><IconButton icon={editing ? "check" : "pencil"} label={`Edit task: ${task.text}`} title={editing ? "Finish editing" : "Edit task"} aria-expanded={editing} onClick={() => setEditing(!editing)}/><IconButton icon="trash" destructive label={`Delete task: ${task.text}`} onClick={() => { void run({ type: 'deleteTask', widgetId, taskId: task.id, expected: task }); }}/></div>
  </div>;
}
export function DashboardWidgets({ widgets }: {
    widgets: Widget[];
}) {
    const { width, height } = useViewport();
    widgets = widgets.filter(widget => !isAmbientNote(widget));
    const state = useDashboard();
    const narrow = width < 1100;
    const zoom = narrow ? 1 : state.document?.zoom ?? 1;
    const canvasWidth = Math.max(width / zoom, ...widgets.map(w => w.position.x + w.size.width + 40));
    const canvasHeight = Math.max(height / zoom, ...widgets.map(w => w.position.y + w.size.height + 140));

    return <div className={`workspace-viewport ${narrow ? 'narrow-workspace' : ''}`}><div className="canvas-plane" style={narrow ? undefined : { width: canvasWidth * zoom, height: canvasHeight * zoom }}><div className="workspace" aria-label="Dashboard widgets" style={narrow ? undefined : { width: canvasWidth, height: canvasHeight, transform: `scale(${zoom})` }}>{widgets.length ? widgets.map(widget => <WidgetFrame key={widget.id} widget={widget} zoom={zoom} narrow={narrow}>{<WidgetContent widget={widget}/>}</WidgetFrame>) : <p className="empty-dashboard">Your dashboard is empty. Use the plus button to add a widget. Your empty layout is saved.</p>}</div></div></div>;
}

export function WidgetContent({ widget }: { widget: Widget }): ReactNode {
        if (widget.type === 'date')
            return <DateWidget widget={widget} header={<WidgetHeader widget={widget}/>}/>;
        if (widget.type === 'todo')
            return <Todo key={widget.id} widget={widget}/>;
        if (widget.type === 'notes')
            return <Notes widget={widget} header={<WidgetHeader widget={widget}/>}/>;
        if (widget.type === 'sticky')
            return <StickyNote widget={widget}/>;
        if (widget.type === 'pomodoro')
            return <Pomodoro widget={widget} header={<WidgetHeader widget={widget}/>}/>;
        if (widget.type === 'reminder')
            return <Reminders widget={widget} header={<WidgetHeader widget={widget}/>}/>;
        if (widget.type === 'clock')
            return <Clock widget={widget} header={<WidgetHeader widget={widget}/>}/>;
        if (widget.type === 'habit')
            return <HabitTracker widget={widget} header={<WidgetHeader widget={widget}/>}/>;
        if (widget.type === 'calendar')
            return <Calendar widget={widget} header={<WidgetHeader widget={widget}/>}/>;
        if (widget.type === 'image' || widget.type === 'video')
            return <ImageWidget widget={widget} header={<WidgetHeader widget={widget}/>}/>;
        if (widget.type === 'weather')
            return <Weather widget={widget} header={<WidgetHeader widget={widget}/>}/>;
        return null;
}
