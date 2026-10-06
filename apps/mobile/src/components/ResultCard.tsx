import { CheckCircle2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, radius, spacing, typography } from '../theme';

interface ResultCardProps {
  tone: 'success' | 'warning';
  title: string;
  message: string;
  /** Extra content under the message, usually the status chip. */
  children?: ReactNode;
}

/** Centred outcome card: big status icon, heading, one line of copy (style guide 5.5). */
export function ResultCard({
  tone,
  title,
  message,
  children,
}: ResultCardProps) {
  const color = tone === 'success' ? colors.success : colors.warningText;
  const background =
    tone === 'success' ? colors.successTint : colors.warningTint;

  return (
    <View style={styles.card}>
      <View style={[styles.icon, { backgroundColor: background }]}>
        <CheckCircle2 size={36} color={color} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.xl,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.screenTitle, fontSize: 20, color: colors.text },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
