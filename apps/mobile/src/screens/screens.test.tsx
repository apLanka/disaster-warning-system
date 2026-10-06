import { useNetInfo } from '@react-native-community/netinfo';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ExpoLocation from 'expo-location';
import { Alert, Linking } from 'react-native';

import type { HazardReportDto } from '@repo/types';

import { ApiError, NetworkError } from '../api/client';
import {
  listUnreadNotifications,
  submitHazardReport,
} from '../api/hazardReports';
import * as photos from '../lib/photos';
import { ReportQueue } from '../offline/reportQueue';
import { memoryStore, neverDelivers, renderApp } from '../test/utils';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('../api/hazardReports');
jest.mock('../lib/photos', () => ({
  takePhoto: jest.fn(),
  choosePhotos: jest.fn(),
}));

const location = jest.mocked(ExpoLocation);
const submit = jest.mocked(submitHazardReport);
const picker = jest.mocked(photos);
const netInfo = jest.mocked(useNetInfo);

const POSITION = { coords: { latitude: 7.2906, longitude: 80.6337 } };
const PHOTO = {
  uri: 'file:///a.jpg',
  mimeType: 'image/jpeg',
  fileName: 'a.jpg',
};
const stored = { id: 'r1', reference: 'HR-2026-0001' } as HazardReportDto;
const DESCRIPTION = 'Mahaweli river is rising fast near Peradeniya bridge';

function gpsWorks() {
  location.requestForegroundPermissionsAsync.mockResolvedValue({
    granted: true,
  } as never);
  location.hasServicesEnabledAsync.mockResolvedValue(true);
  location.getCurrentPositionAsync.mockResolvedValue(POSITION as never);
}

function connection(isConnected: boolean | null) {
  netInfo.mockReturnValue({ isConnected } as ReturnType<typeof useNetInfo>);
}

async function openForm(queue?: ReportQueue) {
  const view = await renderApp(queue);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Report a Hazard' }),
  );
  await screen.findByRole('button', { name: /^Hazard Type:/ });
  return view;
}

async function chooseType(label: string) {
  await fireEvent.press(screen.getByRole('button', { name: /^Hazard Type:/ }));
  await fireEvent.press(await screen.findByRole('radio', { name: label }));
}

async function fillForm() {
  await chooseType('Rising River Level');
  await fireEvent.changeText(screen.getByLabelText('Description'), DESCRIPTION);
  await waitFor(() =>
    expect(screen.getByText('7.2906° N, 80.6337° E')).toBeOnTheScreen(),
  );
}

async function review() {
  await fireEvent.press(screen.getByRole('button', { name: 'Review report' }));
}

