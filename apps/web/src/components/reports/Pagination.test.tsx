import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing when there are no reports', () => {
    const { container } = render(
      <Pagination page={1} limit={10} total={0} onChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('says which reports are shown', () => {
    render(<Pagination page={2} limit={10} total={25} onChange={vi.fn()} />);

    expect(screen.getByText('Showing 11–20 of 25 reports')).toBeInTheDocument();
  });

  it('caps the range on the last page', () => {
    render(<Pagination page={3} limit={10} total={25} onChange={vi.fn()} />);

    expect(screen.getByText('Showing 21–25 of 25 reports')).toBeInTheDocument();
  });

  it('marks the current page and moves between pages', async () => {
    const onChange = vi.fn();
    render(<Pagination page={2} limit={10} total={30} onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Previous page' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }));

    expect(onChange.mock.calls).toEqual([[3], [1], [3]]);
  });

  it('cannot go before the first or after the last page', () => {
    const { rerender } = render(
      <Pagination page={1} limit={10} total={30} onChange={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: 'Previous page' }),
    ).toBeDisabled();

    rerender(<Pagination page={3} limit={10} total={30} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('shows a single page for a short list', () => {
    render(<Pagination page={1} limit={10} total={4} onChange={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: /^Page/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('shows only a window of page numbers for a long list', () => {
    render(<Pagination page={10} limit={10} total={200} onChange={vi.fn()} />);

    const numbers = screen
      .getAllByRole('button', { name: /^Page/ })
      .map((button) => button.textContent);
    expect(numbers).toEqual(['8', '9', '10', '11', '12']);
  });
});
