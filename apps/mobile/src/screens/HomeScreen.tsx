import { AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { WARNING_LEVEL_LABELS } from '@repo/types';

import { AlertCard } from '../components/AlertCard';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useAlerts } from '../context/AlertsContext';
import { useReportQueue } from '../context/ReportQueueContext';
import { useNotifications } from '../hooks/useNotifications';
import { activeAlerts, highestLevel } from '../lib/alerts';
import type { TabScreenProps } from '../navigation/types';
import { colors, levelColors, radius, spacing, typography } from '../theme';

function waitingMessage(count: number): string {
  return count === 1
    ? '1 report is waiting to be sent. It will go automatically when you are online.'
    : `${count} reports are waiting to be sent. They will go automatically when you are online.`;
}

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { queued, failed, dismissFailed } = useReportQueue();
  const { unread, dismiss } = useNotifications();
  const { alerts } = useAlerts();
  const level = highestLevel(alerts);
  const active = activeAlerts(alerts);
  const recent = alerts.slice(0, 2);

  return (
    <Screen>
      <View
        style={[
          styles.card,
          level && { borderLeftColor: levelColors[level].background },
        ]}
      >
        {level ? (
          <AlertTriangle size={24} color={colors.danger} />
        ) : (
          <ShieldCheck size={24} color={colors.success} />
        )}
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>
            {level
              ? `Current Status: ${WARNING_LEVEL_LABELS[level]} warning`
              : 'Current Status: Safe'}
          </Text>
          <Text style={styles.muted}>
            {active.length === 0
              ? 'No active alerts in your area'
              : `${active.length} active warning${active.length === 1 ? '' : 's'} in your area`}
          </Text>
        </View>
      </View>

      <Button
        title="Report a Hazard"
        icon={<AlertTriangle size={20} color={colors.white} />}
        onPress={() => navigation.navigate('ReportHazard')}
      />

      {unread.map((note) => (
        <Banner
          key={note.id}
          tone={note.kind === 'REPORT_VERIFIED' ? 'success' : 'danger'}
          action={
            <Button
              title="View result"
              variant="ghost"
              onPress={() => {
                void dismiss(note.id);
                navigation.navigate('ReportResult', { id: note.reportId });
              }}
            />
          }
        >
          {note.message}
        </Banner>
      ))}

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

      <View style={styles.section} accessibilityLabel="Recent Alerts">
        <Text style={styles.sectionTitle}>Recent Alerts</Text>
        {recent.length === 0 ? (
          <Text style={styles.muted}>No recent alerts.</Text>
        ) : (
          recent.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onPress={() =>
                navigation.navigate('HazardAlert', { id: alert.id })
              }
            />
          ))
        )}
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
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
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
});
