import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { report } from '../../test/analysisFixtures';
import { AlertTimeline } from './AlertTimeline';

describe('AlertTimeline', () => {
  const items = report().alertTimeline;

  it('lists every alert in the order given, as a list', () => {
    render(<AlertTimeline items={items} />);
    const list = screen.getByRole('list', { name: 'Alert timeline' });
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(3);
    expect(entries[0]).toHaveTextContent('Initial Alert');
    expect(entries[1]).toHaveTextContent('Escalation');
    expect(entries[2]).toHaveTextContent('Final Notice');
  });

  it('shows the time, the level in words, the title and the reach', () => {
    render(<AlertTimeline items={items} />);
    const first = screen.getAllByRole('listitem')[0]!;
    expect(first).toHaveTextContent('10 Mar, 09:30');
    expect(first).toHaveTextContent('Medium · Flood alert issued');
    expect(first).toHaveTextContent('Reached 40,000 of 50,000');
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent('High');
  });

  it('renders an empty list for no alerts', () => {
    render(<AlertTimeline items={[]} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
