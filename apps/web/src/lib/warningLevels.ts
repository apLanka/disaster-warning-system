import type { WarningLevel } from '@repo/types';

/** Same colours as the wireframe's level buttons, all from the theme tokens. */
export const LEVEL_CLASSES: Record<WarningLevel, string> = {
  CRITICAL: 'bg-danger text-white',
  HIGH: 'bg-orange text-white',
  MEDIUM: 'bg-warning-tint text-warning-text',
  LOW: 'bg-success text-white',
};

const LEVEL_TOKENS: Record<WarningLevel, string> = {
  CRITICAL: '--color-danger',
  HIGH: '--color-orange',
  MEDIUM: '--color-warning-text',
  LOW: '--color-success',
};

/** The map draws with SVG attributes, which cannot read CSS variables, so the token is resolved here. */
export function levelColor(level: WarningLevel | ''): string {
  const token = level === '' ? '--color-navy' : LEVEL_TOKENS[level];
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value === '' ? '#17324d' : value;
}
