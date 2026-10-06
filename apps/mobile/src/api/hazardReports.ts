import { File } from 'expo-file-system';

import type {
  CreateHazardReportFields,
  GeoLocation,
  HazardPhoto,
  HazardReportDto,
  HazardType,
} from '@repo/types';

import { request } from './client';

export interface SubmitPhoto {
  uri: string;
  mimeType: string;
  fileName: string;
}

export interface SubmitInput {
  clientRequestId: string;
  type: HazardType;
  description: string;
  location: GeoLocation;
  photos: SubmitPhoto[];
}

export interface SubmitResult {
  report: HazardReportDto;
  /** False when the server had already stored this request (a replay). */
  created: boolean;
}

export type { HazardPhoto };

/**
 * Expo's fetch cannot upload React Native's `{ uri, name, type }` file parts.
 * It accepts a Blob or any object with `bytes()`, so the photo is described by
 * its name and type and read from disk only when the request is built.
 */
function toFilePart(photo: SubmitPhoto): Blob {
  return {
    name: photo.fileName,
    type: photo.mimeType,
    bytes: () => new File(photo.uri).bytes(),
  } as unknown as Blob;
}

export async function submitHazardReport(
  input: SubmitInput,
  signal?: AbortSignal,
): Promise<SubmitResult> {
  const fields: Record<keyof CreateHazardReportFields, string | undefined> = {
    clientRequestId: input.clientRequestId,
    type: input.type,
    description: input.description.trim(),
    latitude: String(input.location.latitude),
    longitude: String(input.location.longitude),
    reporterName: undefined,
    reporterContact: undefined,
  };

  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) body.append(name, value);
  }
  for (const photo of input.photos) body.append('photos', toFilePart(photo));

  const { status, data } = await request<HazardReportDto>(
    '/api/hazard-reports',
    {
      method: 'POST',
      body,
      signal,
    },
  );
  return { report: data, created: status === 201 };
}
