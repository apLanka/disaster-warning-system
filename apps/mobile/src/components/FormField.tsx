import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, spacing, typography } from '../theme';

interface FormFieldProps {
  label: string;
  required?: boolean;
  /** Shown in place of the hint, in red. */
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Label above, helper or error text below (style guide 5.2). */
export function FormField({
  label,
  required,
  error,
  hint,
  children,
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required && (
          <Text style={styles.asterisk} accessibilityElementsHidden>
            {' *'}
          </Text>
        )}
      </Text>
      {children}
      {error ? (
        <Text
          style={styles.error}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : (
        hint && <Text style={styles.hint}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  asterisk: { color: colors.danger },
  error: { ...typography.helper, color: colors.danger, fontSize: 13 },
  hint: { ...typography.helper, color: colors.textMuted },
});

/** Shared look for text entry, so every control has the same border and error state. */
export const controlStyle = (hasError: boolean) => ({
  borderWidth: 1,
  borderColor: hasError ? colors.danger : colors.border,
  borderRadius: 8,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.md,
  color: colors.text,
  fontSize: 16,
});
