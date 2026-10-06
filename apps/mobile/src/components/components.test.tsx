import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { REPORT_STATUS_LABELS, REPORT_STATUSES } from '@repo/types';

import { Banner } from './Banner';
import { Button } from './Button';
import { FormField } from './FormField';
import { ResultCard } from './ResultCard';
import { SelectField } from './SelectField';
import { StatusChip } from './StatusChip';

describe('Button', () => {
  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('cannot be pressed while loading, and says it is busy', async () => {
    const onPress = jest.fn();
    await render(<Button title="Submit Report" loading onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Submit Report' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
  });

  it('cannot be pressed when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Edit" disabled onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('passes on an accessibility hint', async () => {
    await render(
      <Button
        title="Go"
        accessibilityHint="Opens the form"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Go' })).toHaveProp(
      'accessibilityHint',
      'Opens the form',
    );
  });
});

describe('StatusChip', () => {
  it.each(REPORT_STATUSES)(
    'shows the shared label for %s as text',
    async (status) => {
      await render(<StatusChip status={status} />);

      expect(screen.getByText(REPORT_STATUS_LABELS[status])).toBeOnTheScreen();
    },
  );
});

describe('Banner', () => {
  it('announces an error as an alert', async () => {
    await render(<Banner tone="danger">Could not send</Banner>);

    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(screen.getByText('Could not send')).toBeOnTheScreen();
  });

  it.each(['warning', 'success'] as const)(
    'shows a %s message without an alert role',
    async (tone) => {
      await render(<Banner tone={tone}>Heads up</Banner>);

      expect(screen.getByText('Heads up')).toBeOnTheScreen();
      expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    },
  );

  it('shows an action under the message', async () => {
    const onPress = jest.fn();
    await render(
      <Banner
        tone="danger"
        action={<Button title="Dismiss" variant="ghost" onPress={onPress} />}
      >
        Failed
      </Banner>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onPress).toHaveBeenCalled();
  });
});

describe('FormField', () => {
  it('shows its label, a required marker, and a hint', async () => {
    await render(
      <FormField label="Description" required hint="0 of 1000 characters">
        <Text>input</Text>
      </FormField>,
    );

    expect(screen.getByText(/Description/)).toBeOnTheScreen();
    expect(screen.getByText('0 of 1000 characters')).toBeOnTheScreen();
  });

  it('shows an error as an alert in place of the hint', async () => {
    await render(
      <FormField label="Description" hint="a hint" error="Too short">
        <Text>input</Text>
      </FormField>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
    expect(screen.queryByText('a hint')).not.toBeOnTheScreen();
  });
});

describe('SelectField', () => {
  const options = [
    { value: 'FLOOD', label: 'Flood' },
    { value: 'LANDSLIDE', label: 'Landslide' },
  ] as const;

  function field(
    value: 'FLOOD' | 'LANDSLIDE' | null,
    onChange = jest.fn(),
    error?: string,
  ) {
    return (
      <SelectField
        label="Hazard Type"
        required
        placeholder="Select Type"
        value={value}
        options={[...options]}
        onChange={onChange}
        error={error}
      />
    );
  }

  it('shows the placeholder until something is chosen', async () => {
    await render(field(null));

    expect(screen.getByText('Select Type')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Hazard Type: Select Type' }),
    ).toBeOnTheScreen();
  });

  it('shows the chosen option', async () => {
    await render(field('LANDSLIDE'));

    expect(
      screen.getByRole('button', { name: 'Hazard Type: Landslide' }),
    ).toBeOnTheScreen();
  });

  it('opens a list, and choosing an option reports it and closes the list', async () => {
    const onChange = jest.fn();
    await render(field(null, onChange));

    await fireEvent.press(
      screen.getByRole('button', { name: 'Hazard Type: Select Type' }),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Flood' }));

    expect(onChange).toHaveBeenCalledWith('FLOOD');
    expect(
      screen.queryByRole('radio', { name: 'Flood' }),
    ).not.toBeOnTheScreen();
  });

  it('marks the current choice as selected', async () => {
    await render(field('FLOOD'));

    await fireEvent.press(
      screen.getByRole('button', { name: 'Hazard Type: Flood' }),
    );

    expect(screen.getByRole('radio', { name: 'Flood' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Landslide' })).not.toBeSelected();
  });

  it('can be cancelled without choosing', async () => {
    const onChange = jest.fn();
    await render(field(null, onChange));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Hazard Type: Select Type' }),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('radio', { name: 'Flood' }),
    ).not.toBeOnTheScreen();
  });

  it('shows an error under the field', async () => {
    await render(field(null, jest.fn(), 'Choose the type of hazard.'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose the type of hazard.',
    );
  });
});

describe('ResultCard', () => {
  it('shows a heading, a message, and extra content', async () => {
    await render(
      <ResultCard
        tone="success"
        title="Report Submitted"
        message="Waiting for verification."
      >
        <Text>extra</Text>
      </ResultCard>,
    );

    expect(
      screen.getByRole('header', { name: 'Report Submitted' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Waiting for verification.')).toBeOnTheScreen();
    expect(screen.getByText('extra')).toBeOnTheScreen();
  });

  it('also renders in the warning tone', async () => {
    await render(
      <ResultCard
        tone="warning"
        title="Report Saved"
        message="Saved offline."
      />,
    );

    expect(screen.getByText('Report Saved')).toBeOnTheScreen();
  });
});
