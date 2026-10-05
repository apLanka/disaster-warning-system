import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getReport, getStats, listReports } from '../api/hazardReports';
import App from '../App';
import { decidedReport, page, report, stats } from './fixtures';

vi.mock('../api/hazardReports', () => ({
  getReport: vi.fn(),
  getStats: vi.fn(),
  listReports: vi.fn(),
  verifyReport: vi.fn(),
  rejectReport: vi.fn(),
}));
vi.mock('../api/health', () => ({
  fetchHealth: vi
    .fn()
    .mockResolvedValue({ status: 'ok', service: 'api', timestamp: '' }),
}));
vi.mock('../components/reports/LocationMap', () => ({
  LocationMap: () => (
    <div role="img" aria-label="Map showing the reported location">
      map
    </div>
  ),
}));

/** Colour contrast needs real layout, which jsdom lacks, so it is checked by hand against the style guide. */
async function violations(container: HTMLElement): Promise<string[]> {
  const result = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return result.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.length})`,
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('accessibility (axe)', () => {
  it('actually catches problems, so a clean result means something', async () => {
    const { container } = render(
      <div>
        <button />
        <img src="x.png" />
      </div>,
    );

    const found = await violations(container);

    expect(found.join(' ')).toMatch(/button-name/);
    expect(found.join(' ')).toMatch(/image-alt/);
  });

  beforeEach(() => {
    vi.mocked(getStats).mockResolvedValue(stats);
    vi.mocked(listReports).mockResolvedValue(
      page([report(), report({ id: 'b' })], { total: 12 }),
    );
    vi.mocked(getReport).mockResolvedValue(
      report({
        photos: [
          {
            publicId: 'p1',
            secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/p1.jpg',
            width: 1,
            height: 1,
            bytes: 1,
          },
          {
            publicId: 'p2',
            secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/p2.jpg',
            width: 1,
            height: 1,
            bytes: 1,
          },
        ],
      }),
    );
  });

  it('pending reports list has no violations', async () => {
    const { container } = renderAt('/reports/pending');
    await screen.findByText('12 reports');

    expect(await violations(container)).toEqual([]);
  });

  it('an empty list has no violations', async () => {
    vi.mocked(listReports).mockResolvedValue(page([]));
    const { container } = renderAt('/reports/verified');
    await screen.findByText('No verified reports yet');

    expect(await violations(container)).toEqual([]);
  });

  it('a failed load has no violations', async () => {
    vi.mocked(listReports).mockRejectedValue(new Error('down'));
    const { container } = renderAt('/reports/pending');
    await screen.findByRole('alert');

    expect(await violations(container)).toEqual([]);
  });

  it('review screen for a pending report has no violations', async () => {
    const { container } = renderAt('/reports/665f1f77bcf86cd799439011');
    await screen.findByRole('heading', { name: 'Review Hazard Report' });

    expect(await violations(container)).toEqual([]);
  });

  it('review screen shows validation errors accessibly', async () => {
    const { container } = renderAt('/reports/665f1f77bcf86cd799439011');
    await screen.findByRole('heading', { name: 'Review Hazard Report' });

    await userEvent.click(
      screen.getByRole('button', { name: 'Reject report' }),
    );

    expect(await violations(container)).toEqual([]);
  });

  it('the confirmation dialog has no violations', async () => {
    const { container } = renderAt('/reports/665f1f77bcf86cd799439011');
    await screen.findByRole('heading', { name: 'Review Hazard Report' });
    await userEvent.selectOptions(
      screen.getByLabelText(/Rejection reason/),
      'DUPLICATE',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reject report' }),
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it.each(['VERIFIED', 'REJECTED'] as const)(
    'review screen for a %s report has no violations',
    async (status) => {
      vi.mocked(getReport).mockResolvedValue(decidedReport(status));
      const { container } = renderAt('/reports/665f1f77bcf86cd799439011');
      await screen.findByRole('heading', { name: 'Review Hazard Report' });

      expect(await violations(container)).toEqual([]);
    },
  );

  it('the not-found page has no violations', async () => {
    const { container } = renderAt('/nowhere');
    await screen.findByText('Page not found');

    expect(await violations(container)).toEqual([]);
  });
});
