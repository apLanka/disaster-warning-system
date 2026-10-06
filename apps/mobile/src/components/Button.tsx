import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { ReactNode } from 'react';

import { colors, radius, spacing, typography } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Shows a spinner and blocks further presses, so a request cannot be sent twice. */
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
}

const BACKGROUNDS: Record<ButtonVariant, string> = {
  primary: colors.orange,
  secondary: colors.navy,
  ghost: colors.surface,
  danger: colors.danger,
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  accessibilityHint,
}: ButtonProps) {
  const blocked = disabled || loading;
  const onLight = variant === 'ghost';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: BACKGROUNDS[variant] },
        onLight && styles.ghost,
        blocked && styles.blocked,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={onLight ? colors.text : colors.white} />
      ) : (
        icon
      )}
      <Text
        style={[
          styles.text,
          { color: onLight ? colors.text : colors.white },
          variant === 'primary' && styles.upper,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
  },
  ghost: { borderWidth: 1, borderColor: colors.border },
  blocked: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  text: { ...typography.button },
  upper: { textTransform: 'uppercase' },
});
