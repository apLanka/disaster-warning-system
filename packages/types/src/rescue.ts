export const RESCUE_TEAM_STATUS = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export type RescueTeamStatus =
  (typeof RESCUE_TEAM_STATUS)[keyof typeof RESCUE_TEAM_STATUS];

export const RESCUE_ELIGIBILITY = {
  ELIGIBLE: 'ELIGIBLE',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  CROSS_DISTRICT_ALLOWED: 'CROSS_DISTRICT_ALLOWED',
} as const;

export type RescueEligibility =
  (typeof RESCUE_ELIGIBILITY)[keyof typeof RESCUE_ELIGIBILITY];

export const MISSION_STATUS = {
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN_ROUTE',
  ON_SCENE: 'ON_SCENE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type MissionStatus =
  (typeof MISSION_STATUS)[keyof typeof MISSION_STATUS];

export interface ActiveDisasterEventSummary {
  id: string;
  eventId: string;
  name: string;
  hazardType: string;
  badge: string; // e.g. "Escalated"
  affectedDistrictsCount: number;
  warningLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  responseAction: string; // e.g. "Rescue deployment required"
  updatedAt: string;
}

export interface AffectedDistrictInfo {
  districtCode: string;
  districtName: string;
  warningLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  responseStatus: string; // e.g. "Monitoring", "Requires Response"
  rescueNeed: string; // e.g. "Not required", "Rescue deployment required"
  selected?: boolean;
}

export interface RescueTeamItem {
  id: string;
  teamCode: string;
  name: string;
  organization: string;
  districtCode: string;
  districtName: string;
  currentStatus: RescueTeamStatus;
  eligibility: RescueEligibility;
  contactNumber?: string;
  leaderName?: string;
  allowsCrossDistrict: boolean;
  activeMissionId?: string;
  activeAssignmentId?: string;
}

export interface RescueAssignment {
  id: string;
  missionId: string; // e.g. "RA-001"
  disasterEventId: string;
  disasterEventName: string;
  districtCode: string;
  districtName: string;
  rescueTeamId: string;
  rescueTeamName: string;
  organization: string;
  emergencyLocation: string;
  assignedBy: string;
  status: MissionStatus;
  assignedAt: string;
  updatedAt: string;
  notes?: string;
  syncStatus?: 'SYNCHRONIZED' | 'PENDING_OFFLINE';
}

export interface CreateRescueAssignmentDto {
  disasterEventId: string;
  districtCode: string;
  rescueTeamId: string;
  emergencyLocation: string;
  assignedBy?: string;
}

export interface UpdateMissionStatusDto {
  status: MissionStatus;
  notes?: string;
  leaderId?: string;
}

export interface DispatchValidationResult {
  valid: boolean;
  eventId: string;
  districtCode: string;
  rescueTeamId: string;
  emergencyLocation: string;
  error?: string;
}

export interface EventResponseStatusSummary {
  eventId: string;
  eventName: string;
  totalAssignments: number;
  activeDeployments: number;
  missions: RescueAssignment[];
  lastSynchronizedAt: string;
}
