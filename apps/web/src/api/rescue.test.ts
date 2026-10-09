import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRescueAssignment,
  fetchActiveEvents,
  fetchEventDistricts,
  fetchRescueTeams,
  updateMissionStatus,
} from './rescue';

describe('Rescue API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchActiveEvents requests active disaster events', async () => {
    const mockData = [{ id: '1', name: 'Kelani River Flood Wave' }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchActiveEvents();
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rescue/events/active'),
      expect.anything(),
    );
  });

  it('fetchEventDistricts requests affected districts for an event', async () => {
    const mockData = {
      event: { id: 'EV-1', name: 'Flood' },
      districts: [{ districtCode: 'Gampaha', districtName: 'Gampaha' }],
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchEventDistricts('EV-1');
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rescue/events/EV-1/districts'),
      expect.anything(),
    );
  });

  it('fetchRescueTeams passes query parameters', async () => {
    const mockData = [{ id: 'team-1', name: 'Team A' }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchRescueTeams('Gampaha', true);
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/districtCode=Gampaha.*includeExternal=true/),
      expect.anything(),
    );
  });

  it('createRescueAssignment sends POST payload', async () => {
    const mockAssignment = {
      id: 'RA-001',
      missionId: 'RA-001',
      rescueTeamName: 'Team A',
      status: 'ASSIGNED',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockAssignment),
    });

    const payload = {
      disasterEventId: 'EV-1',
      districtCode: 'Gampaha',
      rescueTeamId: 'team-1',
      emergencyLocation: 'Riverside Area',
    };

    const result = await createRescueAssignment(payload);
    expect(result).toEqual(mockAssignment);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rescue/assignments'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
  });

  it('updateMissionStatus sends PATCH payload', async () => {
    const mockUpdated = {
      id: 'RA-001',
      status: 'EN_ROUTE',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockUpdated),
    });

    const result = await updateMissionStatus('RA-001', {
      status: 'EN_ROUTE' as any,
    });
    expect(result).toEqual(mockUpdated);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/rescue/missions/RA-001/status'),
      expect.objectContaining({
        method: 'PATCH',
      }),
    );
  });
});
