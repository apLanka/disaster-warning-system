import { StyleSheet, Text } from 'react-native';

import { Button } from '../components/Button';
import { ResultCard } from '../components/ResultCard';
import { Screen } from '../components/Screen';
import { StatusChip } from '../components/StatusChip';
import type { ScreenProps } from '../navigation/types';
import { colors, typography } from '../theme';

const COPY = {
  PENDING_VERIFICATION: {
    tone: 'success',
    title: 'Report Submitted',
    message:
      'Your report has been submitted successfully and is waiting for verification.',
  },
  PENDING_SYNC: {
    tone: 'warning',
    title: 'Report Saved',
    message:
      'You are offline. Your report is saved on this phone and will be sent automatically when you reconnect.',
  },
} as const;

export function ReportSubmittedScreen({
  navigation,
  route,
}: ScreenProps<'ReportSubmitted'>) {
  const { status, reference } = route.params;
  const copy = COPY[status];

  return (
    <Screen
      footer={
        <Button
          title="Go to Home"
          variant="secondary"
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
          }
        />
      }
    >
      <ResultCard tone={copy.tone} title={copy.title} message={copy.message}>
        <StatusChip
          status={
            status === 'PENDING_SYNC' ? 'PENDING_SYNC' : 'PENDING_VERIFICATION'
          }
        />
        {reference && (
          <Text style={styles.reference}>{`Reference ${reference}`}</Text>
        )}
      </ResultCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  reference: { ...typography.body, fontSize: 14, color: colors.textMuted },
});
