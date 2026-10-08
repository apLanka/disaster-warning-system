import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { ReportTabs } from './ReportTabs';

type Id = 'a' | 'b' | 'c';
const tabs = [
  { id: 'a' as const, label: 'First', panel: <p>Panel A</p> },
  { id: 'b' as const, label: 'Second', panel: <p>Panel B</p> },
  { id: 'c' as const, label: 'Third', panel: <p>Panel C</p> },
];

function Harness({ initial = 'a' as Id }) {
  const [selected, setSelected] = useState<Id>(initial);
  return (
    <ReportTabs
      label="Sections"
      tabs={tabs}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

describe('ReportTabs', () => {
  it('shows the selected tab and only its panel, wired up for assistive technology', () => {
    render(<Harness initial="b" />);

    const tablist = screen.getByRole('tablist', { name: 'Sections' });
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByText('Panel B')).toBeInTheDocument();
    expect(screen.queryByText('Panel A')).not.toBeInTheDocument();
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAccessibleName('Second');
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute(
      'aria-controls',
      panel.id,
    );
  });

  it('has a single tab stop: only the selected tab is focusable by Tab', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  it('switches on click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'Third' }));
    expect(screen.getByText('Panel C')).toBeInTheDocument();
  });

  it('moves with the arrow keys, wrapping at both ends, and moves focus too', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('tab', { name: 'First' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveFocus();
    expect(screen.getByText('Panel B')).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Third' })).toHaveFocus();
    expect(screen.getByText('Panel C')).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'First' })).toHaveFocus();
  });

  it('jumps to the first and last tab with Home and End', async () => {
    const user = userEvent.setup();
    render(<Harness initial="b" />);
    screen.getByRole('tab', { name: 'Second' }).focus();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Third' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'First' })).toHaveFocus();
  });

  it('ignores other keys', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('tab', { name: 'First' }).focus();
    await user.keyboard('x');
    expect(screen.getByText('Panel A')).toBeInTheDocument();
  });

  it('falls back to the first tab when the selected id is unknown', () => {
    render(
      <ReportTabs
        label="Sections"
        tabs={tabs}
        selected={'zzz' as Id}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
