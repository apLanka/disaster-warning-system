import * as ImagePicker from 'expo-image-picker';

import { HAZARD_REPORT_LIMITS } from '@repo/types';

import { choosePhotos, takePhoto, toPickedPhotos } from './photos';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const picker = jest.mocked(ImagePicker);

type Asset = ImagePicker.ImagePickerAsset;
function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    uri: 'file:///photo.jpg',
    width: 100,
    height: 100,
    mimeType: 'image/jpeg',
    fileName: 'photo.jpg',
    fileSize: 1000,
    ...overrides,
  } as Asset;
}

describe('toPickedPhotos', () => {
  it('keeps a good photo with its details', () => {
    expect(toPickedPhotos([asset()])).toEqual({
      photos: [
        {
          uri: 'file:///photo.jpg',
          mimeType: 'image/jpeg',
          fileName: 'photo.jpg',
          fileSize: 1000,
        },
      ],
      error: undefined,
    });
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])(
    'accepts %s',
    (mimeType) => {
      expect(toPickedPhotos([asset({ mimeType })]).photos).toHaveLength(1);
    },
  );

  it.each(['image/gif', 'application/pdf', 'video/mp4', 'image/heic'])(
    'refuses %s with a clear reason',
    (mimeType) => {
      const result = toPickedPhotos([asset({ mimeType })]);

      expect(result.photos).toEqual([]);
      expect(result.error).toBe('Photos must be JPEG, PNG, or WebP images.');
    },
  );

  it('refuses a photo over the size limit, and says the limit', () => {
    const result = toPickedPhotos([
      asset({ fileSize: HAZARD_REPORT_LIMITS.photoMaxBytes + 1 }),
    ]);

    expect(result.photos).toEqual([]);
    expect(result.error).toBe(
      'A photo is larger than 5 MB. Choose a smaller one.',
    );
  });

  it('accepts a photo exactly at the size limit', () => {
    expect(
      toPickedPhotos([asset({ fileSize: HAZARD_REPORT_LIMITS.photoMaxBytes })])
        .photos,
    ).toHaveLength(1);
  });

  it('accepts a photo whose size is not reported', () => {
    expect(
      toPickedPhotos([asset({ fileSize: undefined })]).photos,
    ).toHaveLength(1);
  });

  it('keeps the good photos and still explains about the bad one', () => {
    const result = toPickedPhotos([
      asset({ uri: 'file:///a.jpg' }),
      asset({ uri: 'file:///b.gif', mimeType: 'image/gif' }),
    ]);

    expect(result.photos.map((photo) => photo.uri)).toEqual(['file:///a.jpg']);
    expect(result.error).toBeDefined();
  });

  it('works out the type from the file extension when the picker does not say', () => {
    const result = toPickedPhotos([
      asset({ mimeType: undefined, uri: 'file:///x/photo.PNG?cache=1' }),
    ]);

    expect(result.photos[0]?.mimeType).toBe('image/png');
  });

  it('assumes JPEG for an unknown extension, as camera photos are', () => {
    expect(
      toPickedPhotos([asset({ mimeType: undefined, uri: 'file:///x/photo' })])
        .photos[0]?.mimeType,
    ).toBe('image/jpeg');
  });

  it('gives a photo with no file name a unique name', () => {
    const result = toPickedPhotos(
      [
        asset({ fileName: null }),
        asset({ fileName: null, uri: 'file:///b.jpg' }),
      ],
      () => 1700000000000,
    );

    expect(result.photos.map((photo) => photo.fileName)).toEqual([
      'photo-1700000000000-0.jpg',
      'photo-1700000000000-1.jpg',
    ]);
  });
});

describe('takePhoto', () => {
  it('explains that camera access is off, without opening the camera', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
    } as never);

    const result = await takePhoto();

    expect(result.photos).toEqual([]);
    expect(result.error).toMatch(/Camera access is off/);
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('returns the photo that was taken', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: true,
    } as never);
    picker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [asset()],
    } as never);

    expect((await takePhoto()).photos).toHaveLength(1);
  });

  it('returns nothing, and no error, when the citizen cancels', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: true,
    } as never);
    picker.launchCameraAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    } as never);

    expect(await takePhoto()).toEqual({ photos: [] });
  });
});

describe('choosePhotos', () => {
  it('refuses when the photo limit is already reached', async () => {
    const result = await choosePhotos(0);

    expect(result.photos).toEqual([]);
    expect(result.error).toBe('You can add up to 5 photos.');
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('lets the citizen pick several, up to what is left', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [asset(), asset({ uri: 'file:///b.jpg' })],
    } as never);

    const result = await choosePhotos(3);

    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsMultipleSelection: true,
        selectionLimit: 3,
      }),
    );
    expect(result.photos).toHaveLength(2);
  });

  it('does not ask for access to the whole library, since the system picker only hands over what is chosen', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    } as never);

    await choosePhotos(5);

    expect(Object.keys(picker)).not.toContain(
      'requestMediaLibraryPermissionsAsync',
    );
  });

  it('returns nothing when the citizen cancels', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    } as never);

    expect(await choosePhotos(5)).toEqual({ photos: [] });
  });
});
