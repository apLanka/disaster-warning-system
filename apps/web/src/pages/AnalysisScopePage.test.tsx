import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEvent } from '../api/analysis';
import { ApiError } from '../api/client';
import { event } from '../test/analysisFixtures';
import { renderPage } from '../test/render';
import { AnalysisScopePage } from './AnalysisScopePage';

vi.mock('../api/analysis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/analysis')>()),
  getEvent: vi.fn(),
}));

function Where() {
  const { pathname, search } = useLocation();
  return <p>{`Now at ${pathname}${search}`}</p>;
}

function renderScope(id = 'abc') {
  return renderPage(
    <Routes>
      <Route path="/analysis/:eventId" element={<AnalysisScopePage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { at: `/analysis/${id}` },
  );
}

describe('AnalysisScopePage', () => {
  beforeEach(() => {
    vi.mocked(getEvent)
      .mockReset()
      .mockResolvedValue(event({ id: 'abc' }));
  });

  it('shows the selected event read-only, with the report contents', async () => {
    renderScope();

    expect(await screen.findByText('Kelani River Flood')).toBeInTheDocument();
    expect(screen.getByText('DE-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Flood')).toBeInTheDocument();
    expect(screen.getByText('Colombo, Gampaha, Kalutara')).toBeInTheDocument();
    expect(screen.getByText('10 Mar 2026 - 12 Mar 2026')).toBeInTheDocument();
    expect(screen.getByText('Alert timeline')).toBeInTheDocument();
    expect(
      screen.getByText('Resource distribution by district'),
    ).toBeInTheDocument();
    expect(getEvent).toHaveBeenCalledWith('abc', expect.any(AbortSignal));
  });

  it('defaults to all districts and generates the report for them', async () => {
    const user = userEvent.setup();
    renderScope();
    await screen.findByText('Kelani River Flood');

    expect(
      screen.getByRole('radio', { name: 'All affected districts' }),
    ).toBeChecked();
    expect(screen.queryByLabelText(/District/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generate Report' }));

    expect(
      await screen.findByText('Now at /analysis/abc/report'),
    ).toBeInTheDocument();
  });

  it("offers only the event's districts when a specific district is chosen", async () => {
    const user = userEvent.setup();
    renderScope();
    await screen.findByText('Kelani River Flood');

    await user.click(screen.getByRole('radio', { name: 'Specific district' }));

    const select = screen.getByLabelText(/District/);
    const options = Array.from(select.querySelectorAll('option')).map(
      (o) => o.textContent,
    );
    expect(options).toEqual([
      'Select a district',
      'Colombo',
      'Gampaha',
      'Kalutara',
    ]);
  });

  it('requires a district when specific is chosen, then clears the message once chosen', async () => {
    const user = userEvent.setup();
    renderScope();
    await screen.findByText('Kelani River Flood');
    await user.click(screen.getByRole('radio', { name: 'Specific district' }));

    await user.click(screen.getByRole('button', { name: 'Generate Report' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Select a district');
    expect(screen.getByLabelText(/District/)).toBeInvalid();
    expect(screen.queryByText(/Now at/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/District/), 'GMP');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generate Report' }));
    expect(
      await screen.findByText('Now at /analysis/abc/report?district=GMP'),
    ).toBeInTheDocument();
  });

  it('drops the district message when going back to all districts', async () => {
    const user = userEvent.setup();
    renderScope();
    await screen.findByText('Kelani River Flood');
    await user.click(screen.getByRole('radio', { name: 'Specific district' }));
    await user.click(screen.getByRole('button', { name: 'Generate Report' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(
      screen.getByRole('radio', { name: 'All affected districts' }),
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('goes back to the events list', async () => {
    const user = userEvent.setup();
    renderScope();
    await screen.findByText('Kelani River Flood');

    await user.click(screen.getByRole('link', { name: 'Back' }));

    expect(await screen.findByText('Now at /analysis')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    vi.mocked(getEvent).mockReturnValue(new Promise(() => undefined));
    renderScope();
    expect(
      screen.getByRole('status', { name: 'Loading event' }),
    ).toBeInTheDocument();
  });

  it('shows an error with Retry, and recovers', async () => {
    const user = userEvent.setup();
    vi.mocked(getEvent).mockRejectedValueOnce(
      new ApiError(404, 'Disaster event not found'),
    );
    renderScope();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This disaster event could not be found.');
    expect(
      screen.queryByRole('button', { name: 'Generate Report' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(screen.getByText('Kelani River Flood')).toBeInTheDocument(),
    );
  });
});
