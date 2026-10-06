import { Image, StyleSheet, Text, View } from 'react-native';

import {
  HAZARD_TYPE_LABELS,
  REJECTION_REASON_LABELS,
  type HazardReportDto,
} from '@repo/types';

import { describeError } from '../api/client';
import { getMyReport } from '../api/hazardReports';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { StatusChip } from '../components/StatusChip';
import { useResource } from '../hooks/useResource';
import { formatCoordinates } from '../lib/format';
import { thumbnailUrl } from '../lib/cloudinary';
import { formatRelativeTime } from '../lib/time';
import type { ScreenProps } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{title}</Text>
      {children}
    </View>
  );
}

function Decision({ report }: { report: HazardReportDto }) {
  const { decision } = report;
  if (!decision) return null;
  return (
    <Section title="Decision">
      <Text style={styles.value}>
        {report.status === 'VERIFIED' ? 'Verified' : 'Rejected'}{' '}
        {formatRelativeTime(decision.decidedAt)}
      </Text>
      {decision.rejectionReason && (
        <Text style={styles.value}>
          Reason: {REJECTION_REASON_LABELS[decision.rejectionReason]}
        </Text>
      )}
      {decision.rejectionDetails && (
        <Text style={styles.value}>{decision.rejectionDetails}</Text>
      )}
    </Section>
  );
}

export function ReportDetailScreen({
  navigation,
  route,
}: ScreenProps<'ReportDetail'>) {
  const {
    data: report,
    error,
    loading,
    reload,
  } = useResource(
    (signal) => getMyReport(route.params.id, signal),
    [route.params.id],
  );

  if (!report) {
    return (
      <Screen>
        {error !== null ? (
          <Banner
            tone="danger"
            action={
              <Button title="Try again" variant="ghost" onPress={reload} />
            }
          >
            {describeError(error)}
          </Banner>
        ) : (
          loading && (
            <Text accessibilityRole="progressbar" style={styles.value}>
              Loading report…
            </Text>
          )
        )}
      </Screen>
    );
  }

  const rejected = report.status === 'REJECTED';

  return (
    <Screen
      footer={
        rejected ? (
          <Button
            title="Submit a new report"
            onPress={() => navigation.navigate('ReportHazard')}
          />
        ) : undefined
      }
    >
      <View style={styles.header}>
        <StatusChip status={report.status} />
        <Text style={styles.reference}>{report.reference}</Text>
      </View>
      <Decision report={report} />
      <Section title="Hazard Type">
        <Text style={styles.value}>{HAZARD_TYPE_LABELS[report.type]}</Text>
      </Section>
      <Section title="Description">
        <Text style={styles.value}>{report.description}</Text>
      </Section>
      <Section title="Photo">
        {report.photos.length === 0 ? (
          <Text style={styles.muted}>No photo added</Text>
        ) : (
          <View style={styles.photos}>
            {report.photos.map((photo, index) => (
              <Image
                key={photo.publicId}
                source={{ uri: thumbnailUrl(photo.secureUrl) }}
                accessibilityLabel={`Photo ${index + 1}`}
                style={styles.thumb}
              />
            ))}
          </View>
        )}
      </Section>
      <Section title="Location">
        <Text style={styles.value}>{formatCoordinates(report.location)}</Text>
      </Section>
      <Section title="Submitted">
        <Text style={styles.value}>{formatRelativeTime(report.createdAt)}</Text>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reference: { ...typography.body, fontSize: 14, color: colors.textMuted },
  card: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  value: { ...typography.body, color: colors.text },
  muted: { ...typography.body, color: colors.textMuted },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: {
    width: 120,
    height: 90,
    borderRadius: radius.control,
    backgroundColor: colors.neutralTint,
  },
});
