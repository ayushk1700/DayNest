import { safeReplacement } from '../persistence/restoration';
import { useEffect, useRef, useState } from 'react';
import type { DashboardDocument } from '../state/model';
import { seedDashboard } from '../state/model';
import { dashboardStore, useDashboard } from '../state/store';
import { useDrafts } from '../state/drafts';
import { downloadBackup, exportBackup, inspectBackup, MAX_BACKUP_BYTES, stageBackup } from '../persistence/backup';
import type { Backup } from '../persistence/backup';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Overlay } from '../ui/Overlay';

export interface Replacement { kind: 'import' | 'reset' | 'recovery'; expected: DashboardDocument; backup?: Backup; }
export function BackupControls({ onReview }: { onReview: (review: Replacement) => void }) {
    const state = useDashboard(), drafts = useDrafts();
    const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    const input = useRef<HTMLInputElement>(null), active = useRef(true);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const disabled = busy || state.status !== 'ready' || state.pending > 0 || drafts.length > 0 || !state.document;
    async function run(operation: () => Promise<void>) {
        setBusy(true); setMessage('');
        try { await operation(); } catch (e) { if (active.current) setMessage(e instanceof Error ? e.message : 'The operation failed. Your dashboard was kept.'); }
        finally { if (active.current) setBusy(false); }
    }
    return <section className="data"><h2>Dashboard Data</h2><div className="data-actions">
        <button className="small" disabled={disabled} onClick={() => { void run(async () => { const backup = await exportBackup(state.document!); if (active.current) { downloadBackup(backup); setMessage('Backup downloaded with photos, videos and background.'); } }); }}><Icon name="download"/>Export JSON</button>
        <button className="small" disabled={disabled} onClick={() => input.current?.click()}><Icon name="upload"/>Import JSON</button>
    </div><input ref={input} hidden type="file" aria-label="Import dashboard backup file" accept=".json,application/json" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        const expected = structuredClone(dashboardStore.getSnapshot().document!);
        void run(async () => {
            if (!/\.json$/i.test(file.name) || (file.type && !['application/json', 'text/json', 'text/plain'].includes(file.type))) throw Error('Choose a JSON backup file.');
            if (file.size > MAX_BACKUP_BYTES) throw Error('Choose a backup up to 50 MiB.');
            const backup = await inspectBackup(await file.text());
            if (active.current) onReview({ kind: 'import', expected, backup });
        });
    }}/><p>Save a portable backup including photos, videos and the background, or preview a JSON backup before replacing this dashboard. Maximum 50 MiB.</p>
    <button className="small recovery-button" disabled={disabled} onClick={() => { void run(async () => {
        const expected = structuredClone(dashboardStore.getSnapshot().document!);
        const previous = await dashboardStore.previous();
        if (!previous) throw Error('No previous dashboard is saved yet. Import and reset create a recovery copy.');
        const backup = await exportBackup(previous);
        if (active.current) onReview({ kind: 'recovery', expected, backup });
    }); }}><Icon name="recover"/>Restore previous dashboard</button>
    <button className="small reset-dashboard" disabled={disabled} onClick={() => onReview({ kind: 'reset', expected: structuredClone(dashboardStore.getSnapshot().document!) })}><Icon name="reset"/>Reset Dashboard</button>
    {drafts.length > 0 && <p role="status">Finish saving or download your unsaved drafts before backup, history, or replacement.</p>}
    {busy && <p role="status">Preparing your backup…</p>}{message && <p role="status">{message}</p>}</section>;
}
export function ReplacementDialog({ review, onClose }: { review: Replacement; onClose: () => void }) {
    const drafts = useDrafts();
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const title = review.kind === 'reset' ? 'Reset dashboard' : review.kind === 'import' ? 'Import backup' : 'Restore previous dashboard';
    const preview = review.backup?.dashboard ?? seedDashboard();
    const close = () => { if (!busy) onClose(); };
    return <Overlay modal label={title} onClose={close}><h1>{title}?</h1><IconButton icon="close" label={`Close ${title}`} className="close" disabled={busy} onClick={close}/>
        <p className="confirm-copy">{review.kind === 'reset' ? 'Replace every widget, task, note, photo/video placement, timer, reminder, habit, and calendar event with the sample dashboard. Background, card styles and pins return to defaults. Theme and zoom return to Ocean Breeze and 100%.' : 'Replace the current content, layout, background, card styles, pins, theme, and zoom with this backup.'} A recovery copy of the current dashboard is saved first. Browser notification permission stays as it is. Undo history is cleared.</p>
        <div className="backup-preview"><strong>{preview.widgets.length} widgets · {preview.theme} · {Math.round(preview.zoom * 100)}%</strong><p>{review.backup?.images.length ?? 0} media files included · {preview.widgets.filter(w => w.pinned).length} pinned cards</p><ul>{preview.widgets.map(w => <li key={w.id}>{w.title || 'Untitled widget'} <span>({w.type}{w.pinned ? ', pinned' : ''})</span></li>)}</ul></div>
        {review.kind !== 'reset' && <p className="confirm-copy">Restored running timers are paused. Past reminders stay visible without replaying old notifications. Wellbeing recording is paused; previously saved intervals are retained, and in-progress intervals are not replayed.</p>}
        {drafts.length > 0 && <p role="alert">Save or download your unsaved drafts first.</p>}{error && <p role="alert" className="local-error">{error}</p>}
        <div className="confirm-actions"><button className="small" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy || drafts.length > 0} onClick={() => {
            setBusy(true); setError('');
            void (async () => {
                const replacement = review.backup ? safeReplacement(await stageBackup(review.backup)) : seedDashboard();
                await dashboardStore.replace(review.expected, replacement);
                onClose();
            })().catch(e => setError(e instanceof Error ? e.message + ' Close this preview and reopen it to use the latest saved dashboard.' : 'Replacement failed. Your dashboard was kept.')).finally(() => setBusy(false));
        }}>{busy ? 'Saving…' : review.kind === 'reset' ? 'Back up and reset' : 'Back up and replace'}</button></div></Overlay>;
}
