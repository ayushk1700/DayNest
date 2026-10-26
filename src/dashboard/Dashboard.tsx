import { WorkspaceTools, LayoutAssistanceControls } from './WorkspaceTools';
import { BackupControls, ReplacementDialog } from './BackupControls';
import { AppearanceSection } from './AppearanceControls';
import { BackgroundControls, DashboardBackdrop } from './BackgroundControls';
import type { Replacement } from './BackupControls';
import { IconButton } from '../ui/IconButton';
import { useDrafts } from '../state/drafts';
import { THEMES, canonicalTheme } from '../state/model';
import { themePreviews } from '../ui/themePreviews';
import { useImageCleanup } from '../assets/lifecycle';
import { ZoomControl } from './ZoomControl';
import { NotificationSettings } from './NotificationSettings';
import { useViewport } from './useViewport';
import { useReconciliation } from '../timing/hooks';
import type { CoreType } from './layout';
import { dashboardStore } from '../state/store';
import { DraftRecovery } from './DraftRecovery';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import type { Name } from '../ui/Icon';
import { Overlay } from '../ui/Overlay';
import { DashboardWidgets } from '../widgets/DashboardWidgets';
import { useDashboard } from '../state/store';
import { StorageStatus } from './StorageStatus';
import { FullscreenButton } from './FullscreenButton';
import { MusicExperience } from '../music/MusicExperience';
import { AnimatePresence, motion } from 'motion/react';
const choices: [
    string,
    Name
][] = [['Clock', 'clock'], ['Habit Tracker', 'habit'], ['Pomodoro Timer', 'timer'], ['Reminder', 'reminder'], ['Notes', 'notes'], ['Todo List', 'todo'], ['Link Group', 'link'], ['Weather', 'weather'], ['Calendar', 'calendar'], ['Image', 'image'], ['Sticky Note', 'sticky'], ['Date', 'calendar'], ['Video', 'play'], ['Scratchpad', 'notes'], ['Wellbeing', 'habit']];
export function Dashboard() {
    const state = useDashboard();
    const drafts = useDrafts();
    const [review, setReview] = useState<Replacement | null>(null);
    useEffect(() => { document.documentElement.dataset.theme = state.document?.theme ?? 'Ocean Breeze'; }, [state.document?.theme]);
    useImageCleanup();
    useReconciliation();
    const { width, height } = useViewport();
    const [error, setError] = useState('');
    const view = () => ({ width: width / (width < 1100 ? 1 : state.document!.zoom), height: (height - 100) / (width < 1100 ? 1 : state.document!.zoom), top: 84 / (width < 1100 ? 1 : state.document!.zoom) });
    function create(kind: CoreType) { const id = crypto.randomUUID(); void dashboardStore.dispatch({ type: 'createWidget', kind, id, view: view() }).then(() => { setOverlay(null); setTimeout(() => document.querySelector(`[data-widget-id="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 50); }).catch(e => setError(e.message)); }
    const [overlay, setOverlay] = useState<'settings' | 'picker' | null>(null);
    const [musicOpen, setMusicOpen] = useState(false);
    const close = useCallback(() => setOverlay(null), []);
    const historyDisabled = state.pending > 0 || drafts.length > 0 || state.status !== 'ready';
    function travel(direction: 'undo' | 'redo') { void dashboardStore.travel(direction).catch(e => setError(e.message)); }
    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            if (event.defaultPrevented || overlay || review || historyDisabled || event.altKey || !(event.ctrlKey || event.metaKey) || (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]'))) return;
            const direction = event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey) ? 'redo' : event.key.toLowerCase() === 'z' ? 'undo' : null;
            if (!direction) return;
            event.preventDefault(); travel(direction);
        };
        addEventListener('keydown', key); return () => removeEventListener('keydown', key);
    }, [overlay, review, historyDisabled]);
    const closeReview = () => { setReview(null); setOverlay('settings'); };
    const reviewBackup = (value: Replacement) => { setOverlay(null); setReview(value); };
    return <main className="dashboard" aria-label="DayNest dashboard">{state.document && <DashboardBackdrop background={state.document.background}/>}<div inert={overlay !== null || review !== null}>
 <header className="toolbar" aria-label="DayNest shortcuts"><motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} className="music-toggle" aria-label={musicOpen ? 'Close music player' : 'Open music player'} title={musicOpen ? 'Close music player' : 'Music'} aria-expanded={musicOpen} onClick={() => setMusicOpen(value => !value)}><Icon name="music"/><span className="visually-hidden">Music</span></motion.button><a className="pdf-studio-launch" href="./pdf.html" target="_blank" rel="noreferrer" aria-label="Open PDF Studio" title="PDF Studio"><Icon name="notes"/><span className="visually-hidden">PDF Studio</span></a><IconButton icon="settings" className="settings-toggle" label="Open Settings" onClick={() => setOverlay('settings')}/></header><AnimatePresence initial={false}>{musicOpen && <motion.div key="music-popover" className="music-popover" initial={{ opacity: 0, y: -8, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5, scale: 0.99 }} transition={{ duration: 0.18 }}><MusicExperience/></motion.div>}</AnimatePresence>
 <div className="workspace-tools"><IconButton icon="arrange" label="Arrange Widgets" disabled={!state.document || width < 1100} onClick={() => { if (!state.document)
        return; void dashboardStore.dispatch({ type: 'arrange', expected: state.document.widgets.map(w => ({ id: w.id, layout: { position: w.position, size: w.size } })), view: view() }).then(() => document.querySelector('.workspace-viewport')?.scrollTo(0, 0)).catch(e => setError(e.message)); }}/><FullscreenButton onError={setError}/></div>{error && <p className="workspace-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></p>}<StorageStatus /><DraftRecovery /><WorkspaceTools/>{state.document && <DashboardWidgets widgets={state.document.widgets}/>}
 <div className="history"><IconButton icon="undo" label="Undo" disabled={historyDisabled || !state.canUndo} onClick={() => travel('undo')}/><IconButton icon="redo" label="Redo" disabled={historyDisabled || !state.canRedo} onClick={() => travel('redo')}/></div><p className="preview-label">Local workspace · Drag headers to arrange</p><button className="floating-add" aria-label="Add Widget" title="Add Widget" aria-haspopup="dialog" aria-expanded={overlay === 'picker'} onClick={() => setOverlay('picker')}><Icon name="plus"/><span className="paw-easter" aria-hidden="true"><i/><i/><i/><i/><b/></span></button></div>
 <AnimatePresence initial={false}>{overlay === 'settings' && <Overlay key="settings" modal label="Settings" onClose={close}><h1>Settings</h1><button className="close" aria-label="Close Settings" onClick={close}><Icon name="close"/></button><section className="themes"><h2>Recommended full themes</h2><div className="theme-options">{THEMES.map(name => <div className="theme-option" key={name}><motion.button type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} disabled={state.pending > 0 || !state.document} onClick={() => { void dashboardStore.dispatch({ type: 'theme', expected: state.document!.theme, value: name }).catch(e => setError(e.message)); }} className={`swatch ${state.document && canonicalTheme(state.document.theme) === name ? 'selected' : ''}`} style={{ background: themePreviews[name] }} aria-label={name} aria-pressed={!!state.document && canonicalTheme(state.document.theme) === name}>{state.document && canonicalTheme(state.document.theme) === name && <span className="theme-check"><Icon name="check"/></span>}</motion.button><span>{name}</span></div>)}</div></section>{state.document && <ZoomControl value={state.document.zoom}/>}{state.document && <AppearanceSection/>}{state.document && <LayoutAssistanceControls/>}{state.document && <BackgroundControls/>}<section className="workspace-settings"><h2>Workspace</h2><IconButton icon="recover" caption="Recover widgets" label="Recover widgets" disabled={!state.document || state.pending > 0 || width < 1100} onClick={() => { setError(''); void dashboardStore.dispatch({ type: 'recoverLayout', view: view() }).then(() => { close(); document.querySelector('.workspace-viewport')?.scrollTo(0, 0); }).catch(e => setError(e.message)); }}/><p>Bring off-screen cards back into view. Pinned cards stay in place.</p>{error && <p role="alert">{error}</p>}</section><BackupControls onReview={reviewBackup}/><NotificationSettings /><p className="settings-note">History keeps up to 50 actions in this tab until you reload. Timer delivery and live ticks stay outside history.</p><p className="icon-credit">Uicons by <a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">Flaticon</a></p></Overlay>}</AnimatePresence>
 {review && <ReplacementDialog review={review} onClose={closeReview}/>}
 <AnimatePresence initial={false}>{overlay === 'picker' && <Overlay key="picker" label="Add Widget" onClose={close}><div className="picker-heading"><h2>Add Widget</h2></div><div className="picker-items">{choices.map(([name, icon]) => <motion.button key={name} disabled={!state.document} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => create(({ 'Scratchpad': 'scratchpad', 'Wellbeing': 'wellbeing', 'Video': 'video', 'Date': 'date', 'Clock': 'clock', 'Habit Tracker': 'habit', 'Weather': 'weather', 'Calendar': 'calendar', 'Image': 'image', 'Pomodoro Timer': 'pomodoro', 'Reminder': 'reminder', 'Notes': 'notes', 'Todo List': 'todo', 'Sticky Note': 'sticky', 'Link Group': 'linkGroup' } as Record<string, CoreType>)[name])} className="picker-item"><span className={`picker-item-icon picker-icon-${icon}`} aria-hidden="true"><Icon name={icon}/></span><span>{name}</span></motion.button>)}</div>{error && <p role="alert">{error}</p>}<p className="picker-note">Photos and videos stay on this device. Weather uses your city with Open-Meteo.</p><motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} className="picker-close" aria-label="Close Add Widget" onClick={close}><Icon name="close"/></motion.button></Overlay>}</AnimatePresence>
 </main>;
}

