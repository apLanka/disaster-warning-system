import { CircleX } from 'lucide-react-native';
import { StyleSheet, Text } from 'react-native';

import { REJECTION_REASON_LABELS } from '@repo/types';

import { describeError } from '../api/client';
import { getMyReport } from '../api/hazardReports';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { ResultCard } from '../components/ResultCard';
import { Screen } from '../components/Screen';
import { StatusChip } from '../components/StatusChip';
import { useResource } from '../hooks/useResource';
import type { ScreenProps } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { View } from 'react-native';

/** What happened to a report: verified, or rejected with the reason (change C6). */
export function ReportResultScreen({
  navigation,
  route,
}: ScreenProps<'ReportResult'>) {
  const {
    data: report,
    error,
    reload,
  } = useResource(
    (signal) => getMyReport(route.params.id, signal),
    [route.params.id],
  );

  if (!report) {
    return (
      <Screen>
        {error !== null && (
          <Banner
            tone="danger"
            action={
              <Button title="Try again" variant="ghost" onPress={reload} />
            }
          >
            {describeError(error)}
          </Banner>
        )}
      </Screen>
    );
  }

  const rejected = report.status === 'REJECTED';
  const reason = report.decision?.rejectionReason;
  const details = report.decision?.rejectionDetails;

  return (
    <Screen
      footer={
        <>
          {rejected && (
            <Button
              title="Submit a new report"
              onPress={() => navigation.replace('ReportHazard')}
            />
          )}
          <Button
            title="View Report"
            variant="secondary"
            onPress={() =>
              navigation.replace('ReportDetail', { id: report.id })
            }
          />
        </>
      }
    >
      {rejected ? (
        <View style={styles.rejected}>
          <CircleX size={40} color={colors.danger} />
          <Text accessibilityRole="header" style={styles.title}>
            Report Rejected
          </Text>
          <Text style={styles.message}>
            {`Your report ${report.reference} was not accepted.`}
          </Text>
          <StatusChip status="REJECTED" />
          {reason && (
            <Text
              style={styles.reason}
            >{`Reason: ${REJECTION_REASON_LABELS[reason]}`}</Text>
          )}
          {details && <Text style={styles.message}>{details}</Text>}
        </View>
      ) : (
        <ResultCard
          tone="success"
          title="Report Verified"
          message={`Your report ${report.reference} has been verified by the Disaster Management Centre.`}
        >
          <StatusChip status="VERIFIED" />
        </ResultCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rejected: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.xl,
  },
  title: { ...typography.screenTitle, fontSize: 20, color: colors.text },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  reason: {
    ...typography.body,
    fontWeight: '600',
    color: colors.danger,
    textAlign: 'center',
  },
});
