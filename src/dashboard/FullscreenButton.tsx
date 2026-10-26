import { useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';

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
    }}><Icon name={active ? 'compress' : 'expand'}/></button>;
}
