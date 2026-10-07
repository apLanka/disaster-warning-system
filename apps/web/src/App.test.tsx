import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getReport, getStats, listReports } from './api/hazardReports';
import App from './App';
import { page, report, stats } from './test/fixtures';

vi.mock('./api/hazardWarnings', () => ({
  getWarningStats: vi
    .fn()
    .mockResolvedValue({ active: 0, drafts: 0, issuedToday: 0 }),
  listWarnings: vi
    .fn()
    .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
  describeWarningError: () => 'error',
}));
vi.mock('./components/warnings/DistrictMap', () => ({
  DistrictMap: () => <div>district map</div>,
}));
vi.mock('./api/hazardReports', () => ({
  getReport: vi.fn(),
  getStats: vi.fn(),
  listReports: vi.fn(),
  verifyReport: vi.fn(),
  rejectReport: vi.fn(),
}));
vi.mock('./api/health', () => ({
  fetchHealth: vi
    .fn()
    .mockResolvedValue({ status: 'ok', service: 'api', timestamp: '' }),
}));
vi.mock('./components/reports/LocationMap', () => ({
  LocationMap: () => <div>map</div>,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  beforeEach(() => {
    vi.mocked(getStats).mockReset().mockResolvedValue(stats);
    vi.mocked(listReports)
      .mockReset()
      .mockResolvedValue(page([report()]));
    vi.mocked(getReport).mockReset().mockResolvedValue(report());
  });

  it('sends the home address to the pending reports', async () => {
    renderAt('/');

    expect(
      await screen.findByRole('heading', { name: 'Pending Hazard Reports' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Pending Hazard Reports · DMC Portal');
  });

  it.each([
    ['/reports/pending', 'Pending Hazard Reports', 'PENDING_VERIFICATION'],
    ['/reports/verified', 'Verified Reports', 'VERIFIED'],
    ['/reports/rejected', 'Rejected Reports', 'REJECTED'],
  ])('serves %s', async (path, heading, status) => {
    renderAt(path);

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
    expect(listReports).toHaveBeenCalledWith(
      expect.objectContaining({ status }),
      expect.anything(),
    );
  });

  it('opens a single report for review, not mistaken for a list', async () => {
    renderAt('/reports/665f1f77bcf86cd799439011');

    expect(
      await screen.findByRole('heading', { name: 'Review Hazard Report' }),
    ).toBeInTheDocument();
    expect(getReport).toHaveBeenCalledWith(
      '665f1f77bcf86cd799439011',
      expect.anything(),
    );
    expect(document.title).toBe('Review HR-2026-0412 · DMC Portal');
  });

  it('shows a not-found page, inside the layout, for an unknown address', async () => {
    renderAt('/nowhere');

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Main' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Go to pending reports' }),
    ).toHaveAttribute('href', '/reports/pending');
  });

  it.each([
    ['/warnings/new', 'Issue Hazard Warning'],
    ['/warnings', 'Hazard Warnings'],
  ])('serves %s', async (path, heading) => {
    renderAt(path);

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
  });
});
