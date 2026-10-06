import { WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors, spacing } from '../theme';

/** Sticky notice at the top of a screen while the phone has no connection. */
export function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  if (!isOffline) return null;

  return (
    <View accessible accessibilityRole="alert" style={styles.banner}>
      <WifiOff size={18} color={colors.warningText} />
      <Text style={styles.text}>
        You are offline. Reports will be sent when you reconnect.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningTint,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, fontSize: 14, color: colors.warningText },
});
