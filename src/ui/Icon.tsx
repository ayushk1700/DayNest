import { glyphs } from './vendor/uicons';
export type Name = keyof typeof glyphs;
/** Local Flaticon Uicons. Decorative glyphs are named by their parent controls. */
export function Icon({ name }: { name: Name }) {
    return <span className="uicon" aria-hidden="true">{String.fromCodePoint(glyphs[name])}</span>;
}
