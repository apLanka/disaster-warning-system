import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AlertCard } from '../components/AlertCard';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useAlerts } from '../context/AlertsContext';
import type { TabScreenProps } from '../navigation/types';
import { colors, typography } from '../theme';

/** Wireframe screen 4 (finding UI3): every warning that reached this phone. */
export function AlertsScreen({ navigation }: TabScreenProps<'Alerts'>) {
  const { alerts, profile, profileLoaded, stale, refresh } = useAlerts();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <Screen>
      {profileLoaded && !profile && (
        <Banner
          tone="warning"
          action={
            <Button
              title="Set district"
              variant="ghost"
              onPress={() => navigation.navigate('Profile')}
            />
          }
        >
          Set your district to receive warnings
        </Banner>
      )}
      {stale && (
        <Banner tone="warning">
          Could not check for new warnings. Showing the last saved list.
        </Banner>
      )}

      {alerts.length === 0 ? (
        profile && <Text style={styles.empty}>No warnings for your area.</Text>
      ) : (
        <View style={styles.list}>
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onPress={() =>
                navigation.navigate('HazardAlert', { id: alert.id })
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
