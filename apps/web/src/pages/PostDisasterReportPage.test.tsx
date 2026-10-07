import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateReport } from '../api/analysis';
import { ApiError, NetworkError } from '../api/client';
import { event, report } from '../test/analysisFixtures';
import { renderPage } from '../test/render';
import { PostDisasterReportPage } from './PostDisasterReportPage';

vi.mock('../api/analysis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/analysis')>()),
  generateReport: vi.fn(),
}));

function renderReport(search = '') {
  return renderPage(
    <Routes>
      <Route
        path="/analysis/:eventId/report"
        element={<PostDisasterReportPage />}
      />
      <Route path="/analysis/:eventId" element={<p>Scope page</p>} />
    </Routes>,
    { at: `/analysis/abc/report${search}` },
  );
}

const emptyReport = () =>
  report({
    alertTimeline: [],
    shelters: [],
    occupancyTotalSeries: [],
    resources: [],
    resourceTotalsByDistrict: [],
    citizensReached: 0,
    dataCompletenessStatus: 'INCOMPLETE',
    dataStatus: {
      complete: false,
      issues: [
        {
          kind: 'NO_WARNINGS',
          message: 'No warnings were issued for this scope.',
        },
        {
          kind: 'NO_SHELTER_DATA',
          message: 'No shelter occupancy data is recorded for this scope.',
        },
        {
          kind: 'NO_RESOURCE_DATA',
          message: 'No resource distribution data is recorded for this scope.',
        },
      ],
    },
    summary: {
      alertsIssued: 0,
      citizensTargeted: 0,
      citizensReached: 0,
      reachRate: 0,
      peakShelterOccupancy: null,
      districtsReceivingResources: 0,
    },
  });

