import * as ImagePicker from 'expo-image-picker';

import { HAZARD_REPORT_LIMITS } from '@repo/types';

import type { PickedPhoto } from './draft';

export interface PhotoPickResult {
  photos: PickedPhoto[];
  /** Plain-language problem to show, if something was refused or went wrong. */
  error?: string;
}

const allowedTypes: readonly string[] = HAZARD_REPORT_LIMITS.photoMimeTypes;
const MAX_MB = HAZARD_REPORT_LIMITS.photoMaxBytes / (1024 * 1024);

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function guessMimeType(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const extension = asset.uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  return (extension && EXTENSION_TYPES[extension]) || 'image/jpeg';
}

/** Keeps the usable photos and explains why any others were left out. */
export function toPickedPhotos(
  assets: ImagePicker.ImagePickerAsset[],
  now: () => number = Date.now,
): PhotoPickResult {
  const photos: PickedPhoto[] = [];
  let refused: string | undefined;

  assets.forEach((asset, index) => {
    const mimeType = guessMimeType(asset);
    if (!allowedTypes.includes(mimeType)) {
      refused = 'Photos must be JPEG, PNG, or WebP images.';
    } else if (
      asset.fileSize !== undefined &&
      asset.fileSize > HAZARD_REPORT_LIMITS.photoMaxBytes
    ) {
      refused = `A photo is larger than ${MAX_MB} MB. Choose a smaller one.`;
    } else {
      photos.push({
        uri: asset.uri,
        mimeType,
        fileName: asset.fileName ?? `photo-${now()}-${index}.jpg`,
        fileSize: asset.fileSize,
      });
    }
  });

  return { photos, error: refused };
}

const PICKER_OPTIONS = { mediaTypes: ['images' as const], quality: 0.7 };

export async function takePhoto(): Promise<PhotoPickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return {
      photos: [],
      error: 'Camera access is off. Turn it on in Settings to take a photo.',
    };
  }

  const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  return result.canceled ? { photos: [] } : toPickedPhotos(result.assets);
}

export async function choosePhotos(limit: number): Promise<PhotoPickResult> {
  if (limit <= 0) {
    return {
      photos: [],
      error: `You can add up to ${HAZARD_REPORT_LIMITS.photosMax} photos.`,
    };
  }

  // No permission request here: the system photo picker only hands over the
  // photos the user chooses, so asking for the whole library would be needless.
  const result = await ImagePicker.launchImageLibraryAsync({
    ...PICKER_OPTIONS,
    allowsMultipleSelection: true,
    selectionLimit: limit,
  });
  return result.canceled ? { photos: [] } : toPickedPhotos(result.assets);
}
