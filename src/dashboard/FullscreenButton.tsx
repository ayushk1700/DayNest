import { useEffect, useState } from 'react';

export function FullscreenButton({ onError }: { onError: (message: string) => void }) {
    const [active, setActive] = useState(() => document.fullscreenElement === document.documentElement);
    const [pending, setPending] = useState(false);
    const available = document.fullscreenEnabled;
    useEffect(() => {
        const update = () => setActive(document.fullscreenElement === document.documentElement);
        document.addEventListener('fullscreenchange', update);
        return () => document.removeEventListener('fullscreenchange', update);
    }, []);
    const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
    return <button type="button" className="icon-button fullscreen-toggle" aria-label={label} title={available ? label : 'Fullscreen is unavailable in this browser'} aria-pressed={active} disabled={!available || pending} onClick={() => {
        onError(''); setPending(true);
        // Keep this request in the click gesture; awaiting storage would lose activation.
        const operation = active ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        void operation.catch(() => onError('Fullscreen could not open. Allow fullscreen for this page and try again.')).finally(() => setPending(false));
    }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{active ? <path d="M3 8h5V3m8 0v5h5M3 16h5v5m8 0v-5h5"/> : <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/>}</svg></button>;
}
