import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StepChart } from './StepChart';

const series = [
  { at: '2026-03-10T10:00:00.000Z', occupancy: 120 },
  { at: '2026-03-11T04:00:00.000Z', occupancy: 540 },
  { at: '2026-03-12T04:00:00.000Z', occupancy: 40 },
];

describe('StepChart', () => {
  it('describes the chart in words, with the peak and the span', () => {
    render(<StepChart series={series} />);
    const chart = screen.getByRole('img');
    expect(chart).toHaveAccessibleName(
      /peak of 540 across 3 readings, from 10 Mar, 15:30 to 12 Mar, 09:30/,
    );
  });

  it('draws one step line with a dot per reading', () => {
    const { container } = render(<StepChart series={series} />);
    const path = container.querySelector('path')!;
    expect(path.getAttribute('d')).toMatch(
      /^M[\d.]+,[\d.]+( H[\d.]+ V[\d.]+){2}$/,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(3);
  });

  it('puts the same numbers in a table', () => {
    render(<StepChart series={series} />);
    const table = screen.getByRole('table', {
      name: 'Total shelter occupancy over time',
    });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      '10 Mar, 15:30120',
      '11 Mar, 09:30540',
      '12 Mar, 09:3040',
    ]);
  });

  it('draws the capacity line and mentions it when capacity is given', () => {
    render(<StepChart series={series} capacity={900} />);
    expect(screen.getByTestId('capacity-line')).toBeInTheDocument();
    expect(screen.getByText(/combined capacity \(900\)/)).toBeInTheDocument();
  });

  it('draws no capacity line without capacity', () => {
    render(<StepChart series={series} />);
    expect(screen.queryByTestId('capacity-line')).not.toBeInTheDocument();
  });

  it('copes with no readings', () => {
    const { container } = render(<StepChart series={[]} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'No occupancy readings',
    );
    expect(container.querySelector('path')).toBeNull();
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('copes with a single reading', () => {
    const { container } = render(<StepChart series={[series[0]!]} />);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    expect(container.innerHTML).not.toContain('NaN');
    expect(container.innerHTML).not.toContain('Infinity');
  });

  it('copes with all zeros', () => {
    const { container } = render(
      <StepChart
        series={[
          { at: series[0]!.at, occupancy: 0 },
          { at: series[1]!.at, occupancy: 0 },
        ]}
      />,
    );
    expect(container.innerHTML).not.toContain('NaN');
  });
});
