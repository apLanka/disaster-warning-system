import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { decidedReport, minutesAgo, NOW, report } from '../../test/fixtures';
import { ReportsTable } from './ReportsTable';

function show(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ReportsTable', () => {
  it('shows one row per report with its key facts', () => {
    show(
      <ReportsTable
        reports={[report()]}
        firstRow={1}
        mode="pending"
        now={NOW}
      />,
    );

    const row = screen.getAllByRole('row')[1]!;
    expect(within(row).getByText('HR-2026-0412')).toBeInTheDocument();
    expect(within(row).getByText('Rising River Level')).toBeInTheDocument();
    expect(within(row).getByText('7.2906° N, 80.6337° E')).toBeInTheDocument();
    expect(within(row).getByText('Nimal Perera')).toBeInTheDocument();
    expect(within(row).getByText('2 mins ago')).toBeInTheDocument();
  });

  it('continues the row numbers across pages', () => {
    show(
      <ReportsTable
        reports={[report({ id: 'a' }), report({ id: 'b' })]}
        firstRow={11}
        mode="pending"
        now={NOW}
      />,
    );

    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('calls an unnamed reporter an anonymous citizen', () => {
    show(
      <ReportsTable
        reports={[report({ reporterName: undefined })]}
        firstRow={1}
        mode="pending"
        now={NOW}
      />,
    );

    expect(screen.getByText('Anonymous citizen')).toBeInTheDocument();
  });

  it('links View to the review page and names the report for screen readers', () => {
    show(
      <ReportsTable
        reports={[report()]}
        firstRow={1}
        mode="pending"
        now={NOW}
      />,
    );

    const link = screen.getByRole('link', { name: 'View report HR-2026-0412' });
    expect(link).toHaveAttribute('href', '/reports/665f1f77bcf86cd799439011');
  });

  it('highlights a report that has waited more than 30 minutes, in words as well as colour', () => {
    show(
      <ReportsTable
        reports={[
          report({ id: 'old', createdAt: minutesAgo(45) }),
          report({ id: 'new', createdAt: minutesAgo(10) }),
        ]}
        firstRow={1}
        mode="pending"
        now={NOW}
      />,
    );

    expect(screen.getAllByText(/waiting more than 30 minutes/)).toHaveLength(1);
    expect(screen.getByText('45 mins ago').closest('span')).toHaveClass(
      'bg-warning-tint',
    );
    expect(screen.getByText('10 mins ago')).not.toHaveClass('bg-warning-tint');
  });

  it('does not flag a report at exactly 30 minutes', () => {
    show(
      <ReportsTable
        reports={[report({ createdAt: minutesAgo(30) })]}
        firstRow={1}
        mode="pending"
        now={NOW}
      />,
    );

    expect(screen.queryByText(/waiting more than/)).not.toBeInTheDocument();
  });

  it('shows the outcome instead of the wait time on decided lists', () => {
    show(
      <ReportsTable
        reports={[decidedReport('REJECTED')]}
        firstRow={1}
        mode="decided"
        now={NOW}
      />,
    );

    expect(
      screen.getByRole('columnheader', { name: 'Decision' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText(/Insufficient information/)).toBeInTheDocument();
    expect(screen.queryByText(/waiting more than/)).not.toBeInTheDocument();
  });

  it('shows a verified outcome without a reason', () => {
    show(
      <ReportsTable
        reports={[decidedReport('VERIFIED')]}
        firstRow={1}
        mode="decided"
        now={NOW}
      />,
    );

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('5 mins ago')).toBeInTheDocument();
  });
});
