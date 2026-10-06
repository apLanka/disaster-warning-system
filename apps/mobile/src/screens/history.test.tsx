import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { HazardReportDto, NotificationDto } from '@repo/types';

import { NetworkError } from '../api/client';
import {
  getMyReport,
  listMyReports,
  listUnreadNotifications,
  markNotificationRead,
} from '../api/hazardReports';
import { ReportQueue } from '../offline/reportQueue';
import { memoryStore, neverDelivers, renderApp } from '../test/utils';

jest.mock('../api/hazardReports');
jest.mock('../lib/photos', () => ({
  takePhoto: jest.fn(),
  choosePhotos: jest.fn(),
}));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: true }),
  hasServicesEnabledAsync: jest.fn().mockResolvedValue(true),
  getCurrentPositionAsync: jest
    .fn()
    .mockResolvedValue({ coords: { latitude: 7.29, longitude: 80.63 } }),
}));
jest.mock('../components/HealthStatus', () => ({ HealthStatus: () => null }));

const list = jest.mocked(listMyReports);
const get = jest.mocked(getMyReport);
const unread = jest.mocked(listUnreadNotifications);
const markRead = jest.mocked(markNotificationRead);

function report(overrides: Partial<HazardReportDto> = {}): HazardReportDto {
  return {
    id: 'r1',
    reference: 'HR-2026-0001',
    reporterId: 'me',
    type: 'RISING_RIVER_LEVEL',
    description: 'Mahaweli river is rising fast',
    location: { latitude: 7.2906, longitude: 80.6337 },
    photos: [],
    status: 'PENDING_VERIFICATION',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const rejected = report({
  id: 'r2',
  reference: 'HR-2026-0002',
  status: 'REJECTED',
  decision: {
    decidedAt: new Date().toISOString(),
    rejectionReason: 'INSUFFICIENT_INFORMATION',
    rejectionDetails: 'Please add a photo',
  },
});
const verified = report({
  id: 'r3',
  reference: 'HR-2026-0003',
  status: 'VERIFIED',
  decision: { decidedAt: new Date().toISOString() },
});

function note(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 'n1',
    reporterId: 'me',
    reportId: 'r2',
    kind: 'REPORT_REJECTED',
    title: 'Report rejected',
    message:
      'Your hazard report HR-2026-0002 was not accepted. Reason: Insufficient information.',
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function openMyReports(queue?: ReportQueue) {
  await renderApp(queue);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'My Reports' }),
  );
}

