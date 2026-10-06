import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  HAZARD_REPORT_LIMITS,
  HAZARD_TYPE_LABELS,
  HAZARD_TYPES,
  type HazardType,
} from '@repo/types';

import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { controlStyle, FormField } from '../components/FormField';
import { LocationField } from '../components/LocationField';
import { PhotoField } from '../components/PhotoField';
import { Screen } from '../components/Screen';
import { SelectField, type SelectOption } from '../components/SelectField';
import { useReportDraft } from '../context/ReportDraftContext';
import { useLocation, type UseLocation } from '../hooks/useLocation';
import { firstError, validateDraft, type DraftErrors } from '../lib/draft';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

const HAZARD_OPTIONS: SelectOption<HazardType>[] = HAZARD_TYPES.map(
  (value) => ({
    value,
    label: HAZARD_TYPE_LABELS[value],
  }),
);

const { descriptionMax } = HAZARD_REPORT_LIMITS;

export function ReportHazardScreen({
  navigation,
}: ScreenProps<'ReportHazard'>) {
  const { draft, update } = useReportDraft();
  const found = useLocation(draft.location === null);
  const [showErrors, setShowErrors] = useState(false);
  const descriptionRef = useRef<TextInput>(null);

  // Keep the fix with the draft, so it survives going back from the review screen.
  useEffect(() => {
    if (found.location && draft.location === null)
      update({ location: found.location });
  }, [found.location, draft.location, update]);

  const location: UseLocation = draft.location
    ? { ...found, status: 'ready', location: draft.location }
    : found;

  const errors: DraftErrors = showErrors ? validateDraft(draft) : {};
  if (errors.location && location.status === 'loading') {
    errors.location = 'Still finding your location. Please wait a moment.';
  }

  function review() {
    const found = validateDraft(draft);
    setShowErrors(true);

    const message = firstError(found);
    if (message) {
      AccessibilityInfo.announceForAccessibility(message);
      if (!found.type && found.description) descriptionRef.current?.focus();
      return;
    }
    navigation.navigate('ReviewReport');
  }

  return (
    <Screen footer={<Button title="Review report" onPress={review} />}>
      <Banner tone="warning">
        If this is a life-threatening emergency, call 117 (DMC), 119 (Police) or
        110 (Ambulance) immediately.
      </Banner>

      <SelectField
        label="Hazard Type"
        required
        placeholder="Select Type"
        value={draft.type}
        options={HAZARD_OPTIONS}
        onChange={(type) => update({ type })}
        error={errors.type}
      />

      <FormField
        label="Description"
        required
        error={errors.description}
        hint={`${draft.description.length} of ${descriptionMax} characters`}
      >
        <TextInput
          ref={descriptionRef}
          accessibilityLabel="Description"
          multiline
          maxLength={descriptionMax}
          placeholder="Describe what you see"
          placeholderTextColor={colors.textMuted}
          value={draft.description}
          onChangeText={(description) => update({ description })}
          style={[
            controlStyle(Boolean(errors.description)),
            styles.description,
          ]}
        />
      </FormField>

      <PhotoField
        photos={draft.photos}
        onChange={(photos) => update({ photos })}
      />

      <LocationField location={location} error={errors.location} />

      <View>
        <Text style={styles.note}>
          Your report is reviewed by the Disaster Management Centre before it is
          used.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  description: {
    minHeight: 110,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  note: { ...typography.helper, color: colors.textMuted },
});
