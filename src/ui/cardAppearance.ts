import type { CardAppearance, DashboardDocument, Widget, WidgetType } from '../state/model';
import { emptyAppearance } from '../state/model';

export const appearanceKeys = ['borderColor', 'backgroundColor', 'borderWidth', 'corners', 'shadow', 'fontFamily', 'textSize', 'headingWeight', 'lineSpacing', 'surface', 'backgroundOpacity', 'backgroundBlur', 'padding', 'titleVisibility', 'titleAlignment', 'controlsVisibility'] as const satisfies readonly (keyof CardAppearance)[];
export type AppearanceSource = 'Theme' | 'Global defaults' | 'Widget-type defaults' | 'Individual widget';
export function resolveAppearance(global: CardAppearance, type: CardAppearance = emptyAppearance(), local: CardAppearance = emptyAppearance()) {
    const value = emptyAppearance();
    const sources = {} as Record<keyof CardAppearance, AppearanceSource>;
    for (const key of appearanceKeys) {
        const layers = [[local, 'Individual widget'], [type, 'Widget-type defaults'], [global, 'Global defaults']] as const;
        const winner = layers.find(([layer]) => layer[key] != null);
        if (winner) Object.assign(value, { [key]: winner[0][key] });
        sources[key] = winner?.[1] ?? 'Theme';
    }
    return { value, sources };
}
export function widgetAppearance(document: DashboardDocument, widget: Widget): CardAppearance {
    return resolveAppearance(document.appearance, document.typeAppearance?.[widget.type], widget.appearance).value;
}
export const fontStacks = {
    system: "system-ui, 'Segoe UI', sans-serif",
    sans: 'Arial, Helvetica, sans-serif',
    serif: "Georgia, 'Times New Roman', serif",
    mono: "Consolas, 'Courier New', monospace",
    handwritten: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive",
} as const;
export const widgetTypeLabels: Record<WidgetType, string> = { scratchpad: 'Scratchpad', wellbeing: 'Wellbeing', music: 'Music', linkGroup: 'Link Group', video: 'Video', date: 'Date', todo: 'Todo List', notes: 'Notes', sticky: 'Sticky Note', pomodoro: 'Pomodoro Timer', reminder: 'Reminder', clock: 'Clock', habit: 'Habit Tracker', image: 'Image', calendar: 'Calendar', weather: 'Weather' };
export function appearanceAttributes(style: CardAppearance) {
    return {
        'data-card-font': style.fontFamily || undefined,
        'data-card-text-size': style.textSize ?? undefined,
        'data-card-line-spacing': style.lineSpacing ?? undefined,
        'data-card-heading-weight': style.headingWeight || undefined,
        'data-card-padding': style.padding || undefined,
        'data-card-title': style.titleVisibility || undefined,
        'data-card-align': style.titleAlignment || undefined,
        'data-card-controls': style.controlsVisibility || undefined,
        'data-card-surface': style.surface || (style.backgroundOpacity != null || style.backgroundBlur != null ? 'custom' : undefined),
    };
}

export function effectiveAppearance(global: CardAppearance, local: CardAppearance): CardAppearance {
    return resolveAppearance(global, emptyAppearance(), local).value;
}
function luminance(hex: string): number {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
export function contrast(a: string, b: string): number { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export function compositeColor(foreground: string, background: string, opacity: number): string {
    return '#' + [1, 3, 5].map(i => Math.round(parseInt(foreground.slice(i, i + 2), 16) * opacity + parseInt(background.slice(i, i + 2), 16) * (1 - opacity)).toString(16).padStart(2, '0')).join('');
}
/** Keep a readable surface even over an arbitrary photo behind the glass. */
export function readableSurface(background: string, requestedOpacity: number) {
    const text = contrast(background, '#000000') >= contrast(background, '#ffffff') ? '#000000' : '#ffffff';
    let opacity = Math.max(0, Math.min(100, requestedOpacity));
    while (opacity < 100 && ['#000000', '#ffffff'].some(backdrop => contrast(compositeColor(background, backdrop, opacity / 100), text) < 4.5)) opacity = Math.min(100, opacity + 1);
    return { text, opacity };
}
export function cardVariables(style: CardAppearance): Record<string, string> {
    const vars: Record<string, string> = {};
    if (style.fontFamily) vars['--card-font'] = fontStacks[style.fontFamily];
    if (style.textSize != null) vars['--card-font-size'] = `${style.textSize}px`;
    if (style.headingWeight) vars['--card-heading-weight'] = ({ regular: '400', medium: '500', bold: '700' })[style.headingWeight];
    if (style.lineSpacing != null) vars['--card-line-height'] = String(style.lineSpacing);
    if (style.padding) vars['--card-padding'] = ({ compact: '12px', comfortable: '24px', spacious: '32px' })[style.padding];
    if (style.backgroundOpacity != null) vars['--card-opacity'] = `${style.backgroundOpacity}%`;
    if (style.backgroundBlur != null || style.surface === 'glass') vars['--card-blur'] = `${style.backgroundBlur ?? 12}px`;
    if (style.surface || style.backgroundOpacity != null || style.backgroundBlur != null) {
        const requested = style.backgroundOpacity ?? (style.surface === 'glass' ? 82 : 100);
        if (style.backgroundColor) {
            const readable = readableSurface(style.backgroundColor, requested);
            vars['--card-safe-opacity'] = `${readable.opacity}%`;
            vars['--card-surface-ink'] = readable.text;
        } else vars['--card-safe-opacity'] = `${Math.max(85, requested)}%`;
    }
    if (style.titleAlignment) vars['--card-title-align'] = style.titleAlignment;
    if (style.borderColor) vars['--card-border'] = style.borderColor;
    if (style.borderWidth || style.borderColor) vars['--card-border-width'] = ({ thin: '1px', medium: '2px', thick: '3px' } as const)[style.borderWidth ?? 'thin'];
    if (style.corners) vars['--card-radius'] = ({ square: '5px', rounded: '20px', soft: '28px' } as const)[style.corners];
    if (style.shadow) vars['--card-shadow'] = ({ none: 'none', soft: '0 5px 10px #102c3817', lifted: '0 10px 24px #102c382b' } as const)[style.shadow];
    if (style.backgroundColor) {
        const bg = style.backgroundColor;
        const dark = contrast(bg, '#000000') >= contrast(bg, '#ffffff');
        const preferred = dark ? '#142e37' : '#f4faff';
        const text = contrast(bg, preferred) >= 4.5 ? preferred : dark ? '#000000' : '#ffffff';
        const muted = dark ? '#4d6470' : '#b4c8d2';
        const accent = dark ? '#007d9b' : '#67d5e6';
        const safeAccent = contrast(bg, accent) >= 4.5 ? accent : text;
        Object.assign(vars, { '--card-background': bg, '--card-color-scheme': dark ? 'light' : 'dark', '--card-text': text, '--card-muted': contrast(bg, muted) >= 4.5 ? muted : text, '--card-accent': safeAccent, '--card-on-accent': contrast(safeAccent, '#000000') >= contrast(safeAccent, '#ffffff') ? '#000000' : '#ffffff' });
    }
    return vars;
}

