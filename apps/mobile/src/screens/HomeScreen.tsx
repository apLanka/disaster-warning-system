import { AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { HealthStatus } from '../components/HealthStatus';
import { Screen } from '../components/Screen';
import { useReportQueue } from '../context/ReportQueueContext';
import type { ScreenProps } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

function waitingMessage(count: number): string {
  return count === 1
    ? '1 report is waiting to be sent. It will go automatically when you are online.'
    : `${count} reports are waiting to be sent. They will go automatically when you are online.`;
}

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const { queued, failed, dismissFailed } = useReportQueue();

  return (
    <Screen>
      <View style={styles.card}>
        <ShieldCheck size={24} color={colors.navy} />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Stay informed</Text>
          <Text style={styles.muted}>
            Official alerts for your area will appear here.
          </Text>
        </View>
      </View>

      <Button
        title="Report a Hazard"
        icon={<AlertTriangle size={20} color={colors.white} />}
        onPress={() => navigation.navigate('ReportHazard')}
      />

      {queued.length > 0 && (
        <Banner tone="warning">{waitingMessage(queued.length)}</Banner>
      )}

      {failed.map(({ report, message }) => (
        <Banner
          key={report.id}
          tone="danger"
          action={
            <Button
              title="Dismiss"
              variant="ghost"
              onPress={() => void dismissFailed(report.id)}
            />
          }
        >
          {`A saved report could not be sent. ${message}`}
        </Banner>
      ))}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Alerts</Text>
        <Text style={styles.muted}>No recent alerts.</Text>
      </View>

      <View style={styles.status}>
        <HealthStatus />
      </View>
    </Screen>
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
  cardText: { flex: 1, gap: spacing.xs },
  cardTitle: { ...typography.body, fontWeight: '600', color: colors.text },
  muted: { ...typography.body, fontSize: 14, color: colors.textMuted },
  section: { gap: spacing.sm },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  status: { alignItems: 'center' },
});
