import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import {
  DISTRICT_KEYS,
  districtName,
  normalizeSriLankanMobile,
  type District,
} from '@repo/types';

import { describeError } from '../api/client';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { controlStyle, FormField } from '../components/FormField';
import { Screen } from '../components/Screen';
import { SelectField } from '../components/SelectField';
import { useAlerts } from '../context/AlertsContext';
import { formatLocalMobile } from '../lib/alerts';
import { colors, spacing, typography } from '../theme';

const OPTIONS = [...DISTRICT_KEYS]
  .map((value) => ({ value, label: districtName(value) }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** The citizen's alert area (finding UI5): warnings are targeted by this district. */
export function ProfileScreen() {
  const { profile, saveProfile } = useAlerts();
  const [district, setDistrict] = useState<District | null>(
    profile?.district ?? null,
  );
  const [phone, setPhone] = useState(
    profile?.phone ? formatLocalMobile(profile.phone) : '',
  );
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<{ district?: string; phone?: string }>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  // The saved profile can arrive after the screen opens; fill in only if the citizen has not started typing.
  useEffect(() => {
    if (!profile || touched) return;
    setDistrict(profile.district);
    setPhone(profile.phone ? formatLocalMobile(profile.phone) : '');
  }, [profile, touched]);

  async function save() {
    const normalized =
      phone.trim() === '' ? undefined : normalizeSriLankanMobile(phone);
    const next: typeof errors = {};
    if (!district) next.district = 'Choose your district.';
    if (normalized === null)
      next.phone = 'Enter a Sri Lankan mobile number, such as 077 123 4567.';
    setErrors(next);
    if (!district || normalized === null) return;

    setSaving(true);
    setMessage(null);
    try {
      await saveProfile({ district, ...(normalized && { phone: normalized }) });
      setMessage({
        tone: 'success',
        text: `Saved. You will get warnings for ${districtName(district)}.`,
      });
    } catch (error) {
      setMessage({ tone: 'danger', text: describeError(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <Button title="Save alert area" onPress={save} loading={saving} />
      }
    >
      <Text accessibilityRole="header" style={styles.title}>
        Alert Area
      </Text>
      <Text style={styles.text}>
        We only send you warnings for this district. Choose where you live or
        are staying now.
      </Text>

      {message && <Banner tone={message.tone}>{message.text}</Banner>}

      <SelectField
        label="District"
        required
        placeholder="Choose your district"
        value={district}
        options={OPTIONS}
        error={errors.district}
        onChange={(value) => {
          setTouched(true);
          setDistrict(value);
          setErrors((current) => ({ ...current, district: undefined }));
        }}
      />

      <FormField
        label="Mobile number for SMS"
        error={errors.phone}
        hint="Optional. Warnings also come by SMS when the app is closed."
      >
        <TextInput
          accessibilityLabel="Mobile number for SMS"
          keyboardType="phone-pad"
          placeholder="077 123 4567"
          placeholderTextColor={colors.textMuted}
          value={phone}
          onChangeText={(text) => {
            setTouched(true);
            setPhone(text);
            setErrors((current) => ({ ...current, phone: undefined }));
          }}
          style={[controlStyle(Boolean(errors.phone)), styles.input]}
        />
      </FormField>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.screenTitle, color: colors.text },
  text: { ...typography.body, fontSize: 14, color: colors.textMuted },
  input: { minHeight: 48, paddingVertical: spacing.sm },
});
