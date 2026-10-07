import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { stubAlertsSource } from '../test/fixtures';
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

async function openProfile(source = stubAlertsSource()) {
  await renderApp(undefined, source);
  await fireEvent.press(await screen.findByLabelText(/^Profile, tab/));
}

describe('Profile: alert area', () => {
  it('explains why the district is needed and requires one', async () => {
    await openProfile();

    expect(
      await screen.findByText(/We only send you warnings for this district/),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Save alert area' }),
    );
    expect(await screen.findByText('Choose your district.')).toBeOnTheScreen();
  });

  it('rejects a phone number that is not a Sri Lankan mobile', async () => {
    await openProfile();

    await fireEvent.press(
      await screen.findByRole('button', { name: /^District/ }),
    );
    await fireEvent.press(
      await screen.findByRole('radio', { name: 'Gampaha' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('Mobile number for SMS'),
      '12345',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Save alert area' }),
    );

    expect(
      await screen.findByText(
        'Enter a Sri Lankan mobile number, such as 077 123 4567.',
      ),
    ).toBeOnTheScreen();
  });

  it('saves the district with a normalised phone and confirms', async () => {
    const saveProfile = jest.fn(async (input) => ({
      ...input,
      updatedAt: '2026-10-07T00:00:00Z',
    }));
    await openProfile(stubAlertsSource({ saveProfile }));

    await fireEvent.press(
      await screen.findByRole('button', { name: /^District/ }),
    );
    await fireEvent.press(
      await screen.findByRole('radio', { name: 'Gampaha' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('Mobile number for SMS'),
      '077 123 4567',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Save alert area' }),
    );

    await waitFor(() =>
      expect(saveProfile).toHaveBeenCalledWith({
        district: 'GAMPAHA',
        phone: '+94771234567',
      }),
    );
    expect(
      await screen.findByText('Saved. You will get warnings for Gampaha.'),
    ).toBeOnTheScreen();
  });

  it('shows the saved district and phone', async () => {
    await openProfile(
      stubAlertsSource({
        getProfile: async () => ({
          district: 'GALLE',
          phone: '+94771234567',
          updatedAt: '',
        }),
      }),
    );

    expect(
      await screen.findByRole('button', { name: 'District: Galle' }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Mobile number for SMS').props.value).toBe(
      '077 123 4567',
    );
  });

  it('keeps the entries and explains a failed save', async () => {
    await openProfile(
      stubAlertsSource({
        saveProfile: async () => {
          throw new Error('x');
        },
      }),
    );

    await fireEvent.press(
      await screen.findByRole('button', { name: /^District/ }),
    );
    await fireEvent.press(
      await screen.findByRole('radio', { name: 'Gampaha' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Save alert area' }),
    );

    expect(
      await screen.findByText('Something went wrong. Please try again.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'District: Gampaha' }),
    ).toBeOnTheScreen();
  });
});
