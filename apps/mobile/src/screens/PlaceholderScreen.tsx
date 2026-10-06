import { Construction } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../theme';

/** Stands in for a tab that belongs to another use case until it is built. */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <Screen>
      <View style={styles.box}>
        <Construction size={40} color={colors.textMuted} />
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.text}>This section is coming soon.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  title: { ...typography.screenTitle, color: colors.text },
  text: { ...typography.body, fontSize: 14, color: colors.textMuted },
});
