import type { CardAppearance, DashboardDocument, Widget } from '../state/model';
import { widgetAppearance } from './cardAppearance';
/** Capture local computed skin/theme defaults as values, never as live references. */
export function appearanceSnapshot(
  document: DashboardDocument,
  widget: Widget,
  card: HTMLElement,
): CardAppearance {
  const explicit = widgetAppearance(document, widget),
    css = getComputedStyle(card);
  const heading = card.querySelector('h2'),
    headingCss = heading ? getComputedStyle(heading) : css;
  const canvas = window.document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d')!;
  const hex = (value: string) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    return (
      '#' +
      [...context.getImageData(0, 0, 1, 1).data]
        .slice(0, 3)
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
    );
  };
  const body = card.querySelector('textarea,p') ?? card,
    bodyCss = getComputedStyle(body);
  const textSize = Math.max(10, Math.min(24, parseFloat(bodyCss.fontSize) || 14));
  const font = bodyCss.fontFamily.toLowerCase();
  const backgroundCss =
    css.backgroundColor === 'transparent' || /,\s*0\)$/.test(css.backgroundColor)
      ? css.getPropertyValue('--surface').trim()
      : css.backgroundColor;
  return {
    borderColor: explicit.borderColor ?? hex(css.borderColor),
    backgroundColor: explicit.backgroundColor ?? hex(backgroundCss || '#f8fcfd'),
    borderWidth:
      explicit.borderWidth ??
      (parseFloat(css.borderWidth) >= 3
        ? 'thick'
        : parseFloat(css.borderWidth) >= 2
          ? 'medium'
          : 'thin'),
    corners:
      explicit.corners ??
      (parseFloat(css.borderRadius) > 24
        ? 'soft'
        : parseFloat(css.borderRadius) > 10
          ? 'rounded'
          : 'square'),
    shadow: explicit.shadow ?? (css.boxShadow === 'none' ? 'none' : 'soft'),
    fontFamily:
      explicit.fontFamily ??
      (/consolas|courier|monospace/.test(font)
        ? 'mono'
        : /print|hand|cursive|comic/.test(font)
          ? 'handwritten'
          : /georgia|times/.test(font)
            ? 'serif'
            : /arial|helvetica/.test(font)
              ? 'sans'
              : 'system'),
    textSize: explicit.textSize ?? textSize,
    headingWeight:
      explicit.headingWeight ??
      (parseInt(headingCss.fontWeight) >= 600
        ? 'bold'
        : parseInt(headingCss.fontWeight) >= 500
          ? 'medium'
          : 'regular'),
    lineSpacing:
      explicit.lineSpacing ??
      Math.max(1, Math.min(2.2, parseFloat(bodyCss.lineHeight) / textSize || 1.5)),
    surface: explicit.surface ?? 'solid',
    backgroundOpacity: explicit.backgroundOpacity ?? 100,
    backgroundBlur: explicit.backgroundBlur ?? 0,
    padding:
      explicit.padding ??
      (parseFloat(css.paddingTop) <= 16
        ? 'compact'
        : parseFloat(css.paddingTop) >= 30
          ? 'spacious'
          : 'comfortable'),
    titleVisibility:
      explicit.titleVisibility ?? (headingCss.clipPath !== 'none' ? 'hidden' : 'visible'),
    titleAlignment:
      explicit.titleAlignment ??
      (['center', 'right'].includes(headingCss.textAlign)
        ? (headingCss.textAlign as 'center' | 'right')
        : 'left'),
    controlsVisibility: explicit.controlsVisibility ?? 'hover',
  };
}
