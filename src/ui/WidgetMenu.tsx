import { createPortal } from 'react-dom';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, KeyboardEvent, CSSProperties } from 'react';
import { Icon } from './Icon';

/** Unscaled card actions stay above clipping/scrolling card bodies. */
export function WidgetMenu({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    side: 'above' | 'below';
    pointer: number;
    maxHeight: number;
  } | null>(null);
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    popup = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contains = (target: Node | null) =>
    !!target && (!!root.current?.contains(target) || !!popup.current?.contains(target));
  const items = () =>
    Array.from(
      popup.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)') ??
        [],
    );
  function enter() {
    if (closing.current) clearTimeout(closing.current);
    window.dispatchEvent(new CustomEvent('purrductivity-card-menu', { detail: id }));
    setOpen(true);
  }
  function leave() {
    if (closing.current) clearTimeout(closing.current);
    closing.current = setTimeout(() => {
      if (!contains(document.activeElement)) setOpen(false);
    }, 130);
  }
  useEffect(
    () => () => {
      if (closing.current) clearTimeout(closing.current);
    },
    [],
  );
  useEffect(() => {
    const another = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    };
    window.addEventListener('purrductivity-card-menu', another);
    return () => window.removeEventListener('purrductivity-card-menu', another);
  }, [id]);
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const r = trigger.current?.getBoundingClientRect(),
        panel = popup.current;
      const p = panel ? { width: panel.offsetWidth, height: panel.offsetHeight } : null;
      if (!r || !p) return;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
        setOpen(false);
        return;
      }
      const below = innerHeight - r.bottom - 20,
        above = r.top - 20;
      const side: 'below' | 'above' = p.height <= below || below >= above ? 'below' : 'above';
      const maxHeight = Math.max(64, (side === 'below' ? below : above) - 16);
      const height = Math.min(p.height, maxHeight + 16);
      const left = Math.max(8, Math.min(r.right - p.width + 6, innerWidth - p.width - 8));
      const top = side === 'below' ? r.bottom + 12 : Math.max(8, r.top - height - 12);
      const next = {
        left,
        top,
        side,
        pointer: Math.max(18, Math.min(p.width - 18, r.left + r.width / 2 - left)),
        maxHeight,
      };
      setPosition((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const observer = new ResizeObserver(place);
    if (popup.current) observer.observe(popup.current);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, title]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (!contains(event.target as Node)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      trigger.current?.focus();
      setOpen(false);
    }
    if (event.key === 'ArrowDown' && event.target === trigger.current) {
      event.preventDefault();
      enter();
      requestAnimationFrame(() => items()[0]?.focus());
    }
    if (event.key === 'Tab' && open) {
      if (event.target === trigger.current && !event.shiftKey) {
        event.preventDefault();
        items()[0]?.focus();
      } else if (
        (event.shiftKey && event.target === items()[0]) ||
        (!event.shiftKey && event.target === items().at(-1))
      ) {
        event.preventDefault();
        trigger.current?.focus();
        setOpen(false);
      }
    }
  }
  return (
    <div
      ref={root}
      className="widget-controls widget-menu"
      onKeyDown={key}
      onFocusCapture={(event) => {
        if (popup.current?.contains(event.target as Node)) enter();
      }}
      onBlur={(event) => {
        if (!contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') enter();
      }}
      onPointerLeave={leave}
    >
      <button
        ref={trigger}
        id={id + '-trigger'}
        type="button"
        className="icon-button more-actions"
        aria-label={`Card menu for ${title}`}
        title={`Card menu for ${title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={enter}
      >
        <Icon name="more" />
      </button>
      {createPortal(
        <div
          ref={popup}
          id={id}
          hidden={!open}
          data-side={position?.side}
          data-return-focus={id + '-trigger'}
          className="card-action-menu"
          role="region"
          aria-label={`${title} actions`}
          style={
            {
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              '--menu-pointer': `${position?.pointer ?? 24}px`,
              '--menu-scroll-height': `${position?.maxHeight ?? 500}px`,
              visibility: open && !position ? 'hidden' : undefined,
            } as CSSProperties
          }
          onPointerEnter={enter}
          onPointerLeave={leave}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('button')) {
              trigger.current?.focus();
              setOpen(false);
            }
          }}
        >
          <span className="card-menu-tip" aria-hidden="true" />
          <div className="card-menu-scroll">{children}</div>
        </div>,
        document.body,
      )}
    </div>
  );
}
