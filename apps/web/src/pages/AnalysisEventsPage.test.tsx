import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listEvents } from '../api/analysis';
import { ApiError, NetworkError } from '../api/client';
import { event, eventsPage } from '../test/analysisFixtures';
import { renderPage } from '../test/render';
import { AnalysisEventsPage } from './AnalysisEventsPage';

vi.mock('../api/analysis', () => ({ listEvents: vi.fn() }));

const lastQuery = () => vi.mocked(listEvents).mock.calls.at(-1)![0];

function renderEvents(at = '/analysis') {
  return renderPage(<AnalysisEventsPage />, { at });
}

describe('AnalysisEventsPage', () => {
  beforeEach(() => {
    vi.mocked(listEvents)
      .mockReset()
      .mockResolvedValue(
        eventsPage(
          [
            event(),
            event({
              id: 'b',
              eventId: 'DE-2026-0002',
              name: 'Ratnapura Landslide',
              hazardType: 'LANDSLIDE',
              districtCodes: ['RAT', 'KEG'],
            }),
          ],
          { total: 12 },
        ),
      );
  });

  it('shows the title, the events, the count and the sample-data notice', async () => {
    renderEvents();

    expect(
      screen.getByRole('heading', { name: 'Analysis & Reports' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Kelani River Flood')).toBeInTheDocument();
    expect(screen.getByText('DE-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Colombo, Gampaha, Kalutara')).toBeInTheDocument();
    expect(screen.getAllByText('10 Mar 2026 - 12 Mar 2026')).toHaveLength(2);
    expect(screen.getAllByText('Completed')).toHaveLength(2);
    expect(screen.getByText('12 events')).toBeInTheDocument();
    expect(
      screen.getByText(/Sample data for demonstration/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Showing 1–10 of 12 events/)).toBeInTheDocument();
  });

  it('links each event to its scope page', async () => {
    renderEvents();
    const link = await screen.findByRole('link', {
      name: 'Analyse Ratnapura Landslide',
    });
    expect(link).toHaveAttribute('href', '/analysis/b');
  });

  it('shows no sample-data notice for real events', async () => {
    vi.mocked(listEvents).mockResolvedValue(
      eventsPage([event({ isDemoData: false })]),
    );
    renderEvents();
    await screen.findByText('Kelani River Flood');
    expect(screen.queryByText(/Sample data/)).not.toBeInTheDocument();
  });

  it('asks for the first page of ten with no filters by default', async () => {
    renderEvents();
    await screen.findByText('Kelani River Flood');
    expect(lastQuery()).toEqual({
      search: undefined,
      hazardType: undefined,
      district: undefined,
      page: 1,
      limit: 10,
    });
  });

  it('reads filters and the page from the address', async () => {
    renderEvents(
      '/analysis?hazardType=LANDSLIDE&district=RAT&search=ratna&page=2',
    );
    await screen.findByText('Kelani River Flood');
    expect(lastQuery()).toMatchObject({
      hazardType: 'LANDSLIDE',
      district: 'RAT',
      search: 'ratna',
      page: 2,
    });
    expect(screen.getByLabelText('Hazard type')).toHaveValue('LANDSLIDE');
    expect(screen.getByLabelText('District')).toHaveValue('RAT');
    expect(screen.getByLabelText('Search')).toHaveValue('ratna');
  });

  it('ignores a bad filter value or page in the address', async () => {
    renderEvents('/analysis?hazardType=TORNADO&district=XXX&page=-3');
    await screen.findByText('Kelani River Flood');
    expect(lastQuery()).toMatchObject({
      hazardType: undefined,
      district: undefined,
      page: 1,
    });
  });

  it('filters by hazard type and district and goes back to page one', async () => {
    const user = userEvent.setup();
    renderEvents('/analysis?page=2');
    await screen.findByText('Kelani River Flood');

    await user.selectOptions(screen.getByLabelText('Hazard type'), 'FLOOD');
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ hazardType: 'FLOOD', page: 1 }),
    );

    await user.selectOptions(screen.getByLabelText('District'), 'CMB');
    await waitFor(() => expect(lastQuery()).toMatchObject({ district: 'CMB' }));
  });

  it('searches when the form is submitted, trimming the text', async () => {
    const user = userEvent.setup();
    renderEvents();
    await screen.findByText('Kelani River Flood');

    await user.type(screen.getByLabelText('Search'), '  kelani {Enter}');

    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ search: 'kelani' }),
    );
  });

  it('moves between pages', async () => {
    const user = userEvent.setup();
    renderEvents();
    await screen.findByText('Kelani River Flood');

    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2 }));

    await user.click(screen.getByRole('button', { name: 'Page 1' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1 }));
  });

  it('shows the alternate-flow message when there are no completed events', async () => {
    vi.mocked(listEvents).mockResolvedValue(eventsPage([]));
    renderEvents();
    expect(
      await screen.findByText(
        'No completed disaster events are available for analysis',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a different message with a way out when filters match nothing', async () => {
    const user = userEvent.setup();
    vi.mocked(listEvents).mockResolvedValue(eventsPage([]));
    renderEvents('/analysis?district=JAF&search=x');

    expect(
      await screen.findByText('No events match these filters'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect(lastQuery()).toMatchObject({
        district: undefined,
        search: undefined,
      }),
    );
    expect(screen.getByLabelText('Search')).toHaveValue('');
  });

  it('shows a loading state, then the list', async () => {
    let resolve!: (page: ReturnType<typeof eventsPage>) => void;
    vi.mocked(listEvents).mockReturnValue(
      new Promise((res) => {
        resolve = res;
      }),
    );
    renderEvents();
    expect(
      screen.getByRole('status', { name: 'Loading events' }),
    ).toBeInTheDocument();
    resolve(eventsPage([event()]));
    expect(await screen.findByText('Kelani River Flood')).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Loading events' }),
    ).not.toBeInTheDocument();
  });

  it('shows the error with Retry, and recovers', async () => {
    const user = userEvent.setup();
    vi.mocked(listEvents).mockRejectedValueOnce(new NetworkError());
    renderEvents();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cannot reach the server');

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Kelani River Flood')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('describes a server error in plain language', async () => {
    vi.mocked(listEvents).mockRejectedValue(new ApiError(500, 'boom'));
    renderEvents();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The server hit a problem',
    );
  });

  it('refreshes the list', async () => {
    const user = userEvent.setup();
    renderEvents();
    await screen.findByText('Kelani River Flood');
    const calls = vi.mocked(listEvents).mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() =>
      expect(vi.mocked(listEvents).mock.calls.length).toBeGreaterThan(calls),
    );
  });
});
