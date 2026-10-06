import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET, typography } from '../theme';
import { controlStyle, FormField } from './FormField';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  label: string;
  required?: boolean;
  placeholder: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  error?: string;
}

/** A dropdown that opens as a list of large, tappable choices. */
export function SelectField<T extends string>({
  label,
  required,
  placeholder,
  value,
  options,
  onChange,
  error,
}: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  function choose(next: T) {
    onChange(next);
    setOpen(false);
  }

  return (
    <FormField label={label} required={required} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityHint="Opens the list of choices"
        onPress={() => setOpen(true)}
        style={[controlStyle(Boolean(error)), styles.control]}
      >
        <Text style={[styles.value, !selected && styles.placeholder]}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close the list"
          style={styles.backdrop}
          onPress={() => setOpen(false)}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title}>{label}</Text>
          <FlatList
            data={options}
            keyExtractor={(option) => option.value}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: item.value === value }}
                onPress={() => choose(item.value)}
                style={styles.option}
              >
                <Text
                  style={[
                    styles.optionText,
                    item.value === value && styles.optionSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={() => setOpen(false)}
            style={styles.option}
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </FormField>
  );
}

const styles = StyleSheet.create({
  control: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: { fontSize: 16, color: colors.text },
  placeholder: { color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(38, 50, 56, 0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  title: {
    ...typography.screenTitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  option: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  optionText: { fontSize: 16, color: colors.text },
  optionSelected: { color: colors.orange, fontWeight: '600' },
  cancel: { fontSize: 16, color: colors.textMuted },
});
