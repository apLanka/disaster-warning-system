import { CheckCircle2, Phone } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useAlerts } from '../context/AlertsContext';
import type { ScreenProps } from '../navigation/types';
import { colors, radius, spacing, TOUCH_TARGET, typography } from '../theme';

const CONTACTS = [
  { name: 'DMC Hotline', number: '117' },
  { name: 'Police', number: '119' },
  { name: 'Ambulance', number: '110' },
] as const;

/**
 * Wireframe screen 6. Nearest shelters and the evacuation map are left out:
 * no shelter or route data exists yet (scope note in the critique).
 */
export function SafetyInfoScreen({
  route,
  navigation,
}: ScreenProps<'SafetyInfo'>) {
  const { alerts } = useAlerts();
  const alert = alerts.find((item) => item.id === route.params.id);

  return (
    <Screen
      footer={
        <Button
          title="Back to alerts"
          variant="ghost"
          onPress={() => navigation.navigate('Main', { screen: 'Alerts' })}
        />
      }
    >
      <View style={styles.done}>
        <CheckCircle2 size={48} color={colors.success} />
        <Text accessibilityRole="header" style={styles.doneText}>
          Alert Acknowledged
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Emergency Contacts</Text>
        {CONTACTS.map(({ name, number }) => (
          <Pressable
            key={number}
            accessibilityRole="link"
            accessibilityLabel={`${name}: ${number}`}
            accessibilityHint="Calls this number"
            onPress={() => void Linking.openURL(`tel:${number}`)}
            style={styles.contact}
          >
            <Phone size={18} color={colors.navy} />
            <Text style={styles.text}>{`${name}: ${number}`}</Text>
          </Pressable>
        ))}
      </View>

      {alert && (
        <View style={styles.card}>
          <Text style={styles.label}>What to do now</Text>
          {alert.safetyInstructions.map((step, index) => (
            <Text
              key={step}
              style={styles.text}
            >{`${index + 1}. ${step}`}</Text>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  doneText: { fontSize: 20, fontWeight: '700', color: colors.success },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.navy,
    textTransform: 'uppercase',
  },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
  },
  text: { ...typography.body, color: colors.text },
});