describe('report history', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue([]);
    get.mockReset();
    unread.mockReset().mockResolvedValue([]);
    markRead.mockReset().mockResolvedValue();
  });

  describe('My Reports (C5)', () => {
    it("lists the citizen's reports with their status", async () => {
      list.mockResolvedValue([report(), rejected, verified]);

      await openMyReports();

      expect(await screen.findByText('HR-2026-0001')).toBeOnTheScreen();
      expect(screen.getByText('Pending Verification')).toBeOnTheScreen();
      expect(screen.getByText('Rejected')).toBeOnTheScreen();
      expect(screen.getByText('Verified')).toBeOnTheScreen();
    });

    it('shows reports still waiting on the phone first, as Pending Synchronization', async () => {
      list.mockResolvedValue([report()]);
      const queue = new ReportQueue(memoryStore(), neverDelivers);
      await queue.enqueue({
        id: 'q1',
        type: 'FLOOD',
        description: 'Saved offline near the bridge',
        location: { latitude: 7, longitude: 80 },
        photos: [],
        createdAt: new Date().toISOString(),
      });

      await openMyReports(queue);

      expect(
        await screen.findByText('Pending Synchronization'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText('Saved offline near the bridge'),
      ).toBeOnTheScreen();
      expect(await screen.findByText('HR-2026-0001')).toBeOnTheScreen();
    });

    it('explains an empty history and offers to report', async () => {
      await openMyReports();

      expect(
        await screen.findByText('You have not reported anything yet'),
      ).toBeOnTheScreen();
      await fireEvent.press(
        screen.getAllByRole('button', { name: 'Report a Hazard' }).at(-1)!,
      );
      expect(
        await screen.findByRole('button', { name: 'Review report' }),
      ).toBeOnTheScreen();
    });

    it('shows a plain message with Try again when it cannot load, then recovers', async () => {
      list.mockRejectedValueOnce(new NetworkError());

      await openMyReports();

      expect(await screen.findByText(/seem to be offline/)).toBeOnTheScreen();
      list.mockResolvedValue([report()]);
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('HR-2026-0001')).toBeOnTheScreen();
    });

    it('loads the list once when opened, not twice', async () => {
      list.mockResolvedValue([report()]);

      await openMyReports();
      await screen.findByText('HR-2026-0001');

      expect(list).toHaveBeenCalledTimes(1);
    });

    it('opens a report to see its details', async () => {
      list.mockResolvedValue([rejected]);
      get.mockResolvedValue(rejected);
      await openMyReports();

      await fireEvent.press(
        await screen.findByRole('button', { name: /Open report/ }),
      );

      expect(
        await screen.findByText('Reason: Insufficient information'),
      ).toBeOnTheScreen();
      expect(screen.getByText('Please add a photo')).toBeOnTheScreen();
    });
  });

  describe('report detail', () => {
    async function openDetail(r: HazardReportDto) {
      list.mockResolvedValue([r]);
      get.mockResolvedValue(r);
      await openMyReports();
      await fireEvent.press(
        await screen.findByRole('button', { name: /Open report/ }),
      );
    }

    it('shows the report, its status, and where it was reported', async () => {
      await openDetail(report());

      expect(await screen.findByText('Rising River Level')).toBeOnTheScreen();
      expect(
        screen.getByText('Mahaweli river is rising fast'),
      ).toBeOnTheScreen();
      expect(screen.getByText('7.2906° N, 80.6337° E')).toBeOnTheScreen();
      expect(screen.getByText('No photo added')).toBeOnTheScreen();
    });

    it('shows photos resized', async () => {
      await openDetail(
        report({
          photos: [
            {
              publicId: 'p',
              secureUrl: 'https://res.cloudinary.com/d/image/upload/v1/p.jpg',
              width: 1,
              height: 1,
              bytes: 1,
            },
          ],
        }),
      );

      const photo = await screen.findByLabelText('Photo 1');

      expect(photo.props.source.uri).toContain('c_fill,w_400,h_300');
    });

    it('offers a new report after a rejection, and not otherwise', async () => {
      await openDetail(rejected);
      expect(
        await screen.findByRole('button', { name: 'Submit a new report' }),
      ).toBeOnTheScreen();
    });

    it('does not offer a new report for a verified one', async () => {
      await openDetail(verified);
      await screen.findAllByText('Verified');
      expect(
        screen.queryByRole('button', { name: 'Submit a new report' }),
      ).not.toBeOnTheScreen();
    });

    it('says plainly when the report cannot be loaded', async () => {
      list.mockResolvedValue([report()]);
      get.mockRejectedValue(new NetworkError());
      await openMyReports();
      await fireEvent.press(
        await screen.findByRole('button', { name: /Open report/ }),
      );

      expect(await screen.findByText(/seem to be offline/)).toBeOnTheScreen();
    });
  });

  describe('result notifications and screens (C6)', () => {
    it('tells the citizen on Home when a report was decided', async () => {
      unread.mockResolvedValue([note()]);

      await renderApp();

      expect(
        await screen.findByText(
          /was not accepted. Reason: Insufficient information/,
        ),
      ).toBeOnTheScreen();
    });

    it('shows nothing extra when there is nothing new', async () => {
      await renderApp();
      await screen.findByRole('button', { name: 'My Reports' });

      expect(
        screen.queryByRole('button', { name: 'View result' }),
      ).not.toBeOnTheScreen();
    });

    it('opens the Rejected screen with the reason, and marks the notification read', async () => {
      unread.mockResolvedValue([note()]);
      get.mockResolvedValue(rejected);
      await renderApp();

      await fireEvent.press(
        await screen.findByRole('button', { name: 'View result' }),
      );

      expect(await screen.findByText('Report Rejected')).toBeOnTheScreen();
      expect(
        screen.getByText('Reason: Insufficient information'),
      ).toBeOnTheScreen();
      expect(screen.getByText('Please add a photo')).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: 'Submit a new report' }),
      ).toBeOnTheScreen();
      expect(markRead).toHaveBeenCalledWith('n1');
    });

    it('opens the Verified screen for a verified report', async () => {
      unread.mockResolvedValue([
        note({
          id: 'n3',
          reportId: 'r3',
          kind: 'REPORT_VERIFIED',
          message:
            'Your hazard report HR-2026-0003 has been verified by the Disaster Management Centre.',
        }),
      ]);
      get.mockResolvedValue(verified);
      await renderApp();

      await fireEvent.press(
        await screen.findByRole('button', { name: 'View result' }),
      );

      expect(await screen.findByText('Report Verified')).toBeOnTheScreen();
      expect(
        screen.queryByRole('button', { name: 'Submit a new report' }),
      ).not.toBeOnTheScreen();
    });

    it('starts a new report from the Rejected screen', async () => {
      unread.mockResolvedValue([note()]);
      get.mockResolvedValue(rejected);
      await renderApp();
      await fireEvent.press(
        await screen.findByRole('button', { name: 'View result' }),
      );

      await fireEvent.press(
        await screen.findByRole('button', { name: 'Submit a new report' }),
      );

      expect(
        await screen.findByRole('button', { name: 'Review report' }),
      ).toBeOnTheScreen();
    });

    it('goes on to the full report from the result screen', async () => {
      unread.mockResolvedValue([note()]);
      get.mockResolvedValue(rejected);
      await renderApp();
      await fireEvent.press(
        await screen.findByRole('button', { name: 'View result' }),
      );

      await fireEvent.press(
        await screen.findByRole('button', { name: 'View Report' }),
      );

      expect(await screen.findByText('Rejected')).toBeOnTheScreen();
    });

    it('does not crash Home when the notification check fails or returns nonsense', async () => {
      unread.mockRejectedValueOnce(new NetworkError());
      await renderApp();
      expect(
        await screen.findByRole('button', { name: 'My Reports' }),
      ).toBeOnTheScreen();

      unread.mockResolvedValue(undefined as never);
      await fireEvent.press(
        screen.getByRole('button', { name: 'Report a Hazard' }),
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Review report' }),
        ).toBeOnTheScreen(),
      );
    });
  });
});
