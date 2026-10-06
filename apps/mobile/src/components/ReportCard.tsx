import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  HAZARD_TYPE_LABELS,
  type HazardType,
  type ReportStatus,
} from '@repo/types';

import { colors, radius, spacing, typography } from '../theme';
import { StatusChip } from './StatusChip';

interface ReportCardProps {
  type: HazardType;
  description: string;
  status: ReportStatus;
  /** Already formatted, e.g. "2 mins ago". */
  when: string;
  reference?: string;
  /** Absent for a report still waiting on the phone: there is nothing to open yet. */
  onPress?: () => void;
}

export function ReportCard({
  type,
  description,
  status,
  when,
  reference,
  onPress,
}: ReportCardProps) {
  const label = `${HAZARD_TYPE_LABELS[type]}, ${description}`;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Open report: ${label}` : undefined}
      accessible
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.title}>{HAZARD_TYPE_LABELS[type]}</Text>
          {reference && <Text style={styles.reference}>{reference}</Text>}
        </View>
        <Text numberOfLines={2} style={styles.description}>
          {description}
        </Text>
        <View style={styles.row}>
          <StatusChip status={status} />
          <Text style={styles.when}>{when}</Text>
        </View>
      </View>
      {onPress && <ChevronRight size={20} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { ...typography.body, fontWeight: '600', color: colors.text },
  reference: { ...typography.helper, color: colors.textMuted },
  description: { fontSize: 14, color: colors.textMuted },
  when: { ...typography.helper, color: colors.textMuted },
});
