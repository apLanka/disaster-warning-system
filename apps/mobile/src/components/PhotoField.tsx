import { Camera, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { HAZARD_REPORT_LIMITS } from '@repo/types';

import type { PickedPhoto } from '../lib/draft';
import { choosePhotos, takePhoto, type PhotoPickResult } from '../lib/photos';
import { colors, radius, spacing, TOUCH_TARGET } from '../theme';
import { FormField } from './FormField';

interface PhotoFieldProps {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
}

const { photosMax } = HAZARD_REPORT_LIMITS;

/** Optional photo evidence: add from the camera or library, preview, and remove. */
export function PhotoField({ photos, onChange }: PhotoFieldProps) {
  const [problem, setProblem] = useState<string | undefined>();
  const full = photos.length >= photosMax;

  async function add(pick: () => Promise<PhotoPickResult>) {
    const { photos: picked, error } = await pick();
    setProblem(error);
    if (picked.length > 0) onChange([...photos, ...picked].slice(0, photosMax));
  }

  function askHow() {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: () => void add(takePhoto) },
      {
        text: 'Choose from library',
        onPress: () => void add(() => choosePhotos(photosMax - photos.length)),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function remove(index: number) {
    setProblem(undefined);
    onChange(photos.filter((_, position) => position !== index));
  }

  return (
    <FormField
      label="Photo (Optional)"
      error={problem}
      hint={`${photos.length} of ${photosMax} added`}
    >
      {photos.length > 0 && (
        <View style={styles.strip}>
          {photos.map((photo, index) => (
            <View key={photo.uri} style={styles.thumbWrap}>
              <Image
                source={{ uri: photo.uri }}
                accessibilityLabel={`Photo ${index + 1}`}
                style={styles.thumb}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                onPress={() => remove(index)}
                hitSlop={8}
                style={styles.remove}
              >
                <X size={16} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {!full && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            photos.length === 0 ? 'Add a photo' : 'Add another photo'
          }
          onPress={askHow}
          style={styles.add}
        >
          <Camera size={28} color={colors.textMuted} />
          <Text style={styles.addText}>Tap to add photo</Text>
        </Pressable>
      )}
    </FormField>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { width: 88, height: 88 },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: radius.control,
    backgroundColor: colors.neutralTint,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    minHeight: TOUCH_TARGET * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  addText: { fontSize: 14, color: colors.textMuted },
});
