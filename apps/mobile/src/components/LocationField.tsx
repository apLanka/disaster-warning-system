import { MapPin } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { UseLocation } from '../hooks/useLocation';
import { formatCoordinates } from '../lib/format';
import { colors, spacing } from '../theme';
import { Button } from './Button';
import { controlStyle, FormField } from './FormField';

const MESSAGES = {
  denied:
    'Location access is off. Turn it on in Settings so we know where the hazard is.',
  unavailable:
    'We could not get your location. Make sure location services are on, then try again.',
} as const;

interface LocationFieldProps {
  location: UseLocation;
  error?: string;
}

/** Shows where the report will be placed, and what to do if the phone could not tell. */
export function LocationField({ location, error }: LocationFieldProps) {
  const { status, retry, openSettings } = location;

  return (
    <FormField label="Location" required error={error}>
      <View style={[controlStyle(Boolean(error)), styles.row]}>
        {status === 'loading' && (
          <>
            <ActivityIndicator color={colors.textMuted} />
            <Text style={styles.muted}>Fetching location…</Text>
          </>
        )}
        {status === 'ready' && location.location && (
          <>
            <MapPin size={20} color={colors.success} />
            <Text
              style={styles.text}
              accessibilityLabel={`Location captured: ${formatCoordinates(location.location)}`}
            >
              {formatCoordinates(location.location)}
            </Text>
          </>
        )}
        {(status === 'denied' || status === 'unavailable') && (
          <>
            <MapPin size={20} color={colors.danger} />
            <Text style={styles.problem}>{MESSAGES[status]}</Text>
          </>
        )}
      </View>
      {(status === 'denied' || status === 'unavailable') && (
        <View style={styles.actions}>
          <Button title="Try again" variant="ghost" onPress={retry} />
          <Button
            title="Open Settings"
            variant="ghost"
            onPress={openSettings}
          />
        </View>
      )}
    </FormField>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, fontSize: 16, color: colors.text },
  muted: { flex: 1, fontSize: 16, color: colors.textMuted },
  problem: { flex: 1, fontSize: 14, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
