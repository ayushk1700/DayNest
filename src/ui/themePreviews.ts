import type { RecommendedTheme } from '../state/model';

/** Palette previews follow the user's twelve recommended full themes. */
export const themePreviews: Record<RecommendedTheme, string> = {
    'Warm Earth': 'linear-gradient(120deg,#d99168,#c9c0ad)',
    'Midnight': 'linear-gradient(120deg,#245d86,#1c2731)',
    'Ocean Breeze': 'linear-gradient(120deg,#0795a9,#9dd1d1)',
    'Forest Green': 'linear-gradient(120deg,#91b08b,#d4e1cd)',
    'Soft Sunset': 'linear-gradient(120deg,#e6a2b0,#f6dbcf)',
    'Lavender': 'linear-gradient(120deg,#9d9bd0,#d8d4e7)',
    'Paper & Ink': 'linear-gradient(120deg,#f4eee0,#bbb6aa)',
    'Sakura': 'linear-gradient(120deg,#f0bbc9,#faeae2)',
    'Matcha': 'linear-gradient(120deg,#9db58c,#e3e8ce)',
    'Nordic Snow': 'linear-gradient(120deg,#e2ecef,#fcfdfd)',
    'Vintage Sepia': 'linear-gradient(120deg,#c5a47e,#f0e1c4)',
    'Peach Cream': 'linear-gradient(120deg,#f4b48e,#fbe7cd)',
};
