import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
const overlayStack: HTMLDivElement[] = [];
let rootWasInert = false;
export function Overlay({ children, onClose, modal = false, label, fullPage = false }: {
    children: ReactNode;
    onClose: () => void;
    modal?: boolean;
    label: string;
    fullPage?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const root = document.getElementById('root');
        if (!overlayStack.length) rootWasInert = root?.inert ?? false;
        const overflow = document.body.style.overflow;
        if (fullPage) document.body.style.overflow = 'hidden';
        if (root)
            root.inert = true;
        const panel = ref.current;
        if (panel) overlayStack.push(panel);
        const items = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],summary,[tabindex="0"]') ?? []).filter(el => {const closed=el.closest('details:not([open])');return el.getClientRects().length>0&&!el.closest('[hidden],[inert]')&&(!closed||closed.querySelector('summary')===el);});
        (items()[0] ?? panel)?.focus();
        const key = (e: KeyboardEvent) => {
            if (e.defaultPrevented || overlayStack.at(-1) !== panel) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                closeRef.current();
            }
            if (e.key === 'Tab') {
                const list = items();
                const first = list[0];
                const last = list.at(-1);
                if (!first) {
                    e.preventDefault();
                    panel?.focus();
                }
                else if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', key);
        return () => {
            if (panel) overlayStack.splice(overlayStack.indexOf(panel), 1);
            document.removeEventListener('keydown', key);
            if (fullPage) document.body.style.overflow = overflow;
            if (root && !overlayStack.length)
                root.inert = rootWasInert;
            const triggerId = previous?.closest('[data-return-focus]')?.getAttribute('data-return-focus');
            const fallback = (triggerId ? document.getElementById(triggerId) : null) ?? previous?.closest('.widget-menu')?.querySelector<HTMLElement>('.more-actions');
            if (previous?.isConnected && previous.getClientRects().length) previous.focus();
            else if (fallback?.isConnected) fallback.focus();
            else document.querySelector<HTMLElement>('.floating-add')?.focus();
        };
    }, []);
    return createPortal(<div className={fullPage ? 'ambient-backdrop' : modal ? 'backdrop' : 'picker-dismiss'} onPointerDown={e => {
            if (e.target === e.currentTarget)
                onClose();
        }}><div ref={ref} role="dialog" aria-modal={modal || undefined} aria-label={label} tabIndex={-1} className={fullPage ? 'ambient-page' : modal ? 'settings-panel' : 'widget-picker'}>{children}</div></div>, document.body);
}
