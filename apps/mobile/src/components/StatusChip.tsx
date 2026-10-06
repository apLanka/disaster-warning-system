import { StyleSheet, Text, View } from 'react-native';

import { REPORT_STATUS_LABELS, type ReportStatus } from '@repo/types';

import { colors, radius, spacing, typography } from '../theme';

// One chip for every screen: colour and label never vary (style guide 5.3).
const STYLES: Record<ReportStatus, { background: string; text: string }> = {
  PENDING_SYNC: { background: colors.neutralTint, text: colors.textMuted },
  PENDING_VERIFICATION: {
    background: colors.warningTint,
    text: colors.warningText,
  },
  VERIFIED: { background: colors.successTint, text: colors.success },
  REJECTED: { background: colors.dangerTint, text: colors.danger },
};

export function StatusChip({ status }: { status: ReportStatus }) {
  const { background, text } = STYLES[status];

  return (
    <View style={[styles.chip, { backgroundColor: background }]}>
      <View style={[styles.dot, { backgroundColor: text }]} />
      <Text style={[styles.label, { color: text }]}>
        {REPORT_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm - 2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { ...typography.helper, fontWeight: '600' },
});
