import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BarChart } from './BarChart';

const bars = [
  { label: 'Colombo', value: 2500 },
  { label: 'Gampaha', value: 900 },
];

const props = { valueLabel: 'Quantity distributed', labelHeading: 'District' };

describe('BarChart', () => {
  it('describes the bars in words', () => {
    render(<BarChart bars={bars} {...props} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Quantity distributed for 2 districts: Colombo 2,500, Gampaha 900.',
    );
  });

  it('draws one bar per item, with the tallest for the largest value', () => {
    render(<BarChart bars={bars} {...props} />);
    const heights = screen
      .getAllByTestId('bar')
      .map((bar) => Number(bar.getAttribute('height')));
    expect(heights).toHaveLength(2);
    expect(heights[0]).toBeGreaterThan(heights[1]!);
    expect(heights[1]).toBeGreaterThan(0);
  });

  it('puts the same numbers in a table', () => {
    render(<BarChart bars={bars} {...props} />);
    const table = screen.getByRole('table', { name: 'Quantity distributed' });
    expect(
      within(table).getByRole('columnheader', { name: 'District' }),
    ).toBeInTheDocument();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Colombo2,500',
      'Gampaha900',
    ]);
  });

  it('uses the singular for one district', () => {
    render(<BarChart bars={[bars[0]!]} {...props} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/for 1 district:/);
  });

  it('copes with no bars', () => {
    const { container } = render(<BarChart bars={[]} {...props} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'No quantity distributed recorded',
    );
    expect(screen.queryByTestId('bar')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('copes with all zero values', () => {
    const { container } = render(
      <BarChart bars={[{ label: 'Colombo', value: 0 }]} {...props} />,
    );
    expect(screen.getByTestId('bar')).toHaveAttribute('height', '0');
    expect(container.innerHTML).not.toContain('NaN');
  });
});
