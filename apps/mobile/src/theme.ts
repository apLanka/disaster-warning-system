import type { WarningLevel } from '@repo/types';

// Design tokens from docs/style-guide.md. Never hard-code a colour in a component.
export const colors = {
  navy: '#17324d',
  navyHover: '#244663',
  orange: '#e67e22',
  orangeTint: '#fff1e5',
  success: '#2e8b57',
  successTint: '#eaf6ef',
  danger: '#c1392b',
  dangerTint: '#fbedec',
  warningTint: '#fff3cd',
  warningText: '#8a5a00',
  neutralTint: '#eef2f6',
  page: '#f5f7fa',
  surface: '#ffffff',
  border: '#d9dee5',
  text: '#263238',
  textMuted: '#667085',
  white: '#ffffff',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = { control: 8, card: 12, pill: 999 } as const;

/** Minimum touch target, in points (style guide section 4). */
export const TOUCH_TARGET = 44;

export const typography = {
  screenTitle: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  helper: { fontSize: 12, fontWeight: '400' },
  button: { fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
} as const;

/** Warning level badges: the portal's level buttons, from the same tokens. */
export const levelColors: Record<
  WarningLevel,
  { background: string; text: string }
> = {
  CRITICAL: { background: colors.danger, text: colors.white },
  HIGH: { background: colors.orange, text: colors.white },
  MEDIUM: { background: colors.warningTint, text: colors.warningText },
  LOW: { background: colors.success, text: colors.white },
};
