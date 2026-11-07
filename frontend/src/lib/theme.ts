export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'billy-theme';

function channels(hex: string) {
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}

export function luminance(hex: string): number {
  const linear = channels(hex).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function contrastRatio(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Find the smallest blend toward white/black that passes every surface.
// Keep the seed's hue rather than inverting brand and semantic colours.
export function ensureContrast(seed: string, surfaces: string[], minimum = 4.5): string {
  const passes = (color: string) => surfaces.every(surface => contrastRatio(color, surface) >= minimum);
  if (passes(seed)) return seed;
  const source = channels(seed);
  const endpoint = passes('#ffffff') ? 255 : 0;
  let low = 0;
  let high = 1;
  let result = endpoint ? '#ffffff' : '#000000';
  if (!passes(result)) throw new Error('No shared contrast colour for these surfaces');
  for (let step = 0; step < 24; step++) {
    const amount = (low + high) / 2;
    const candidate = '#' + source.map(value => Math.round(value + (endpoint - value) * amount).toString(16).padStart(2, '0')).join('');
    if (passes(candidate)) { high = amount; result = candidate; } else low = amount;
  }
  return result;
}

export const darkSurfaces = [
  '#000000', '#050505', '#0d0d0d', '#161616',
  '#244534', '#4a2b2a', '#493857', '#403324',
];
export const darkPalette = {
  '--theme-page': darkSurfaces[0],
  '--theme-panel': darkSurfaces[1],
  '--theme-raised': darkSurfaces[2],
  '--theme-hover': darkSurfaces[3],
  '--theme-text': ensureContrast('#e8e3db', darkSurfaces, 7),
  '--theme-muted': ensureContrast('#a9a49c', darkSurfaces),
  '--theme-accent': ensureContrast('#f2a007', darkSurfaces),
  '--theme-success': ensureContrast('#73b98d', darkSurfaces),
  '--theme-danger': ensureContrast('#ed8a7a', darkSurfaces),
  '--theme-info': ensureContrast('#84b3ce', darkSurfaces),
  '--theme-border': ensureContrast('#626971', darkSurfaces, 3),
  // Existing primary buttons use white copy: darken their orange to match.
  '--theme-action': ensureContrast('#a64c00', ['#ffffff']),
  '--theme-action-hover': ensureContrast('#893c00', ['#ffffff']),
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = preference === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
  for (const [property, value] of Object.entries(darkPalette)) root.style.setProperty(property, value);
  window.dispatchEvent(new Event('billy-theme-change'));
}

// Run in <head> before paint, including when storage is unavailable.
export const themeBootstrapScript = `(()=>{
  let preference='system';
  try { const saved=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); if(['light','dark','system'].includes(saved)) preference=saved; } catch {}
  const root=document.documentElement;
  root.dataset.themePreference=preference;
  root.dataset.theme=preference==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):preference;
  for(const [key,value] of Object.entries(${JSON.stringify(darkPalette)})) root.style.setProperty(key,value);
})();`;
