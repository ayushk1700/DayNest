import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';
import type { Name } from './Icon';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    icon: Name;
    label: string;
    destructive?: boolean;
    caption?: string;
};
export function IconButton({ icon, label, caption, destructive = false, className = '', ...props }: Props) {
    return <button type="button" {...props} className={`icon-button ${destructive ? 'destructive' : ''} ${className}`} aria-label={label} title={props.title ?? label}><Icon name={icon}/>{caption && <span className="icon-caption" aria-hidden="true">{caption}</span>}</button>;
}
