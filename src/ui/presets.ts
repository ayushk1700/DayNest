import type { AppearancePreset } from '../state/model';
import { emptyAppearance } from '../state/model';
export const curatedPresets: AppearancePreset[] = [
    { id: 'curated-quiet', name: 'Quiet essentials', appearance: { ...emptyAppearance(), fontFamily: 'system', textSize: 14, lineSpacing: 1.6, corners: 'rounded', shadow: 'soft', padding: 'comfortable', controlsVisibility: 'hover' } },
    { id: 'curated-editorial', name: 'Editorial', appearance: { ...emptyAppearance(), fontFamily: 'serif', textSize: 16, headingWeight: 'bold', lineSpacing: 1.7, corners: 'square', shadow: 'none', padding: 'spacious', titleAlignment: 'left' } },
    { id: 'curated-glass', name: 'Soft glass', appearance: { ...emptyAppearance(), fontFamily: 'system', surface: 'glass', backgroundOpacity: 90, backgroundBlur: 16, corners: 'soft', shadow: 'soft', padding: 'comfortable' } },
];
