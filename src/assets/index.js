// Brand asset barrel.
// The original brand files are kept with their original filenames and simply
// re-exported under semantic names. Nothing here renames the files on disk.

// "real logo" — the Seedwel mark/icon used for the header, login, registration
// and all official Seedwel Hub branding areas.
import realLogo from './Reallogo.png';

// "watermark logo" — the horizontal SEEDWEL HUB wordmark used for the loading
// animation, document watermark and free-plan document branding.
import watermarkLogo from './wordmarklogo.png';

export const REAL_LOGO = realLogo;
export const WATERMARK_LOGO = watermarkLogo;

// Semantic, widely-used aliases.
export const BRAND_LOGO = realLogo;
export const BRAND_WORDMARK = watermarkLogo;
export const LOADING_LOGO = watermarkLogo;
export const WATERMARK = watermarkLogo;
