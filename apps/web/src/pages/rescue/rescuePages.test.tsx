import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as rescueApi from '../../api/rescue';
import { ActiveEventsPage } from './ActiveEventsPage';
import { AffectedDistrictsPage } from './AffectedDistrictsPage';
import { AssignedMissionPage } from './AssignedMissionPage';
import { AvailableTeamsPage } from './AvailableTeamsPage';
import { DistrictDashboardPage } from './DistrictDashboardPage';
import { RescueTeamPortalPage } from './RescueTeamPortalPage';

vi.mock('../../api/rescue');

describe('District Officer Rescue Pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(rescueApi.getPendingStatusQueue).mockReturnValue([]);
  });

  describe('DistrictDashboardPage', () => {
    it('renders quick action tiles for district operations', () => {
      render(
        <MemoryRouter>
          <DistrictDashboardPage />
        </MemoryRouter>,
      );

      expect(
        screen.getByRole('heading', { name: 'District Operations Dashboard' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Active Disaster Events')).toBeInTheDocument();
      expect(screen.getByText('Rescue Operations')).toBeInTheDocument();
      expect(screen.getByText('District Shelters')).toBeInTheDocument();
      expect(screen.getByText('Emergency Resources')).toBeInTheDocument();
    });
  });

  describe('ActiveEventsPage', () => {
    it('renders list of active disaster events', async () => {
      vi.mocked(rescueApi.fetchActiveEvents).mockResolvedValue([
        {
          id: 'ev-1',
          eventId: 'EV-2026-FLOOD-01',
          name: 'Kelani River Flood Wave',
          warningLevel: 'HIGH',
          hazardType: 'FLOOD',
          badge: 'Escalated',
          affectedDistrictsCount: 3,
          responseAction: 'Rescue deployment required',
          updatedAt: '2026-10-06T12:00:00.000Z',
        },
      ]);

      render(
        <MemoryRouter>
          <ActiveEventsPage />
        </MemoryRouter>,
      );

      expect(
        await screen.findByText('Kelani River Flood Wave'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Rescue deployment required'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'View Event' }),
      ).toBeInTheDocument();
    });
  });

  describe('AffectedDistrictsPage', () => {
    it('renders affected districts table with action buttons', async () => {
      vi.mocked(rescueApi.fetchEventDistricts).mockResolvedValue({
        event: {
          id: 'ev-1',
          eventId: 'EV-2026-FLOOD-01',
          name: 'Kelani River Flood Wave',
          warningLevel: 'HIGH',
          hazardType: 'FLOOD',
          badge: 'Escalated',
          affectedDistrictsCount: 3,
          responseAction: 'Rescue deployment required',
          updatedAt: '2026-10-06T12:00:00.000Z',
        },
        districts: [
          {
            districtCode: 'Gampaha',
            districtName: 'Gampaha',
            warningLevel: 'HIGH',
            responseStatus: 'Escalated',
            rescueNeed: 'Deployment required',
            selected: true,
          },
        ],
      });

      render(
        <MemoryRouter initialEntries={['/district/events/ev-1/districts']}>
          <Routes>
            <Route
              path="/district/events/:eventId/districts"
              element={<AffectedDistrictsPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Gampaha')).toBeInTheDocument();
      expect(screen.getByText('Deployment required')).toBeInTheDocument();
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });
  });

  describe('AvailableTeamsPage', () => {
    it('renders rescue teams and allows team selection', async () => {
      vi.mocked(rescueApi.fetchRescueTeams).mockResolvedValue([
        {
          id: 'team-1',
          teamCode: 'TEAM-A',
          name: 'Navy Special Boat Squadron',
          organization: 'Sri Lanka Navy',
          districtCode: 'Gampaha',
          districtName: 'Gampaha',
          currentStatus: 'AVAILABLE',
          eligibility: 'ELIGIBLE',
          allowsCrossDistrict: false,
        },
      ]);

      render(
        <MemoryRouter
          initialEntries={['/district/events/ev-1/districts/Gampaha/teams']}
        >
          <Routes>
            <Route
              path="/district/events/:eventId/districts/:districtCode/teams"
              element={<AvailableTeamsPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(
        await screen.findByText('Navy Special Boat Squadron'),
      ).toBeInTheDocument();
      expect(screen.getByText('Sri Lanka Navy')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Continue' }),
      ).toBeInTheDocument();
    });
  });

  describe('AssignedMissionPage', () => {
    it('renders assigned mission tracking and allows response start', async () => {
      vi.mocked(rescueApi.fetchMission).mockResolvedValue({
        id: 'mission-1',
        missionId: 'RA-001',
        disasterEventId: 'ev-1',
        disasterEventName: 'Flood Warning',
        districtCode: 'Gampaha',
        districtName: 'Gampaha',
        rescueTeamId: 'team-1',
        rescueTeamName: 'Team A',
        organization: 'DMC',
        emergencyLocation: 'Riverside Area, Gampaha',
        assignedBy: 'Duty Officer',
        status: 'ASSIGNED',
        assignedAt: '2026-10-06T12:00:00.000Z',
        updatedAt: '2026-10-06T12:00:00.000Z',
      });

      render(
        <MemoryRouter initialEntries={['/district/missions/mission-1']}>
          <Routes>
            <Route
              path="/district/missions/:id"
              element={<AssignedMissionPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('RA-001')).toBeInTheDocument();
      expect(screen.getByText('Team A')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Start Response' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Update Status' }),
      ).toBeInTheDocument();
    });
  });

  describe('RescueTeamPortalPage (SQ4 & SQ6)', () => {
    it('renders rescue team leader portal with assigned mission and offline queue banner', async () => {
      vi.mocked(rescueApi.fetchLeaderMission).mockResolvedValue({
        id: 'mission-1',
        missionId: 'RA-001',
        disasterEventId: 'ev-1',
        disasterEventName: 'Flood Warning',
        districtCode: 'Gampaha',
        districtName: 'Gampaha',
        rescueTeamId: 'team-1',
        rescueTeamName: 'Team A',
        organization: 'DMC',
        emergencyLocation: 'Riverside Area, Gampaha',
        assignedBy: 'Duty Officer',
        status: 'ASSIGNED',
        assignedAt: '2026-10-06T12:00:00.000Z',
        updatedAt: '2026-10-06T12:00:00.000Z',
      });

      render(
        <MemoryRouter initialEntries={['/rescue/portal/missions/RA-001']}>
          <Routes>
            <Route
              path="/rescue/portal/missions/:id"
              element={<RescueTeamPortalPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(
        await screen.findByText('Rescue Team Leader Interface'),
      ).toBeInTheDocument();
      expect(screen.getByText('RA-001')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Start Response → En Route/i }),
      ).toBeInTheDocument();
    });
  });
});
