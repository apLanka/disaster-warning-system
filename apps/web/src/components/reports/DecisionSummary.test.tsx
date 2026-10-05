import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { decidedReport, NOW, report } from '../../test/fixtures';
import { DecisionSummary } from './DecisionSummary';

describe('DecisionSummary', () => {
  it('shows who verified the report and when', () => {
    render(<DecisionSummary report={decidedReport('VERIFIED')} now={NOW} />);

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Officer Silva')).toBeInTheDocument();
    expect(screen.getByText('Today, 03:25 PM')).toBeInTheDocument();
    expect(screen.getByText('Matches the gauge readings')).toBeInTheDocument();
    expect(screen.queryByText('Reason')).not.toBeInTheDocument();
  });

  it('shows the rejection reason and the details given to the reporter', () => {
    render(<DecisionSummary report={decidedReport('REJECTED')} now={NOW} />);

    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Insufficient information')).toBeInTheDocument();
    expect(screen.getByText('Please add a photo')).toBeInTheDocument();
  });

  it('copes with a report that has no decision recorded', () => {
    render(
      <DecisionSummary report={report({ status: 'VERIFIED' })} now={NOW} />,
    );

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByText('Decided')).not.toBeInTheDocument();
  });
});
