import {
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { Linking } from 'react-native';

import { NetworkError } from '../api/client';
import { alert, stubAlertsSource } from '../test/fixtures';
import { renderApp } from '../test/utils';

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

const registered = {
  getProfile: async () => ({ district: 'COLOMBO' as const, updatedAt: '' }),
};

async function openAlerts(overrides = {}) {
  await renderApp(undefined, stubAlertsSource({ ...registered, ...overrides }));
  await fireEvent.press(await screen.findByLabelText(/^Alerts, tab/));
}

describe('citizen alerts', () => {
  it('asks a citizen without a district to set one', async () => {
    await renderApp();
    await fireEvent.press(await screen.findByLabelText(/^Alerts, tab/));

    expect(
      await screen.findByText('Set your district to receive warnings'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set district' }));
    expect(await screen.findByText('Alert Area')).toBeOnTheScreen();
  });

  it('lists active warnings first and all-clears after them', async () => {
    await openAlerts({
      listAlerts: async () => [
        alert({ id: 'a', level: 'CRITICAL' }),
        alert({ id: 'b', state: 'ALL_CLEAR', cancelReason: 'Water receded' }),
      ],
    });

    const cards = await screen.findAllByRole('button', {
      name: /WARNING|ALL CLEAR/,
    });
    expect(cards[0]).toHaveProp(
      'accessibilityLabel',
      expect.stringContaining('FLOOD WARNING, Critical level'),
    );
    expect(cards[1]).toHaveProp(
      'accessibilityLabel',
      expect.stringContaining('ALL CLEAR'),
    );
  });

  it('says when there are no warnings', async () => {
    await openAlerts();
    expect(
      await screen.findByText('No warnings for your area.'),
    ).toBeOnTheScreen();
  });

  it('says when it is showing saved alerts', async () => {
    await openAlerts({
      listAlerts: async () => {
        throw new NetworkError();
      },
    });
    expect(
      await screen.findByText(
        'Could not check for new warnings. Showing the last saved list.',
      ),
    ).toBeOnTheScreen();
  });

  it('opens a warning, acknowledges it, and shows safety information', async () => {
    const acknowledge = jest.fn(async () =>
      alert({ acknowledgedAt: '2026-10-07T10:00:00.000Z' }),
    );
    await openAlerts({ listAlerts: async () => [alert()], acknowledge });

    await fireEvent.press(
      await screen.findByRole('button', { name: /FLOOD WARNING/ }),
    );
    expect(await screen.findByText('HIGH LEVEL')).toBeOnTheScreen();
    expect(screen.getByText('Heavy rainfall expected.')).toBeOnTheScreen();
    expect(
      screen.getByText('1. Move to higher ground immediately'),
    ).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Acknowledge Warning' }),
    );

    await waitFor(() => expect(acknowledge).toHaveBeenCalledWith('w1'));
    expect(await screen.findByText('Alert Acknowledged')).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'DMC Hotline: 117' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Police: 119' })).toBeOnTheScreen();
    expect(
      screen.getByRole('link', { name: 'Ambulance: 110' }),
    ).toBeOnTheScreen();
  });

  it('calls an emergency number from Safety Info', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openAlerts({
      listAlerts: async () => [
        alert({ acknowledgedAt: '2026-10-07T10:00:00.000Z' }),
      ],
    });

    await fireEvent.press(
      await screen.findByRole('button', { name: /FLOOD WARNING/ }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'View Safety Info' }),
    );
    await fireEvent.press(
      await screen.findByRole('link', { name: 'DMC Hotline: 117' }),
    );

    expect(openURL).toHaveBeenCalledWith('tel:117');
  });

  it('opens the map at the district', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openAlerts({ listAlerts: async () => [alert()] });

    await fireEvent.press(
      await screen.findByRole('button', { name: /FLOOD WARNING/ }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'View Map' }),
    );

    expect(openURL).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=6.9271,79.8612',
    );
  });

  it('keeps the warning open and explains when acknowledging fails', async () => {
    await openAlerts({
      listAlerts: async () => [alert()],
      acknowledge: async () => {
        throw new NetworkError();
      },
    });

    await fireEvent.press(
      await screen.findByRole('button', { name: /FLOOD WARNING/ }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Acknowledge Warning' }),
    );

    expect(await screen.findByText(/You seem to be offline/)).toBeOnTheScreen();
    expect(screen.getByText('HIGH LEVEL')).toBeOnTheScreen();
  });

  it('shows an All Clear without asking to acknowledge', async () => {
    await openAlerts({
      listAlerts: async () => [
        alert({ state: 'ALL_CLEAR', cancelReason: 'Water has receded' }),
      ],
    });

    await fireEvent.press(
      await screen.findByRole('button', { name: /ALL CLEAR/ }),
    );

    expect(
      await screen.findByText('All clear: Water has receded'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Acknowledge Warning' }),
    ).toBeNull();
  });

  describe('home', () => {
    it('turns the status card to the most severe active warning and lists recent ones', async () => {
      await renderApp(
        undefined,
        stubAlertsSource({
          ...registered,
          listAlerts: async () => [alert({ level: 'CRITICAL' })],
        }),
      );

      expect(
        await screen.findByText('Current Status: Critical warning'),
      ).toBeOnTheScreen();
      expect(
        screen.getByText('1 active warning in your area'),
      ).toBeOnTheScreen();
      const recent = screen.getByLabelText('Recent Alerts');
      expect(
        within(recent).getByRole('button', { name: /FLOOD WARNING/ }),
      ).toBeOnTheScreen();
    });

    it('counts unacknowledged warnings on the bell and opens the Alerts tab', async () => {
      await renderApp(
        undefined,
        stubAlertsSource({ ...registered, listAlerts: async () => [alert()] }),
      );

      await fireEvent.press(
        await screen.findByRole('button', { name: 'Notifications, 1 new' }),
      );
      expect(
        await screen.findByRole('button', { name: /FLOOD WARNING/ }),
      ).toBeOnTheScreen();
    });
  });
});
