import { StyleSheet, Text, View } from 'react-native';

import { WARNING_LEVEL_LABELS, type WarningLevel } from '@repo/types';

import { levelColors, radius, spacing, typography } from '../theme';

/** "HIGH LEVEL" pill in the level's colour, as on the wireframe. */
export function LevelBadge({
  level,
  suffix = '',
}: {
  level: WarningLevel;
  suffix?: string;
}) {
  const { background, text } = levelColors[level];
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.text, { color: text }]}>
        {`${WARNING_LEVEL_LABELS[level]}${suffix}`.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.control,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: { ...typography.label },
});