describe('citizen submit flow', () => {
  beforeEach(() => {
    gpsWorks();
    connection(true);
    submit.mockReset();
    jest.mocked(listUnreadNotifications).mockResolvedValue([]);
    picker.takePhoto.mockReset();
    picker.choosePhotos.mockReset();
  });

  describe('home', () => {
    it('has the wireframe tab bar: Home, Reports, Alerts, Profile', async () => {
      await renderApp();

      for (const [index, name] of [
        'Home',
        'Reports',
        'Alerts',
        'Profile',
      ].entries()) {
        expect(
          await screen.findByLabelText(`${name}, tab, ${index + 1} of 4`),
        ).toBeOnTheScreen();
      }
    });

    it('shows the current status card', async () => {
      await renderApp();

      expect(await screen.findByText('Current Status: Safe')).toBeOnTheScreen();
      expect(
        screen.getByText('No active alerts in your area'),
      ).toBeOnTheScreen();
    });

    it('opens a coming-soon page for tabs built by other use cases', async () => {
      await renderApp();

      await fireEvent.press(await screen.findByLabelText(/^Alerts, tab/));

      expect(
        await screen.findByText('This section is coming soon.'),
      ).toBeOnTheScreen();
    });

    it('offers to report a hazard', async () => {
      await renderApp();

      expect(
        await screen.findByRole('button', { name: 'Report a Hazard' }),
      ).toBeOnTheScreen();
      expect(screen.getByText('Recent Alerts')).toBeOnTheScreen();
    });

    it('tells the citizen how many reports are waiting to be sent', async () => {
      const queue = new ReportQueue(memoryStore(), neverDelivers);
      await queue.enqueue({
        id: 'a',
        type: 'FLOOD',
        description: 'Saved earlier near the river',
        location: { latitude: 7, longitude: 80 },
        photos: [],
        createdAt: '2026-10-05T10:00:00.000Z',
      });
      connection(false);

      await renderApp(queue);

      expect(
        await screen.findByText(/1 report is waiting to be sent/),
      ).toBeOnTheScreen();
    });

    it('shows a refused saved report with a way to dismiss it', async () => {
      const store = memoryStore();
      await store.setItem(
        'failedReports',
        JSON.stringify([
          {
            report: {
              id: 'a',
              type: 'FLOOD',
              description: 'x',
              location: { latitude: 1, longitude: 1 },
              photos: [],
              createdAt: '',
              attempts: 1,
              nextAttemptAt: 0,
            },
            message: 'A photo is too large.',
            failedAt: '',
          },
        ]),
      );
      const queue = new ReportQueue(store, neverDelivers);
      connection(false);

      await renderApp(queue);

      expect(
        await screen.findByText(
          /A saved report could not be sent. A photo is too large./,
        ),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
      await waitFor(() =>
        expect(screen.queryByText(/could not be sent/)).not.toBeOnTheScreen(),
      );
    });
  });

  describe('report form', () => {
    it('warns with the Sri Lankan emergency numbers, not 911 (C8)', async () => {
      await openForm();

      expect(
        screen.getByText(
          /call 117 \(DMC\), 119 \(Police\) or 110 \(Ambulance\)/,
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/911/)).not.toBeOnTheScreen();
    });

    it('offers every hazard type', async () => {
      await openForm();
      await fireEvent.press(
        screen.getByRole('button', { name: /^Hazard Type:/ }),
      );

      for (const label of [
        'Flood',
        'Rising River Level',
        'Landslide',
        'Road Blockage',
        'Wildfire',
        'Strong Winds',
        'Other',
      ]) {
        expect(
          await screen.findByRole('radio', { name: label }),
        ).toBeOnTheScreen();
      }
    });

    it('is called "Review report", so it is clear a review step follows (C9)', async () => {
      await openForm();

      expect(
        screen.getByRole('button', { name: 'Review report' }),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole('button', { name: /^Next$/ }),
      ).not.toBeOnTheScreen();
    });

    it('counts characters as the description is typed', async () => {
      await openForm();

      await fireEvent.changeText(
        screen.getByLabelText('Description'),
        'Water is rising',
      );

      expect(screen.getByText('15 of 1000 characters')).toBeOnTheScreen();
    });

    it('shows what is wrong, in plain words, when nothing has been filled in (C7)', async () => {
      await openForm();
      await waitFor(() =>
        expect(screen.getByText('7.2906° N, 80.6337° E')).toBeOnTheScreen(),
      );

      await review();

      expect(screen.getByText('Choose the type of hazard.')).toBeOnTheScreen();
      expect(screen.getByText(/at least 10 characters/)).toBeOnTheScreen();
      expect(screen.queryByText('Review Report')).not.toBeOnTheScreen();
    });

    it('clears an error as soon as the citizen fixes it', async () => {
      await openForm();
      await review();
      expect(screen.getByText('Choose the type of hazard.')).toBeOnTheScreen();

      await chooseType('Flood');

      expect(
        screen.queryByText('Choose the type of hazard.'),
      ).not.toBeOnTheScreen();
    });

    it('moves on to the review screen when the form is complete', async () => {
      await openForm();
      await fillForm();

      await review();

      expect(
        await screen.findByText('Please verify all details before submitting.'),
      ).toBeOnTheScreen();
      expect(screen.getByText('Rising River Level')).toBeOnTheScreen();
      expect(screen.getByText(DESCRIPTION)).toBeOnTheScreen();
      expect(screen.getByText('7.2906° N, 80.6337° E')).toBeOnTheScreen();
      expect(screen.getByText('No photo added')).toBeOnTheScreen();
    });

    describe('location', () => {
      it('explains that location access is off, and offers Settings (C7)', async () => {
        location.requestForegroundPermissionsAsync.mockResolvedValue({
          granted: false,
        } as never);
        const openSettings = jest
          .spyOn(Linking, 'openSettings')
          .mockResolvedValue();
        await openForm();

        expect(
          await screen.findByText(/Location access is off/),
        ).toBeOnTheScreen();
        await fireEvent.press(
          screen.getByRole('button', { name: 'Open Settings' }),
        );

        expect(openSettings).toHaveBeenCalled();
      });

      it('lets the citizen try again after granting access', async () => {
        location.requestForegroundPermissionsAsync.mockResolvedValueOnce({
          granted: false,
        } as never);
        await openForm();
        await screen.findByText(/Location access is off/);

        gpsWorks();
        await fireEvent.press(
          screen.getByRole('button', { name: 'Try again' }),
        );

        expect(
          await screen.findByText('7.2906° N, 80.6337° E'),
        ).toBeOnTheScreen();
        expect(
          screen.queryByText(/Location access is off/),
        ).not.toBeOnTheScreen();
      });

      it('says when location services are switched off', async () => {
        location.hasServicesEnabledAsync.mockResolvedValue(false);
        await openForm();

        expect(
          await screen.findByText(/could not get your location/),
        ).toBeOnTheScreen();
      });

      it('says so when the position cannot be read', async () => {
        location.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));
        await openForm();

        expect(
          await screen.findByText(/could not get your location/),
        ).toBeOnTheScreen();
      });

      it('will not review without a location, and says why', async () => {
        location.requestForegroundPermissionsAsync.mockResolvedValue({
          granted: false,
        } as never);
        await openForm();
        await screen.findByText(/Location access is off/);
        await chooseType('Flood');
        await fireEvent.changeText(
          screen.getByLabelText('Description'),
          DESCRIPTION,
        );

        await review();

        expect(
          screen.getAllByText(/location is needed/i).length,
        ).toBeGreaterThan(0);
        expect(
          screen.queryByText('Please verify all details before submitting.'),
        ).not.toBeOnTheScreen();
      });

      it('asks the citizen to wait while it is still finding the position', async () => {
        location.getCurrentPositionAsync.mockReturnValue(
          new Promise(() => undefined),
        );
        await openForm();
        await chooseType('Flood');
        await fireEvent.changeText(
          screen.getByLabelText('Description'),
          DESCRIPTION,
        );

        await review();

        expect(
          screen.getByText(
            'Still finding your location. Please wait a moment.',
          ),
        ).toBeOnTheScreen();
      });
    });

    describe('photos', () => {
      it('adds a photo from the library, previews it, and counts it (C9)', async () => {
        picker.choosePhotos.mockResolvedValue({ photos: [PHOTO] });
        jest
          .spyOn(Alert, 'alert')
          .mockImplementation((_title, _message, buttons) => {
            buttons
              ?.find((button) => button.text === 'Choose from library')
              ?.onPress?.();
          });
        await openForm();

        await fireEvent.press(
          screen.getByRole('button', { name: 'Add a photo' }),
        );

        expect(await screen.findByLabelText('Photo 1')).toBeOnTheScreen();
        expect(screen.getByText('1 of 5 added')).toBeOnTheScreen();
        expect(picker.choosePhotos).toHaveBeenCalledWith(5);
      });

      it('takes a photo with the camera', async () => {
        picker.takePhoto.mockResolvedValue({ photos: [PHOTO] });
        jest
          .spyOn(Alert, 'alert')
          .mockImplementation((_title, _message, buttons) => {
            buttons
              ?.find((button) => button.text === 'Take photo')
              ?.onPress?.();
          });
        await openForm();

        await fireEvent.press(
          screen.getByRole('button', { name: 'Add a photo' }),
        );

        expect(await screen.findByLabelText('Photo 1')).toBeOnTheScreen();
      });

      it('lets the citizen remove a photo they added (C9)', async () => {
        picker.choosePhotos.mockResolvedValue({ photos: [PHOTO] });
        jest
          .spyOn(Alert, 'alert')
          .mockImplementation((_title, _message, buttons) => {
            buttons
              ?.find((button) => button.text === 'Choose from library')
              ?.onPress?.();
          });
        await openForm();
        await fireEvent.press(
          screen.getByRole('button', { name: 'Add a photo' }),
        );
        await screen.findByLabelText('Photo 1');

        await fireEvent.press(
          screen.getByRole('button', { name: 'Remove photo 1' }),
        );

        expect(screen.queryByLabelText('Photo 1')).not.toBeOnTheScreen();
        expect(screen.getByText('0 of 5 added')).toBeOnTheScreen();
      });

      it('explains why a photo was refused', async () => {
        picker.choosePhotos.mockResolvedValue({
          photos: [],
          error: 'A photo is larger than 5 MB. Choose a smaller one.',
        });
        jest
          .spyOn(Alert, 'alert')
          .mockImplementation((_title, _message, buttons) => {
            buttons
              ?.find((button) => button.text === 'Choose from library')
              ?.onPress?.();
          });
        await openForm();

        await fireEvent.press(
          screen.getByRole('button', { name: 'Add a photo' }),
        );

        expect(
          await screen.findByText(
            'A photo is larger than 5 MB. Choose a smaller one.',
          ),
        ).toBeOnTheScreen();
      });
    });
  });

  describe('review and submit', () => {
    async function toReview() {
      await openForm();
      await fillForm();
      await review();
      await screen.findByText('Please verify all details before submitting.');
    }

    it('keeps everything when the citizen goes back to edit (C9)', async () => {
      await toReview();

      await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));

      expect(await screen.findByText('Rising River Level')).toBeOnTheScreen();
      expect(screen.getByLabelText('Description').props.value).toBe(
        DESCRIPTION,
      );
      expect(screen.getByText('7.2906° N, 80.6337° E')).toBeOnTheScreen();
    });

    it('sends the report and confirms it is waiting for verification', async () => {
      submit.mockResolvedValue({ report: stored, created: true });
      await toReview();

      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );

      expect(await screen.findByText('Report Submitted')).toBeOnTheScreen();
      expect(screen.getByText('Pending Verification')).toBeOnTheScreen();
      expect(screen.getByText('Reference HR-2026-0001')).toBeOnTheScreen();
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RISING_RIVER_LEVEL',
          description: DESCRIPTION,
          location: { latitude: 7.2906, longitude: 80.6337 },
        }),
      );
    });

    it('cannot be submitted twice by tapping quickly', async () => {
      let finish!: () => void;
      submit.mockReturnValue(
        new Promise((resolve) => {
          finish = () => resolve({ report: stored, created: true });
        }),
      );
      await toReview();

      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );
      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );
      await act(async () => finish());

      expect(submit).toHaveBeenCalledTimes(1);
    });

    it('goes home after the confirmation, with a clean form for the next report', async () => {
      submit.mockResolvedValue({ report: stored, created: true });
      await toReview();
      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );
      await screen.findByText('Report Submitted');

      await fireEvent.press(screen.getByRole('button', { name: 'Go to Home' }));
      await fireEvent.press(
        await screen.findByRole('button', { name: 'Report a Hazard' }),
      );

      await waitFor(() =>
        expect(screen.getByLabelText('Description').props.value).toBe(''),
      );
      expect(
        screen.getByRole('button', { name: /^Hazard Type: Select Type/ }),
      ).toBeOnTheScreen();
    });

    it('cannot go back to the review screen from the confirmation', async () => {
      submit.mockResolvedValue({ report: stored, created: true });
      await toReview();
      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );
      await screen.findByText('Report Submitted');

      expect(
        screen.queryByRole('button', { name: /back/i }),
      ).not.toBeOnTheScreen();
    });

    it('saves the report and says so when the server cannot be reached (C7)', async () => {
      submit.mockRejectedValue(new NetworkError());
      const { queue } = await renderApp();
      await fireEvent.press(
        await screen.findByRole('button', { name: 'Report a Hazard' }),
      );
      await screen.findByRole('button', { name: /^Hazard Type:/ });
      await fillForm();
      await review();
      await screen.findByText('Please verify all details before submitting.');

      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );

      expect(await screen.findByText('Report Saved')).toBeOnTheScreen();
      expect(screen.getByText('Pending Synchronization')).toBeOnTheScreen();
      expect(
        screen.getByText(/saved on this phone and will be sent automatically/),
      ).toBeOnTheScreen();
      const [saved] = await queue.list();
      expect(saved).toMatchObject({
        type: 'RISING_RIVER_LEVEL',
        description: DESCRIPTION,
        location: { latitude: 7.2906, longitude: 80.6337 },
      });
    });

    it('keeps the same request id when saving, so sending it later cannot duplicate it', async () => {
      submit.mockRejectedValue(new NetworkError());
      const { queue } = await renderApp();
      await fireEvent.press(
        await screen.findByRole('button', { name: 'Report a Hazard' }),
      );
      await screen.findByRole('button', { name: /^Hazard Type:/ });
      await fillForm();
      await review();
      await screen.findByText('Please verify all details before submitting.');
      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );
      await screen.findByText('Report Saved');

      const [saved] = await queue.list();

      expect(saved?.id).toBe(submit.mock.calls[0]?.[0].clientRequestId);
    });

    it('stays on the review screen with a plain message when the server refuses the report', async () => {
      submit.mockRejectedValue(new ApiError(400, 'description must be longer'));
      await toReview();

      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );

      expect(
        await screen.findByText('description must be longer'),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: 'Submit Report' }),
      ).toBeEnabled();
      expect(screen.queryByText('Report Saved')).not.toBeOnTheScreen();
    });

    it('does not save a report the server refused, since sending it again would fail again', async () => {
      submit.mockRejectedValue(new ApiError(400, 'bad'));
      const { queue } = await renderApp();
      await fireEvent.press(
        await screen.findByRole('button', { name: 'Report a Hazard' }),
      );
      await screen.findByRole('button', { name: /^Hazard Type:/ });
      await fillForm();
      await review();
      await screen.findByText('Please verify all details before submitting.');

      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );
      await screen.findByText('bad');

      expect(await queue.list()).toEqual([]);
    });

    it('explains a server problem in plain words and lets the citizen try again', async () => {
      submit.mockRejectedValueOnce(new ApiError(500, 'boom'));
      submit.mockResolvedValueOnce({ report: stored, created: true });
      await toReview();

      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );
      expect(
        await screen.findByText(/went wrong on our side/),
      ).toBeOnTheScreen();
      await fireEvent.press(
        screen.getByRole('button', { name: 'Submit Report' }),
      );

      expect(await screen.findByText('Report Submitted')).toBeOnTheScreen();
    });

    it('shows the offline banner while the phone has no connection', async () => {
      connection(false);

      await renderApp();

      expect(
        await screen.findByText(
          /You are offline. Reports will be sent when you reconnect./,
        ),
      ).toBeOnTheScreen();
    });

    it('shows no offline banner when connected', async () => {
      await renderApp();
      await screen.findByRole('button', { name: 'Report a Hazard' });

      expect(screen.queryByText(/You are offline/)).not.toBeOnTheScreen();
    });

    it('lists every detail on the review screen under its own label', async () => {
      await toReview();

      for (const title of ['Hazard Type', 'Description', 'Photo', 'Location']) {
        expect(screen.getByText(title)).toBeOnTheScreen();
      }
    });
  });
});
