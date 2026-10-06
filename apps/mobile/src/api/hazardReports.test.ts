import { File } from 'expo-file-system';

import { resetReporterIdCache } from '../storage/reporterId';
import { NetworkError } from './client';
import { submitHazardReport, type SubmitInput } from './hazardReports';

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    bytes: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    uri,
  })),
}));

const input: SubmitInput = {
  clientRequestId: '00000000-0000-4000-8000-000000000001',
  type: 'FLOOD',
  description: '  Water is rising near the bridge  ',
  location: { latitude: 7.2906, longitude: 80.6337 },
  photos: [{ uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg' }],
};

function respond(status: number, body: unknown = { id: 'r1' }) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status < 300,
    status,
    json: async () => body,
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

/**
 * Jest runs on Node, whose FormData turns a React Native file part
 * ({ uri, name, type }) into the text "[object Object]". This stand-in just
 * records what was appended, so the test can see the real part.
 */
class RecordingFormData {
  readonly parts: [string, unknown][] = [];

  append(name: string, value: unknown) {
    this.parts.push([name, value]);
  }
}

const realFormData = globalThis.FormData;

function parts(body: unknown): [string, unknown][] {
  return (body as RecordingFormData).parts;
}

describe('submitHazardReport', () => {
  beforeEach(() => {
    resetReporterIdCache();
    globalThis.FormData = RecordingFormData as unknown as typeof FormData;
  });

  afterEach(() => {
    globalThis.FormData = realFormData;
  });

  it('posts the fields and photos as multipart to the reports endpoint', async () => {
    const fetchMock = respond(201);

    await submitHazardReport(input);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/hazard-reports$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(RecordingFormData);
    expect(
      Object.fromEntries(
        parts(init.body).filter(([name]) => name !== 'photos'),
      ),
    ).toEqual({
      clientRequestId: input.clientRequestId,
      type: 'FLOOD',
      description: 'Water is rising near the bridge',
      latitude: '7.2906',
      longitude: '80.6337',
    });
  });

  it('attaches each photo as a part Expo fetch can upload: named, typed, and readable as bytes', async () => {
    const fetchMock = respond(201);

    await submitHazardReport(input);

    const photos = parts(fetchMock.mock.calls[0][1].body).filter(
      ([name]) => name === 'photos',
    );
    expect(photos).toHaveLength(1);
    const part = photos[0]![1] as {
      name: string;
      type: string;
      bytes: () => Promise<Uint8Array>;
      uri?: string;
    };
    expect(part.name).toBe('a.jpg');
    expect(part.type).toBe('image/jpeg');
    // The shape React Native used, which Expo's fetch rejects outright.
    expect(part).not.toHaveProperty('uri');
  });

  it('reads the photo from its file only when the request body is built', async () => {
    const fetchMock = respond(201);

    await submitHazardReport(input);
    const part = parts(fetchMock.mock.calls[0][1].body).find(
      ([name]) => name === 'photos',
    )![1] as { bytes: () => Promise<Uint8Array> };
    expect(File).not.toHaveBeenCalled();

    const bytes = await part.bytes();

    expect(File).toHaveBeenCalledWith('file:///a.jpg');
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it('sends no photo parts for a report without photos', async () => {
    const fetchMock = respond(201);

    await submitHazardReport({ ...input, photos: [] });

    expect(
      parts(fetchMock.mock.calls[0][1].body).some(
        ([name]) => name === 'photos',
      ),
    ).toBe(false);
  });

  it('reports a 201 as newly created', async () => {
    respond(201, { id: 'r1', reference: 'HR-2026-0001' });

    const result = await submitHazardReport(input);

    expect(result.created).toBe(true);
    expect(result.report).toMatchObject({ reference: 'HR-2026-0001' });
  });

  it('reports a 200 as a replay of an earlier submission', async () => {
    respond(200);

    expect((await submitHazardReport(input)).created).toBe(false);
  });

  it('rejects with the API error for a refused report', async () => {
    respond(400, { statusCode: 400, error: 'Bad Request', message: 'bad' });

    await expect(submitHazardReport(input)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejects with a NetworkError when offline', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Network request failed'));

    await expect(submitHazardReport(input)).rejects.toBeInstanceOf(
      NetworkError,
    );
  });
});
