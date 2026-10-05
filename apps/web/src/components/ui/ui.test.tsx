import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { REPORT_STATUS_LABELS, REPORT_STATUSES } from '@repo/types';

import { Banner } from './Banner';
import { Button } from './Button';
import { Card } from './Card';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { Field } from './Field';
import { Skeleton } from './Skeleton';
import { StatCard } from './StatCard';
import { StatusChip } from './StatusChip';

describe('Button', () => {
  it('renders a button that does not submit forms by default', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it.each([
    ['primary', 'bg-orange'],
    ['secondary', 'bg-navy'],
    ['success', 'bg-success'],
    ['danger', 'bg-danger'],
    ['ghost', 'border-border'],
  ] as const)(
    'styles the %s variant from the theme tokens',
    (variant, token) => {
      render(<Button variant={variant}>Go</Button>);

      expect(screen.getByRole('button')).toHaveClass(token);
    },
  );

  it('blocks clicks and announces busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Submitting…
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Submitting…' });
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick when enabled and not when disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);

    await userEvent.click(screen.getByRole('button'));
    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('StatusChip', () => {
  it.each(REPORT_STATUSES)(
    'shows the shared label for %s as text, not just colour',
    (status) => {
      render(<StatusChip status={status} />);

      expect(
        screen.getByText(REPORT_STATUS_LABELS[status]),
      ).toBeInTheDocument();
    },
  );

  it('uses amber for pending verification, green for verified, red for rejected', () => {
    render(
      <>
        <StatusChip status="PENDING_VERIFICATION" />
        <StatusChip status="VERIFIED" />
        <StatusChip status="REJECTED" />
      </>,
    );

    expect(screen.getByText('Pending Verification')).toHaveClass(
      'bg-warning-tint',
    );
    expect(screen.getByText('Verified')).toHaveClass('bg-success-tint');
    expect(screen.getByText('Rejected')).toHaveClass('bg-danger-tint');
  });
});

describe('Banner', () => {
  it('announces errors as alerts', () => {
    render(<Banner tone="danger">Could not load</Banner>);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
  });

  it.each(['warning', 'success'] as const)(
    'announces %s politely as a status',
    (tone) => {
      render(<Banner tone={tone}>Heads up</Banner>);

      expect(screen.getByRole('status')).toHaveTextContent('Heads up');
    },
  );

  it('shows an action such as Retry', async () => {
    const onRetry = vi.fn();
    render(
      <Banner tone="danger" action={<button onClick={onRetry}>Retry</button>}>
        Failed
      </Banner>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('StatCard', () => {
  it('shows the number and its label', () => {
    render(
      <StatCard
        label="Pending Reports"
        value={12}
        icon={<span />}
        tone="warning"
      />,
    );

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Pending Reports')).toBeInTheDocument();
  });

  it('shows a dash while the number is loading, and zero as zero', () => {
    const { rerender } = render(
      <StatCard
        label="Rejected"
        value={undefined}
        icon={<span />}
        tone="danger"
      />,
    );
    expect(screen.getByText('–')).toBeInTheDocument();

    rerender(
      <StatCard label="Rejected" value={0} icon={<span />} tone="danger" />,
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

describe('Card, Field, EmptyState, Skeleton', () => {
  it('names a card region by its title', () => {
    render(<Card title="1. Report Details">content</Card>);

    expect(
      screen.getByRole('region', { name: '1. Report Details' }),
    ).toHaveTextContent('content');
  });

  it('marks required fields and links the label to its input', () => {
    render(
      <Field label="Rejection reason" htmlFor="reason" required>
        <input id="reason" />
      </Field>,
    );

    expect(screen.getByLabelText(/Rejection reason/)).toBeInTheDocument();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows an error as an alert in place of the hint', () => {
    render(
      <Field
        label="Details"
        htmlFor="d"
        hint="Optional"
        error="Details are required"
      >
        <input id="d" />
      </Field>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Details are required');
    expect(screen.queryByText('Optional')).not.toBeInTheDocument();
  });

  it('shows the hint when there is no error', () => {
    render(
      <Field label="Details" htmlFor="d" hint="Shown to the reporter">
        <input id="d" />
      </Field>,
    );

    expect(screen.getByText('Shown to the reporter')).toBeInTheDocument();
  });

  it('shows an empty state with its next action', () => {
    render(
      <EmptyState
        icon={<span />}
        title="No pending reports"
        description="New reports appear here."
        action={<button>Refresh</button>}
      />,
    );

    expect(screen.getByText('No pending reports')).toBeInTheDocument();
    expect(screen.getByText('New reports appear here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('hides skeletons from assistive technology', () => {
    const { container } = render(<Skeleton className="h-4" />);

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ConfirmDialog', () => {
  function setup(
    props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {},
  ) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <>
        <button>Opener</button>
        <ConfirmDialog
          open
          title="Reject this report?"
          confirmLabel="Reject report"
          onConfirm={onConfirm}
          onCancel={onCancel}
          {...props}
        >
          The reporter will be told it was not accepted.
        </ConfirmDialog>
      </>,
    );
    return { onConfirm, onCancel };
  }

  it('renders nothing while closed', () => {
    setup({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a labelled modal dialog that states the consequence', () => {
    setup();

    const dialog = screen.getByRole('dialog', { name: 'Reject this report?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent(
      'The reporter will be told it was not accepted.',
    );
  });

  it('starts on the safe choice, Cancel', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirms and cancels with the buttons', async () => {
    const { onConfirm, onCancel } = setup();

    await userEvent.click(
      screen.getByRole('button', { name: 'Reject report' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('cancels on Escape', async () => {
    const { onCancel } = setup();

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('cancels when the backdrop is clicked but not when the dialog itself is', async () => {
    const { onCancel } = setup();

    await userEvent.click(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('keeps Tab inside the dialog in both directions', async () => {
    setup();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Reject report' });

    await userEvent.tab();
    expect(confirm).toHaveFocus();
    await userEvent.tab();
    expect(cancel).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it('cannot be dismissed while the action is in flight', async () => {
    const { onCancel } = setup({ loading: true });

    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('dialog').parentElement!);

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Reject report' }),
    ).toBeDisabled();
  });

  it('gives focus back to what opened it when it closes', () => {
    const { rerender } = render(
      <>
        <button>Opener</button>
        <ConfirmDialog
          open={false}
          title="T"
          confirmLabel="Go"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        >
          body
        </ConfirmDialog>
      </>,
    );
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();

    rerender(
      <>
        <button>Opener</button>
        <ConfirmDialog
          open
          title="T"
          confirmLabel="Go"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        >
          body
        </ConfirmDialog>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    rerender(
      <>
        <button>Opener</button>
        <ConfirmDialog
          open={false}
          title="T"
          confirmLabel="Go"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        >
          body
        </ConfirmDialog>
      </>,
    );
    expect(opener).toHaveFocus();
  });
});

describe('Field styling', () => {
  it('turns an invalid control red, as the style guide requires', async () => {
    const { INPUT_CLASSES } = await import('./Field');

    expect(INPUT_CLASSES).toContain('aria-invalid:border-danger');
  });
});
