import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { HAZARD_TYPE_LABELS } from '@repo/types';

import { describeError, NetworkError } from '../api/client';
import { submitHazardReport } from '../api/hazardReports';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useReportDraft } from '../context/ReportDraftContext';
import { useReportQueue } from '../context/ReportQueueContext';
import { formatCoordinates } from '../lib/format';
import { validateDraft, type ReportDraft } from '../lib/draft';
import type { NewQueuedReport } from '../offline/reportQueue';
import type { ScreenProps } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

type CompleteDraft = ReportDraft & {
  type: NonNullable<ReportDraft['type']>;
  location: NonNullable<ReportDraft['location']>;
};

function isComplete(draft: ReportDraft): draft is CompleteDraft {
  return Object.keys(validateDraft(draft)).length === 0;
}

function toQueuedReport(draft: CompleteDraft): NewQueuedReport {
  return {
    id: draft.clientRequestId,
    type: draft.type,
    description: draft.description.trim(),
    location: draft.location,
    photos: draft.photos.map(({ uri, mimeType, fileName }) => ({
      uri,
      mimeType,
      fileName,
    })),
    createdAt: new Date().toISOString(),
  };
}

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

export function ReviewReportScreen({
  navigation,
}: ScreenProps<'ReviewReport'>) {
  const { draft, reset } = useReportDraft();
  const { enqueue } = useReportQueue();
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const complete = isComplete(draft);

  // Nothing to review (for example the app restarted on this screen): go back to the form.
  useEffect(() => {
    if (!complete) navigation.replace('ReportHazard');
  }, [complete, navigation]);

  if (!isComplete(draft)) return null;

  function finish(params: {
    status: 'PENDING_VERIFICATION' | 'PENDING_SYNC';
    reference?: string;
  }) {
    reset();
    navigation.reset({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'ReportSubmitted', params }],
    });
  }

  async function saveForLater(report: CompleteDraft) {
    await enqueue(toQueuedReport(report));
    finish({ status: 'PENDING_SYNC' });
  }

  async function submit(report: CompleteDraft) {
    if (submitting) return;
    setSubmitting(true);
    setFailure(null);

    try {
      const { report: stored } = await submitHazardReport({
        clientRequestId: report.clientRequestId,
        type: report.type,
        description: report.description,
        location: report.location,
        photos: report.photos,
      });
      finish({ status: 'PENDING_VERIFICATION', reference: stored.reference });
    } catch (error) {
      // Could not reach the server (no signal, or it timed out): keep the report and send it later.
      if (error instanceof NetworkError) await saveForLater(report);
      else setFailure(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title="Submit Report"
            loading={submitting}
            onPress={() => void submit(draft)}
          />
          <Button
            title="Edit"
            variant="ghost"
            disabled={submitting}
            onPress={() => navigation.goBack()}
          />
        </>
      }
    >
      <Banner tone="warning">
        Please verify all details before submitting.
      </Banner>
      {failure && <Banner tone="danger">{failure}</Banner>}

      <Section title="Hazard Type">
        <Text style={styles.value}>{HAZARD_TYPE_LABELS[draft.type]}</Text>
      </Section>
      <Section title="Description">
        <Text style={styles.value}>{draft.description.trim()}</Text>
      </Section>
      <Section title="Photo">
        {draft.photos.length === 0 ? (
          <Text style={styles.muted}>No photo added</Text>
        ) : (
          <View style={styles.photos}>
            {draft.photos.map((photo, index) => (
              <Image
                key={photo.uri}
                source={{ uri: photo.uri }}
                accessibilityLabel={`Photo ${index + 1}`}
                style={styles.thumb}
              />
            ))}
          </View>
        )}
      </Section>
      <Section title="Location">
        <Text style={styles.value}>{formatCoordinates(draft.location)}</Text>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    width: 88,
    height: 88,
    borderRadius: radius.control,
    backgroundColor: colors.neutralTint,
  },
});
