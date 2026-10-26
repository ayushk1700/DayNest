import { Icon } from '../ui/Icon';
export function InsightGlyph({name}:{name:'graph'|'sun'|'clock'|'cup'|'check'|'bars'|'expand'|'link'|'search'|'cursor'|'hand'|'lock'}) {
    return <Icon name={name} className="insight-glyph"/>;
}
export function InsightBrandBar({close,workspace=false}:{close:()=>void;workspace?:boolean}){return <nav className="insight-brandbar" aria-label="Workspace navigation"><span className="insight-brand"><img src="icons/icon-32.png" alt=""/>DayNest</span><span className="insight-brand-divider"/><button className="insight-back" aria-label="Back to workspace" onClick={close}><Icon name="left"/><span>{workspace?'Workspace':'Back to workspace'}</span></button></nav>;}
