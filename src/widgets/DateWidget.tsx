import type { ReactNode } from 'react';
import type { Widget } from '../state/model';
import { useNow } from '../timing/hooks';
import { dateBannerParts } from './dates';

export function DateWidget({
  widget,
  header,
}: {
  widget: Extract<Widget, { type: 'date' }>;
  header: ReactNode;
}) {
  const now = useNow();
  const date = dateBannerParts(now);
  const label = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(now);
  return (
    <section className="widget date-card" aria-label={widget.title || 'Date'}>
      {header}
      <time className="date-banner" dateTime={date.key} aria-label={label}>
        <span className="date-intro" aria-hidden="true">
          It’s
        </span>
        <span className="date-line" aria-hidden="true">
          <span className="date-number">
            {date.day}
            <sup>{date.suffix}</sup>
          </span>
          <span className="date-month">of {date.month}.</span>
        </span>
      </time>
    </section>
  );
}
