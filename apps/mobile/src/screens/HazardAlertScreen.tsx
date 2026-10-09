import { AlertTriangle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { describeError } from '../api/client';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { LevelBadge } from '../components/LevelBadge';
import { Screen } from '../components/Screen';
import { useAlerts } from '../context/AlertsContext';
import { alertTitle, describeAlertDistricts, mapsUrl } from '../lib/alerts';
import { formatDateTime } from '../lib/time';
import type { ScreenProps } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

/** Wireframe screen 5. Acknowledging leads to Safety Info. */
export function HazardAlertScreen({
  route,
  navigation,
}: ScreenProps<'HazardAlert'>) {
  const { alerts, acknowledge } = useAlerts();
  const alert = alerts.find((item) => item.id === route.params.id);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!alert) {
    return (
      <Screen
        footer={
          <Button
            title="Back to alerts"
            variant="ghost"
            onPress={() => navigation.goBack()}
          />
        }
      >
        <Text style={styles.text}>This warning is no longer available.</Text>
      </Screen>
    );
  }

  const active = alert.state === 'ACTIVE';

  async function onAcknowledge() {
    setSending(true);
    setFailure(null);
    try {
      await acknowledge(alert!.id);
      navigation.navigate('SafetyInfo', { id: alert!.id });
    } catch (error) {
      setFailure(describeError(error));
    } finally {
      setSending(false);
    }
  }

  const footer = (
    <>
      <Button
        title="View Map"
        variant="ghost"
        onPress={() => void Linking.openURL(mapsUrl(alert.districts[0]!))}
      />
      {active &&
        (alert.acknowledgedAt ? (
          <Button
            title="View Safety Info"
            onPress={() => navigation.navigate('SafetyInfo', { id: alert.id })}
          />
        ) : (
          <Button
            title="Acknowledge Warning"
            loading={sending}
            onPress={onAcknowledge}
          />
        ))}
    </>
  );

  return (
    <Screen footer={footer}>
      {failure && <Banner tone="danger">{failure}</Banner>}
      {alert.state === 'ALL_CLEAR' && (
        <Banner tone="success">{`All clear: ${alert.cancelReason ?? 'the warning has been lifted.'}`}</Banner>
      )}
      {alert.state === 'EXPIRED' && (
        <Banner tone="warning">This warning has expired.</Banner>
      )}
      {alert.acknowledgedAt && active && (
        <Banner tone="success">{`You acknowledged this warning on ${formatDateTime(alert.acknowledgedAt)}.`}</Banner>
      )}

      <View style={styles.card}>
        <View style={styles.row}>
          <AlertTriangle size={22} color={colors.danger} />
          <Text accessibilityRole="header" style={styles.title}>
            {alertTitle(alert)}
          </Text>
        </View>
        <LevelBadge level={alert.level} suffix=" level" />
        <Text style={styles.text}>{describeAlertDistricts(alert)}</Text>
      </View>

      <View style={styles.card}>
        <Text
          style={styles.meta}
        >{`Issued: ${formatDateTime(alert.issuedAt)}`}</Text>
        <Text
          style={styles.meta}
        >{`Valid until: ${formatDateTime(alert.validUntil)}`}</Text>
        <Text style={styles.label}>Description</Text>
        <Text style={styles.text}>{alert.description}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Safety Instructions</Text>
        {alert.safetyInstructions.map((step, index) => (
          <Text key={step} style={styles.text}>{`${index + 1}. ${step}`}</Text>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: colors.danger },
  label: {
    ...typography.label,
    color: colors.navy,
    textTransform: 'uppercase',
  },
  text: { ...typography.body, color: colors.text },
  meta: { ...typography.helper, color: colors.textMuted },
});
