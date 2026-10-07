import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStats } from '../api/hazardReports';
import {
  createWarning,
  getPrefill,
  getWarning,
  updateDraft,
} from '../api/hazardWarnings';
import { stats, warning } from '../test/fixtures';
import { renderPage } from '../test/render';
import { WarningFormPage } from './WarningFormPage';

vi.mock('../api/hazardReports', () => ({ getStats: vi.fn() }));
vi.mock('../api/hazardWarnings', () => ({
  createWarning: vi.fn(),
  updateDraft: vi.fn(),
  getWarning: vi.fn(),
  getPrefill: vi.fn(),
  describeWarningError: (error: Error) => error.message,
}));
vi.mock('../components/warnings/DistrictMap', () => ({
  DistrictMap: ({
    districts,
    onToggle,
  }: {
    districts: string[];
    onToggle: (d: string) => void;
  }) => (
    <button type="button" onClick={() => onToggle('KANDY')}>
      map: {districts.join(',')}
    </button>
  ),
}));

/** Shows where the form navigated and what it carried. */
function Landing() {
  const location = useLocation();
  return (
    <pre data-testid="landing">
      {JSON.stringify({
        path: location.pathname + location.search,
        state: location.state,
      })}
    </pre>
  );
}

function renderForm(at = '/warnings/new', path = '/warnings/new') {
  return renderPage(
    <Routes>
      <Route path={path} element={<WarningFormPage />} />
      <Route path="*" element={<Landing />} />
    </Routes>,
    { at },
  );
}

async function fillRequired() {
  await userEvent.selectOptions(screen.getByLabelText(/Hazard type/), 'FLOOD');
  await userEvent.click(screen.getByRole('radio', { name: 'High' }));
  await userEvent.type(
    screen.getByLabelText(/Description/),
    'Heavy rainfall expected in low-lying areas',
  );
  await userEvent.type(
    screen.getByLabelText('Safety instruction 1'),
    'Move to higher ground',
  );
  await userEvent.type(
    screen.getByLabelText(/Affected districts/),
    'colombo{Enter}',
  );
}

const landing = () =>
  JSON.parse(screen.getByTestId('landing').textContent ?? '{}');

describe('WarningFormPage', () => {
  beforeEach(() => {
    vi.mocked(getStats).mockResolvedValue(stats);
    vi.mocked(createWarning)
      .mockReset()
      .mockResolvedValue(
        warning({ status: 'DRAFT', reference: 'HW-2026-0008' }),
      );
    vi.mocked(updateDraft)
      .mockReset()
      .mockResolvedValue(warning({ status: 'DRAFT' }));
  });

  it('lays out the wireframe sections', async () => {
    renderForm();
    expect(
      await screen.findByRole('heading', { name: 'Issue Hazard Warning' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Warning Incident Details' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Affected Area Map' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save as Draft' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Review Warning' }),
    ).toBeInTheDocument();
  });

  it('blocks review and focuses the first problem', async () => {
    renderForm();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Review Warning' }),
    );

    expect(screen.getByText('Choose a hazard type.')).toBeInTheDocument();
    expect(
      screen.getByText('Add at least one safety instruction.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Hazard type/)).toHaveFocus();
  });

  it('goes to review carrying the form and a request id', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Issue Hazard Warning' });
    await fillRequired();
    await userEvent.click(
      screen.getByRole('button', { name: 'Review Warning' }),
    );

    const { path, state } = landing();
    expect(path).toBe('/warnings/review');
    expect(state.form).toMatchObject({
      hazardType: 'FLOOD',
      level: 'HIGH',
      districts: ['COLOMBO'],
    });
    expect(state.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('adds a district from the map', async () => {
    renderForm();
    await userEvent.click(await screen.findByRole('button', { name: /map:/ }));
    expect(
      screen.getByRole('list', { name: 'Selected districts' }),
    ).toHaveTextContent('Kandy');
  });

  it('saves a new draft and goes to the drafts list', async () => {
    renderForm();
    await screen.findByRole('heading', { name: 'Issue Hazard Warning' });
    await userEvent.selectOptions(
      screen.getByLabelText(/Hazard type/),
      'FLOOD',
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Low' }));
    await userEvent.type(
      screen.getByLabelText(/Affected districts/),
      'kandy{Enter}',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Save as Draft' }),
    );

    await waitFor(() => expect(landing().path).toBe('/warnings?view=drafts'));
    expect(createWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DRAFT',
        level: 'LOW',
        districts: ['KANDY'],
      }),
    );
    expect(landing().state.notice).toBe('Draft HW-2026-0008 saved.');
  });

  it('keeps the entries and explains a failed save', async () => {
    vi.mocked(createWarning).mockRejectedValue(
      new Error('Warning could not be saved. Please try again.'),
    );
    renderForm();
    await screen.findByRole('heading', { name: 'Issue Hazard Warning' });
    await fillRequired();
    await userEvent.click(
      screen.getByRole('button', { name: 'Save as Draft' }),
    );

    expect(
      await screen.findByText('Warning could not be saved. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      'Heavy rainfall expected in low-lying areas',
    );
  });

  it('edits an existing draft', async () => {
    vi.mocked(getWarning).mockResolvedValue({
      ...warning({ id: 'w9', status: 'DRAFT' }),
      logs: [],
      acknowledged: 0,
    });
    renderForm('/warnings/w9/edit', '/warnings/:id/edit');

    expect(
      await screen.findByRole('heading', { name: 'Edit Draft Warning' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Save as Draft' }),
    );

    await waitFor(() =>
      expect(updateDraft).toHaveBeenCalledWith(
        'w9',
        expect.objectContaining({ hazardType: 'FLOOD' }),
      ),
    );
  });

  it('starts from a verified report', async () => {
    vi.mocked(getPrefill).mockResolvedValue({
      hazardType: 'LANDSLIDE',
      districts: ['KANDY'],
      description: 'Slope is moving near the school',
      sourceReportId: 'r1',
      reportReference: 'HR-2026-0042',
    });
    renderForm('/warnings/new?fromReport=r1');

    expect(
      await screen.findByText(/Prefilled from verified report HR-2026-0042/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      'Slope is moving near the school',
    );
  });

  it('restores the entries when coming back from review', async () => {
    renderPage(
      <Routes>
        <Route path="/warnings/new" element={<WarningFormPage />} />
      </Routes>,
      {
        at: {
          pathname: '/warnings/new',
          state: {
            form: { ...warningFormStub(), description: 'Kept from before' },
            clientRequestId: 'c1',
          },
        },
      },
    );
    expect(await screen.findByLabelText(/Description/)).toHaveValue(
      'Kept from before',
    );
  });
});

function warningFormStub() {
  return {
    hazardType: 'FLOOD',
    level: 'HIGH',
    description: '',
    additionalInfo: '',
    safetyInstructions: [''],
    districts: ['COLOMBO'],
    validFrom: '',
    validUntil: '',
  };
}