describe('PostDisasterReportPage', () => {
  beforeEach(() => {
    vi.mocked(generateReport).mockReset().mockResolvedValue(report());
  });

  it('asks for the report of the event, for all districts by default', async () => {
    renderReport();
    await screen.findByRole('heading', { name: 'Kelani River Flood' });
    expect(generateReport).toHaveBeenCalledWith(
      'abc',
      undefined,
      expect.any(AbortSignal),
    );
  });

  it('asks for one district when the address says so, and says which', async () => {
    vi.mocked(generateReport).mockResolvedValue(
      report({ scope: { kind: 'DISTRICT', districtCode: 'GMP' } }),
    );
    renderReport('?district=GMP');
    expect(await screen.findByText('Gampaha')).toBeInTheDocument();
    expect(generateReport).toHaveBeenCalledWith(
      'abc',
      'GMP',
      expect.any(AbortSignal),
    );
  });

  it('shows the event, the period, the scope and the sample-data notice', async () => {
    renderReport();
    expect(
      await screen.findByRole('heading', { name: 'Kelani River Flood' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/DE-2026-0001 · Flood · 10 Mar 2026 - 12 Mar 2026/),
    ).toBeInTheDocument();
    expect(screen.getByText('All affected districts')).toBeInTheDocument();
    expect(
      screen.getByText(/Sample data for demonstration/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Report RPT-DE-2026-0001-ALL-1/),
    ).toBeInTheDocument();
  });

  it('shows the four headline figures', async () => {
    renderReport();
    await screen.findByRole('heading', { name: 'Kelani River Flood' });

    expect(
      screen.getByText('Alerts Issued').previousElementSibling,
    ).toHaveTextContent('4');
    expect(
      screen.getByText('Citizens Reached').previousElementSibling,
    ).toHaveTextContent('120,000');
    expect(screen.getByText('80.0% of 150,000 targeted')).toBeInTheDocument();
    expect(
      screen.getByText('Peak Shelter Occupancy').previousElementSibling,
    ).toHaveTextContent('540');
    expect(
      screen.getByText(/of 900 capacity · 11 Mar, 09:30/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Districts Receiving Resources').previousElementSibling,
    ).toHaveTextContent('3');
  });

  it('says the data is complete when it is', async () => {
    renderReport();
    expect(await screen.findByText('Data Complete')).toBeInTheDocument();
    expect(screen.queryByText('Data Incomplete')).not.toBeInTheDocument();
  });

  it('says the data is incomplete and lists every reason', async () => {
    vi.mocked(generateReport).mockResolvedValue(
      report({
        dataCompletenessStatus: 'INCOMPLETE',
        dataStatus: {
          complete: false,
          issues: [
            {
              kind: 'PENDING_SHELTER_RECORDS',
              message: '2 shelter records pending synchronisation.',
              count: 2,
            },
            {
              kind: 'PENDING_RESOURCE_RECORDS',
              message: '1 resource record pending synchronisation.',
              count: 1,
            },
          ],
        },
      }),
    );
    renderReport();

    expect(await screen.findByText('Data Incomplete')).toBeInTheDocument();
    const reasons = screen.getByRole('list', {
      name: 'Reasons the data is incomplete',
    });
    expect(
      within(reasons)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      '2 shelter records pending synchronisation.',
      '1 resource record pending synchronisation.',
    ]);
    expect(screen.queryByText('Data Complete')).not.toBeInTheDocument();
  });

  describe('sections', () => {
    it('opens on the overview with the alert timeline', async () => {
      renderReport();
      const timeline = await screen.findByRole('list', {
        name: 'Alert timeline',
      });
      expect(within(timeline).getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('opens the shelter section from the address, with chart, readings and shelters', async () => {
      renderReport('?tab=shelters');
      expect(
        await screen.findByRole('img', { name: /peak of 540/ }),
      ).toBeInTheDocument();
      const table = screen.getByRole('table', {
        name: 'Shelters and their occupancy',
      });
      expect(
        within(table).getByText('Colombo Relief Centre 1'),
      ).toBeInTheDocument();
      expect(within(table).getByText('Closed')).toBeInTheDocument();
      expect(within(table).getAllByText('Pending sync')).toHaveLength(1);
    });

    it('opens the resource section from the address, with chart and table, pending rows marked', async () => {
      renderReport('?tab=resources');
      expect(
        await screen.findByRole('img', {
          name: /Quantity distributed by district for 2 districts/,
        }),
      ).toBeInTheDocument();
      const table = screen.getByRole('table', {
        name: 'Resources distributed',
      });
      expect(within(table).getByText('2,500 litres')).toBeInTheDocument();
      expect(
        within(table).getByText('Community Aid Network'),
      ).toBeInTheDocument();
      expect(within(table).getAllByText('Pending sync')).toHaveLength(1);
    });

    it('treats an unknown tab in the address as the overview', async () => {
      renderReport('?tab=bogus');
      expect(
        await screen.findByRole('list', { name: 'Alert timeline' }),
      ).toBeInTheDocument();
    });

    it('keeps the chosen tab in the address, and the overview leaves it out', async () => {
      const user = userEvent.setup();
      renderReport();
      await screen.findByRole('heading', { name: 'Kelani River Flood' });

      await user.click(screen.getByRole('tab', { name: 'Shelter Occupancy' }));
      expect(
        await screen.findByRole('table', {
          name: 'Shelters and their occupancy',
        }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Overview' }));
      expect(
        await screen.findByRole('list', { name: 'Alert timeline' }),
      ).toBeInTheDocument();
    });

    it('moves between sections with the arrow keys', async () => {
      const user = userEvent.setup();
      renderReport();
      await screen.findByRole('heading', { name: 'Kelani River Flood' });

      screen.getByRole('tab', { name: 'Overview' }).focus();
      await user.keyboard('{ArrowRight}{ArrowRight}');

      expect(
        screen.getByRole('tab', { name: 'Resource Distribution' }),
      ).toHaveFocus();
      expect(
        await screen.findByRole('table', { name: 'Resources distributed' }),
      ).toBeInTheDocument();
    });
  });

  describe('missing data', () => {
    beforeEach(() => {
      vi.mocked(generateReport).mockResolvedValue(emptyReport());
    });

    it('shows a dash and a note where there is no peak', async () => {
      renderReport();
      await screen.findByText('Data Incomplete');
      expect(
        screen.getByText('Peak Shelter Occupancy').previousElementSibling,
      ).toHaveTextContent('–');
      expect(screen.getByText('No readings recorded')).toBeInTheDocument();
      expect(screen.getByText('0.0% of 0 targeted')).toBeInTheDocument();
    });

    it('explains each empty section instead of drawing an empty chart', async () => {
      const user = userEvent.setup();
      renderReport();
      expect(
        await screen.findByText('No warnings were issued for this scope'),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: 'Shelter Occupancy' }));
      expect(
        screen.getByText('No shelter data recorded for this scope'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();

      await user.click(
        screen.getByRole('tab', { name: 'Resource Distribution' }),
      );
      expect(
        screen.getByText('No resource distribution recorded for this scope'),
      ).toBeInTheDocument();
    });
  });

  it('does not show the sample-data notice for real events', async () => {
    vi.mocked(generateReport).mockResolvedValue(
      report({ event: event({ isDemoData: false }) }),
    );
    renderReport();
    await screen.findByRole('heading', { name: 'Kelani River Flood' });
    expect(screen.queryByText(/Sample data/)).not.toBeInTheDocument();
  });

  it('shows a loading state while the report is built', () => {
    vi.mocked(generateReport).mockReturnValue(new Promise(() => undefined));
    renderReport();
    expect(
      screen.getByRole('status', { name: 'Generating report' }),
    ).toBeInTheDocument();
  });

  describe('when generation fails', () => {
    it('shows the failure and Retry, and no part of a report', async () => {
      vi.mocked(generateReport).mockRejectedValue(
        new ApiError(503, 'Report generation failed. Please try again.'),
      );
      renderReport();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(
        'Report generation failed. Please try again.',
      );
      expect(screen.queryByText('Alerts Issued')).not.toBeInTheDocument();
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Data (Complete|Incomplete)/),
      ).not.toBeInTheDocument();
    });

    it('builds the report when Retry works', async () => {
      const user = userEvent.setup();
      vi.mocked(generateReport).mockRejectedValueOnce(new ApiError(503, 'x'));
      renderReport();

      await user.click(await screen.findByRole('button', { name: 'Retry' }));

      expect(
        await screen.findByRole('heading', { name: 'Kelani River Flood' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('describes a network failure, and offers a way back to the scope', async () => {
      const user = userEvent.setup();
      vi.mocked(generateReport).mockRejectedValue(new NetworkError());
      renderReport();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Cannot reach the server',
      );
      await user.click(screen.getByRole('link', { name: 'Change scope' }));
      expect(await screen.findByText('Scope page')).toBeInTheDocument();
    });

    it('explains a 409 for an event that is not completed', async () => {
      vi.mocked(generateReport).mockRejectedValue(new ApiError(409, 'x'));
      renderReport();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Only completed events can be analysed.',
      );
    });
  });

  it('regenerates the report on request', async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findByRole('heading', { name: 'Kelani River Flood' });
    const calls = vi.mocked(generateReport).mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Regenerate' }));

    await waitFor(() =>
      expect(vi.mocked(generateReport).mock.calls.length).toBeGreaterThan(
        calls,
      ),
    );
  });

  it('goes back to the scope page', async () => {
    const user = userEvent.setup();
    renderReport();
    await screen.findByRole('heading', { name: 'Kelani River Flood' });
    await user.click(screen.getByRole('link', { name: 'Change scope' }));
    expect(await screen.findByText('Scope page')).toBeInTheDocument();
  });
});
