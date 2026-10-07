import { ApiError } from './client';
import {
  acknowledgeAlert,
  getMyProfile,
  listMyAlerts,
  saveMyProfile,
} from './alerts';

function respond(status: number, body?: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

describe('alerts API', () => {
  it('returns null when the district was never set', async () => {
    respond(404, {
      statusCode: 404,
      error: 'Not Found',
      message: 'Set your district to receive warnings',
    });
    await expect(getMyProfile()).resolves.toBeNull();
  });

  it('passes other failures on', async () => {
    respond(500, {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    await expect(getMyProfile()).rejects.toBeInstanceOf(ApiError);
  });

  it('saves the profile as JSON and reads alerts', async () => {
    const fetchMock = respond(200, {
      district: 'KANDY',
      updatedAt: '2026-10-07T00:00:00Z',
    });
    await saveMyProfile({ district: 'KANDY' });
    await listMyAlerts();
    await acknowledgeAlert('w 1');

    expect(
      fetchMock.mock.calls.map(
        ([url, init]) => `${init.method ?? 'GET'} ${url}`,
      ),
    ).toEqual([
      'PUT http://localhost:3000/api/citizens/me',
      'GET http://localhost:3000/api/alerts/mine',
      'POST http://localhost:3000/api/alerts/w%201/acknowledge',
    ]);
  });
});
