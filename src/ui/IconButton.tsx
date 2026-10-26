import { motion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';
import { Icon } from './Icon';
import type { Name } from './Icon';

type Props = Omit<HTMLMotionProps<'button'>, 'children'> & {
    icon: Name;
    label: string;
    destructive?: boolean;
    caption?: string;
};
export function IconButton({ icon, label, caption, destructive = false, className = '', ...props }: Props) {
    return <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} {...props} className={`icon-button ${destructive ? 'destructive' : ''} ${className}`} aria-label={label} title={props.title ?? label}><Icon name={icon}/>{caption && <span className="icon-caption" aria-hidden="true">{caption}</span>}</motion.button>;
}
