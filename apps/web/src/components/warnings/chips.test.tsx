import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { levelColor } from '../../lib/warningLevels';
import { LevelChip } from './LevelChip';
import { WarningStatusChip } from './WarningStatusChip';

describe('warning chips', () => {
  it('labels each level', () => {
    render(<LevelChip level="CRITICAL" />);
    expect(screen.getByText('Critical')).toHaveClass('bg-danger');
  });

  it('shows the status, or Expired once an issued warning is over', () => {
    const { rerender } = render(
      <WarningStatusChip
        warning={{ status: 'PARTIALLY_DISSEMINATED', active: true }}
      />,
    );
    expect(screen.getByText('Partially Disseminated')).toBeInTheDocument();

    rerender(
      <WarningStatusChip warning={{ status: 'DISSEMINATED', active: false }} />,
    );
    expect(screen.getByText('Expired')).toBeInTheDocument();

    rerender(
      <WarningStatusChip warning={{ status: 'DRAFT', active: false }} />,
    );
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('falls back to navy when the theme is not loaded', () => {
    expect(levelColor('HIGH')).toBe('#17324d');
  });
});
