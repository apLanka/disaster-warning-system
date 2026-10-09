import type {
  ActiveDisasterEventSummary,
  AffectedDistrictInfo,
  CreateRescueAssignmentDto,
  DispatchValidationResult,
  EventResponseStatusSummary,
  RescueAssignment,
  RescueTeamItem,
  UpdateMissionStatusDto,
} from '@repo/types';

import { request } from './client';

export async function fetchActiveEvents(): Promise<
  ActiveDisasterEventSummary[]
> {
  return request<ActiveDisasterEventSummary[]>('/api/rescue/events/active');
}

export async function fetchEventDistricts(eventId: string): Promise<{
  event: ActiveDisasterEventSummary;
  districts: AffectedDistrictInfo[];
}> {
  return request<{
    event: ActiveDisasterEventSummary;
    districts: AffectedDistrictInfo[];
  }>(`/api/rescue/events/${encodeURIComponent(eventId)}/districts`);
}

export async function fetchEventResponseStatus(
  eventId: string,
): Promise<EventResponseStatusSummary> {
  return request<EventResponseStatusSummary>(
    `/api/rescue/events/${encodeURIComponent(eventId)}/response-status`,
  );
}

export async function validateDispatch(dto: {
  disasterEventId: string;
  districtCode: string;
  rescueTeamId: string;
  emergencyLocation: string;
}): Promise<DispatchValidationResult> {
  return request<DispatchValidationResult>('/api/rescue/validate-dispatch', {
    method: 'POST',
    body: dto,
  });
}

export const validateDispatchDeployment = validateDispatch;

export async function fetchRescueTeams(
  districtCode?: string,
  includeExternal = false,
): Promise<RescueTeamItem[]> {
  const query = new URLSearchParams();
  if (districtCode) query.set('districtCode', districtCode);
  if (includeExternal) query.set('includeExternal', 'true');
  const qs = query.toString();
  return request<RescueTeamItem[]>(`/api/rescue/teams${qs ? `?${qs}` : ''}`);
}

export async function createRescueAssignment(
  dto: CreateRescueAssignmentDto,
): Promise<RescueAssignment> {
  return request<RescueAssignment>('/api/rescue/assignments', {
    method: 'POST',
    body: dto,
  });
}

export async function fetchMission(id: string): Promise<RescueAssignment> {
  return request<RescueAssignment>(
    `/api/rescue/missions/${encodeURIComponent(id)}`,
  );
}

export async function fetchLeaderMissions(
  leaderId = 'leader-squad-1',
): Promise<RescueAssignment[]> {
  return request<RescueAssignment[]>('/api/rescue/portal/missions', {
    headers: {
      'x-leader-id': leaderId,
    },
  });
}

export async function fetchLeaderMission(
  id: string,
  leaderId = 'leader-squad-1',
): Promise<RescueAssignment> {
  return request<RescueAssignment>(
    `/api/rescue/portal/missions/${encodeURIComponent(id)}`,
    {
      headers: {
        'x-leader-id': leaderId,
      },
    },
  );
}

export async function updateMissionStatus(
  id: string,
  dto: UpdateMissionStatusDto,
): Promise<RescueAssignment> {
  return request<RescueAssignment>(
    `/api/rescue/missions/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: dto,
    },
  );
}

// ---------------------------------------------------------------------------
// SQ6: Local Pending Status Queue & Offline Synchronization Support
// ---------------------------------------------------------------------------

const OFFLINE_QUEUE_KEY = 'dws_pending_mission_status_queue';

export interface PendingStatusUpdate {
  assignmentId: string;
  status: UpdateMissionStatusDto['status'];
  notes?: string;
  leaderId?: string;
  queuedAt: string;
}

export function getPendingStatusQueue(): PendingStatusUpdate[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function queueStatusUpdateLocally(
  assignmentId: string,
  dto: UpdateMissionStatusDto,
): void {
  try {
    const queue = getPendingStatusQueue();
    const filtered = queue.filter((item) => item.assignmentId !== assignmentId);
    filtered.push({
      assignmentId,
      status: dto.status,
      notes: dto.notes,
      leaderId: dto.leaderId,
      queuedAt: new Date().toISOString(),
    });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore storage quota
  }
}

export function removePendingStatusUpdate(assignmentId: string): void {
  try {
    const queue = getPendingStatusQueue();
    const updated = queue.filter((item) => item.assignmentId !== assignmentId);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

export async function syncPendingStatusUpdates(): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  const queue = getPendingStatusQueue();
  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    try {
      await updateMissionStatus(item.assignmentId, {
        status: item.status,
        notes: item.notes,
        leaderId: item.leaderId,
      });
      removePendingStatusUpdate(item.assignmentId);
      syncedCount++;
    } catch {
      failedCount++;
    }
  }

  return { syncedCount, failedCount };
}
