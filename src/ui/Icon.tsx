import { glyphs } from './vendor/uicons';
export type Name = keyof typeof glyphs;
/** Local Flaticon Uicons. Decorative glyphs are named by their parent controls. */
export function Icon({ name, className = '' }: { name: Name; className?: string }) {
  return (
    <span className={`uicon ${className}`.trim()} aria-hidden="true">
      {String.fromCodePoint(glyphs[name])}
    </span>
  );
}
