import { ApiError, NetworkError } from '../api/client';
import { submitHazardReport } from '../api/hazardReports';
import { deliverQueuedReport } from './deliver';
import type { QueuedReport } from './reportQueue';

jest.mock('../api/hazardReports');
const submit = jest.mocked(submitHazardReport);

const queued: QueuedReport = {
  id: 'id-1',
  type: 'FLOOD',
  description: 'Water is rising near the bridge',
  location: { latitude: 7.2906, longitude: 80.6337 },
  photos: [{ uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg' }],
  createdAt: '2026-10-05T10:00:00.000Z',
  attempts: 2,
  nextAttemptAt: 0,
};

describe('deliverQueuedReport', () => {
  beforeEach(() => submit.mockReset());

  it('sends the saved report with its original request id', async () => {
    submit.mockResolvedValue({ report: { id: 'r1' } as never, created: true });

    const result = await deliverQueuedReport(queued);

    expect(submit).toHaveBeenCalledWith({
      clientRequestId: 'id-1',
      type: 'FLOOD',
      description: 'Water is rising near the bridge',
      location: { latitude: 7.2906, longitude: 80.6337 },
      photos: queued.photos,
    });
    expect(result).toEqual({ kind: 'delivered', report: { id: 'r1' } });
  });

  it('counts a replay the server already knew about as delivered', async () => {
    submit.mockResolvedValue({ report: { id: 'r1' } as never, created: false });

    expect((await deliverQueuedReport(queued)).kind).toBe('delivered');
  });

  it('retries later when the phone is offline', async () => {
    submit.mockRejectedValue(new NetworkError());

    expect(await deliverQueuedReport(queued)).toEqual({ kind: 'retry' });
  });

  it.each([500, 502, 503])(
    'retries later on a %i server error',
    async (status) => {
      submit.mockRejectedValue(new ApiError(status, 'boom'));

      expect(await deliverQueuedReport(queued)).toEqual({ kind: 'retry' });
    },
  );

  it.each([408, 429])(
    'retries later on %i, which means "not now"',
    async (status) => {
      submit.mockRejectedValue(new ApiError(status, 'slow down'));

      expect(await deliverQueuedReport(queued)).toEqual({ kind: 'retry' });
    },
  );

  it.each([400, 409, 413, 415, 422])(
    'gives up on %i, which will never succeed',
    async (status) => {
      submit.mockRejectedValue(new ApiError(status, 'refused'));

      const result = await deliverQueuedReport(queued);

      expect(result.kind).toBe('rejected');
    },
  );

  it('gives the citizen plain words for a refusal', async () => {
    submit.mockRejectedValue(new ApiError(413, 'Payload Too Large'));

    expect(await deliverQueuedReport(queued)).toEqual({
      kind: 'rejected',
      message: expect.stringMatching(/photo is too large/),
    });
  });

  it('retries on a failure it does not recognise rather than losing the report', async () => {
    submit.mockRejectedValue(new Error('something odd'));

    expect(await deliverQueuedReport(queued)).toEqual({ kind: 'retry' });
  });
});
