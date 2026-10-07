import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WARNING_LEVEL_LABELS, type CitizenAlertDto } from '@repo/types';

import { alertTitle, describeAlertDistricts } from '../lib/alerts';
import { formatRelativeTime } from '../lib/time';
import { colors, levelColors, radius, spacing, typography } from '../theme';

/** One warning in a list. All Clears and expired warnings are greyed. */
export function AlertCard({
  alert,
  onPress,
}: {
  alert: CitizenAlertDto;
  onPress: () => void;
}) {
  const active = alert.state === 'ACTIVE';
  const title = alert.state === 'ALL_CLEAR' ? 'ALL CLEAR' : alertTitle(alert);
  const accent = active ? levelColors[alert.level].background : colors.border;
  const label = [
    title,
    active
      ? `${WARNING_LEVEL_LABELS[alert.level]} level`
      : alert.state === 'EXPIRED'
        ? 'expired'
        : alertTitle(alert),
    describeAlertDistricts(alert),
    alert.acknowledgedAt ? 'acknowledged' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: accent },
        !active && styles.muted,
        pressed && styles.pressed,
      ]}
    >
      {active ? (
        <AlertTriangle size={22} color={colors.danger} />
      ) : (
        <CheckCircle2 size={22} color={colors.success} />
      )}
      <View style={styles.body}>
        <Text
          style={[
            styles.title,
            { color: active ? colors.danger : colors.success },
          ]}
        >
          {title}
        </Text>
        <Text style={styles.meta}>
          {describeAlertDistricts(alert)} · {formatRelativeTime(alert.issuedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  muted: { opacity: 0.7 },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: spacing.xs },
  title: { ...typography.body, fontWeight: '700' },
  meta: { ...typography.helper, color: colors.textMuted },
});
