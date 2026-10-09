import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import { RescueService } from './rescue.service.js';

describe('RescueService', () => {
  let service: RescueService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      disasterEvent: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
        create: (args: any) =>
          Promise.resolve({
            id: 'mock-event-id',
            eventId: args.data.eventId,
            name: args.data.name,
            hazardType: args.data.hazardType,
            districtCodes: args.data.districtCodes,
            status: args.data.status,
            updatedAt: new Date(),
          }),
      },
      rescueTeam: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
        create: (args: any) =>
          Promise.resolve({
            id: 'mock-team-a-id',
            teamCode: args.data.teamCode,
            name: args.data.name,
            organization: args.data.organization,
            districtCode: args.data.districtCode,
            status: args.data.status,
            allowsCrossDistrict: args.data.allowsCrossDistrict,
          }),
        update: (args: any) =>
          Promise.resolve({ id: args.where.id, ...args.data }),
      },
      rescueAssignment: {
        count: () => Promise.resolve(0),
        findFirst: () => Promise.resolve(null),
        create: (args: any) =>
          Promise.resolve({
            id: 'mock-assign-id',
            missionId: args.data.missionId,
            disasterEventId: args.data.disasterEventId,
            disasterEventName: args.data.disasterEventName,
            districtCode: args.data.districtCode,
            districtName: args.data.districtName,
            rescueTeamId: args.data.rescueTeamId,
            rescueTeamName: args.data.rescueTeamName,
            organization: args.data.organization,
            emergencyLocation: args.data.emergencyLocation,
            assignedBy: args.data.assignedBy,
            status: args.data.status,
            assignedAt: new Date(),
            updatedAt: new Date(),
          }),
        update: (args: any) =>
          Promise.resolve({
            id: args.where.id,
            missionId: 'RA-001',
            disasterEventId: 'event-1',
            disasterEventName: 'Flood Warning',
            districtCode: 'Gampaha',
            districtName: 'Gampaha',
            rescueTeamId: 'team-1',
            rescueTeamName: 'Team A',
            organization: 'DMC',
            emergencyLocation: 'Riverside Area, Gampaha',
            assignedBy: 'Duty Officer',
            assignedAt: new Date(),
            updatedAt: new Date(),
            ...args.data,
          }),
      },
      $transaction: (fn: (tx: any) => Promise<any>) => fn(mockPrisma),
    };

    service = new RescueService(mockPrisma as any);
  });

  describe('getActiveEvents', () => {
    it('returns default active event summary if none in database', async () => {
      const events = await service.getActiveEvents();
      expect(events).toHaveLength(4);
      expect(events[0]!.name).toContain('Flood Warning');
      expect(events[0]!.warningLevel).toBe('HIGH');
      expect(events.some((e) => e.warningLevel === 'CRITICAL')).toBe(true);
      expect(events.some((e) => e.warningLevel === 'MEDIUM')).toBe(true);
    });
  });

  describe('getEventDistricts', () => {
    it('returns affected districts list for active event', async () => {
      const res = await service.getEventDistricts('EV-2026-FLOOD-01');
      expect(res.districts).toHaveLength(3);
      expect(res.districts.map((d) => d.districtName)).toContain('Gampaha');
      expect(res.districts.map((d) => d.districtName)).toContain('Colombo');
    });
  });

  describe('createAssignment', () => {
    it('rejects with BadRequestException if emergency location is empty', async () => {
      await expect(
        service.createAssignment({
          disasterEventId: 'mock-event-id',
          districtCode: 'Gampaha',
          rescueTeamId: 'mock-team-a',
          emergencyLocation: '  ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects with ConflictException if selected team is already ASSIGNED (Alternate Flow A1)', async () => {
      mockPrisma.rescueTeam.findFirst = () =>
        Promise.resolve({
          id: 'team-b-id',
          teamCode: 'TEAM-B',
          name: 'Team B',
          organization: 'Armed Forces',
          districtCode: 'Gampaha',
          status: 'ASSIGNED',
          allowsCrossDistrict: false,
        });

      await expect(
        service.createAssignment({
          disasterEventId: 'mock-event-id',
          districtCode: 'Gampaha',
          rescueTeamId: 'team-b-id',
          emergencyLocation: 'Riverside Area, Gampaha',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects with BadRequestException if team is not in district and cross-district support is disallowed (Alternate Flow A3)', async () => {
      mockPrisma.rescueTeam.findFirst = () =>
        Promise.resolve({
          id: 'team-x-id',
          teamCode: 'TEAM-X',
          name: 'Team X',
          organization: 'Local Militia',
          districtCode: 'Kandy',
          status: 'AVAILABLE',
          allowsCrossDistrict: false,
        });

      await expect(
        service.createAssignment({
          disasterEventId: 'mock-event-id',
          districtCode: 'Gampaha',
          rescueTeamId: 'team-x-id',
          emergencyLocation: 'Riverside Area, Gampaha',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('atomically creates assignment and marks team ASSIGNED on success (Main Flow Step 10 & SQ2)', async () => {
      mockPrisma.rescueTeam.findFirst = () =>
        Promise.resolve({
          id: 'team-a-id',
          teamCode: 'TEAM-A',
          name: 'Team A',
          organization: 'DMC',
          districtCode: 'Gampaha',
          status: 'AVAILABLE',
          allowsCrossDistrict: false,
        });

      mockPrisma.disasterEvent.findFirst = () =>
        Promise.resolve({
          id: 'event-flood-id',
          eventId: 'EV-2026-FLOOD-01',
          name: 'Flood Warning',
          hazardType: 'FLOOD',
          status: 'ACTIVE',
        });

      const assignment = await service.createAssignment({
        disasterEventId: 'event-flood-id',
        districtCode: 'Gampaha',
        rescueTeamId: 'team-a-id',
        emergencyLocation: 'Riverside Area, Gampaha',
      });

      expect(assignment.missionId).toBe('RA-001');
      expect(assignment.rescueTeamName).toBe('Team A');
      expect(assignment.status).toBe('ASSIGNED');
      expect(assignment.timeline).toBeDefined();
      expect(assignment.timeline![0]!.status).toBe('ASSIGNED');
    });

    it('throws custom message when assignment storage fails (SQ7)', async () => {
      mockPrisma.rescueTeam.findFirst = () =>
        Promise.resolve({
          id: 'team-a-id',
          teamCode: 'TEAM-A',
          name: 'Team A',
          organization: 'DMC',
          districtCode: 'Gampaha',
          status: 'AVAILABLE',
          allowsCrossDistrict: false,
        });

      mockPrisma.disasterEvent.findFirst = () =>
        Promise.resolve({
          id: 'event-flood-id',
          eventId: 'EV-2026-FLOOD-01',
          name: 'Flood Warning',
          hazardType: 'FLOOD',
          status: 'ACTIVE',
        });

      mockPrisma.rescueAssignment.create = () => {
        throw new Error('DB write failure');
      };

      await expect(
        service.createAssignment({
          disasterEventId: 'event-flood-id',
          districtCode: 'Gampaha',
          rescueTeamId: 'team-a-id',
          emergencyLocation: 'Riverside Area, Gampaha',
        }),
      ).rejects.toThrow('Rescue assignment could not be saved. Please retry.');
    });
  });

  describe('validateDispatch (SQ1)', () => {
    it('rejects when emergency location is missing', async () => {
      await expect(
        service.validateDispatch({
          eventId: 'EV-2026-FLOOD-01',
          districtId: 'Gampaha',
          teamId: 'team-1',
          emergencyLocation: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when team is not available', async () => {
      mockPrisma.rescueTeam.findFirst = () =>
        Promise.resolve({
          id: 'team-busy',
          teamCode: 'TEAM-B',
          name: 'Team B',
          organization: 'DMC',
          districtCode: 'Gampaha',
          status: 'ASSIGNED',
          allowsCrossDistrict: false,
        });

      await expect(
        service.validateDispatch({
          eventId: 'EV-2026-FLOOD-01',
          districtId: 'Gampaha',
          teamId: 'team-busy',
          emergencyLocation: '123 River Road',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('returns valid: true when event, district, and team are eligible and available', async () => {
      mockPrisma.rescueTeam.findFirst = () =>
        Promise.resolve({
          id: 'team-ready',
          teamCode: 'TEAM-A',
          name: 'Team A',
          organization: 'DMC',
          districtCode: 'Gampaha',
          status: 'AVAILABLE',
          allowsCrossDistrict: false,
        });

      const res = await service.validateDispatch({
        eventId: 'EV-2026-FLOOD-01',
        districtId: 'Gampaha',
        teamId: 'team-ready',
        emergencyLocation: '123 River Road',
      });
      expect(res.valid).toBe(true);
      expect(res.emergencyLocation).toBe('123 River Road');
    });
  });

  describe('updateMissionStatus & validateMissionStatusUpdate (SQ5)', () => {
    it('updates mission status to EN_ROUTE for authorized leader', async () => {
      mockPrisma.rescueAssignment.findFirst = () =>
        Promise.resolve({
          id: 'assign-1',
          missionId: 'RA-001',
          disasterEventId: 'event-1',
          disasterEventName: 'Flood Warning',
          districtCode: 'Gampaha',
          districtName: 'Gampaha',
          rescueTeamId: 'team-1',
          rescueTeamName: 'Team A',
          organization: 'DMC',
          emergencyLocation: 'Riverside Area, Gampaha',
          assignedBy: 'Duty Officer',
          status: 'ASSIGNED',
          assignedAt: new Date(),
          updatedAt: new Date(),
        });

      const updated = await service.updateMissionStatus('assign-1', {
        status: 'EN_ROUTE',
        leaderId: 'leader-squad-1',
        notes: 'Departed base',
      });

      expect(updated.status).toBe('EN_ROUTE');
      expect(updated.timeline).toBeDefined();
      expect(updated.timeline!.length).toBeGreaterThan(0);
      expect(updated.timeline![updated.timeline!.length - 1]!.status).toBe(
        'EN_ROUTE',
      );
    });

    it('rejects invalid status transitions', async () => {
      mockPrisma.rescueAssignment.findFirst = () =>
        Promise.resolve({
          id: 'assign-1',
          missionId: 'RA-001',
          disasterEventId: 'event-1',
          disasterEventName: 'Flood Warning',
          districtCode: 'Gampaha',
          districtName: 'Gampaha',
          rescueTeamId: 'team-1',
          rescueTeamName: 'Team A',
          organization: 'DMC',
          emergencyLocation: 'Riverside Area, Gampaha',
          assignedBy: 'Duty Officer',
          status: 'COMPLETED',
          assignedAt: new Date(),
          updatedAt: new Date(),
        });

      await expect(
        service.updateMissionStatus('assign-1', {
          status: 'EN_ROUTE',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getResponseStatus (SQ8)', () => {
    it('returns event response status summary for live monitoring', async () => {
      mockPrisma.disasterEvent.findFirst = () =>
        Promise.resolve({
          id: 'event-1',
          eventId: 'EV-2026-FLOOD-01',
          name: 'Flood Warning',
          hazardType: 'FLOOD',
          status: 'ACTIVE',
        });

      const summary = await service.getResponseStatus('EV-2026-FLOOD-01');
      expect(summary.eventId).toBe('EV-2026-FLOOD-01');
      expect(summary.activeDeployments).toBeDefined();
    });
  });
});
