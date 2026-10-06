import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, radius, spacing } from '../theme';

export type BannerTone = 'warning' | 'danger' | 'success';

const TONES = {
  warning: {
    background: colors.warningTint,
    text: colors.warningText,
    Icon: AlertTriangle,
  },
  danger: { background: colors.dangerTint, text: colors.danger, Icon: XCircle },
  success: {
    background: colors.successTint,
    text: colors.success,
    Icon: CheckCircle2,
  },
} as const;

interface BannerProps {
  tone: BannerTone;
  children: string;
  /** Shown below the message, e.g. a Retry button. */
  action?: ReactNode;
}

export function Banner({ tone, children, action }: BannerProps) {
  const { background, text, Icon } = TONES[tone];

  return (
    <View
      // An alert is only announced when it is its own accessibility element.
      accessible={tone === 'danger' ? true : undefined}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: background }]}
    >
      <Icon size={20} color={text} />
      <View style={styles.body}>
        <Text style={[styles.text, { color: text }]}>{children}</Text>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.control,
  },
  body: { flex: 1, gap: spacing.sm },
  text: { fontSize: 14, lineHeight: 20 },
});
