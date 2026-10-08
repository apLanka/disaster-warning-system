import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { District } from '@repo/types';

import { DistrictPicker } from './DistrictPicker';
import { LevelPicker } from './LevelPicker';
import { SafetyInstructionsField } from './SafetyInstructionsField';

function Districts({ initial = [] as District[] }) {
  const [value, setValue] = useState<District[]>(initial);
  return <DistrictPicker value={value} onChange={setValue} />;
}

function Instructions({ initial }: { initial: string[] }) {
  const [value, setValue] = useState(initial);
  return <SafetyInstructionsField value={value} onChange={setValue} />;
}

describe('LevelPicker', () => {
  it('is a radio group that reports the chosen level and shows an error', async () => {
    const onChange = vi.fn();
    render(
      <LevelPicker
        value="HIGH"
        onChange={onChange}
        error="Choose a warning level."
      />,
    );

    expect(screen.getByRole('radio', { name: 'High' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Critical' }));
    expect(onChange).toHaveBeenCalledWith('CRITICAL');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose a warning level.',
    );
  });
});

describe('DistrictPicker', () => {
  it('suggests matching districts and adds one by click or Enter', async () => {
    render(<Districts />);

    await userEvent.type(screen.getByLabelText(/Affected districts/), 'gam');
    await userEvent.click(screen.getByRole('button', { name: 'Gampaha' }));
    await userEvent.type(
      screen.getByLabelText(/Affected districts/),
      'colo{Enter}',
    );

    const selected = screen.getByRole('list', { name: 'Selected districts' });
    expect(selected).toHaveTextContent('Gampaha');
    expect(selected).toHaveTextContent('Colombo');
  });

  it('does not suggest a district that is already selected, and removes one', async () => {
    render(<Districts initial={['COLOMBO']} />);

    await userEvent.type(
      screen.getByLabelText(/Affected districts/),
      'colombo',
    );
    expect(
      screen.queryByRole('list', { name: 'Matching districts' }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Colombo' }),
    );
    expect(
      screen.queryByRole('list', { name: 'Selected districts' }),
    ).not.toBeInTheDocument();
  });
});

describe('SafetyInstructionsField', () => {
  it('adds, edits and removes numbered rows', async () => {
    render(<Instructions initial={['Move to higher ground']} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Add instruction' }),
    );
    await userEvent.type(
      screen.getByLabelText('Safety instruction 2'),
      'Keep a kit ready',
    );
    expect(screen.getByLabelText('Safety instruction 2')).toHaveValue(
      'Keep a kit ready',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove instruction 1' }),
    );
    expect(screen.getByLabelText('Safety instruction 1')).toHaveValue(
      'Keep a kit ready',
    );
    expect(
      screen.queryByRole('button', { name: /Remove instruction/ }),
    ).not.toBeInTheDocument();
  });

  it('stops offering rows at the limit', () => {
    render(<Instructions initial={Array(8).fill('Stay indoors')} />);
    expect(
      screen.queryByRole('button', { name: 'Add instruction' }),
    ).not.toBeInTheDocument();
  });
});
