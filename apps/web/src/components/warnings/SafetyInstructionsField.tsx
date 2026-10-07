import { Plus, Trash2 } from 'lucide-react';

import { WARNING_LIMITS } from '@repo/types';

import { Button } from '../ui/Button';
import { INPUT_CLASSES } from '../ui/Field';

interface SafetyInstructionsFieldProps {
  value: string[];
  onChange: (rows: string[]) => void;
  error?: string;
}

/** Numbered steps the phone shows under the warning (finding UI2). Blank rows are dropped on save. */
export function SafetyInstructionsField({
  value,
  onChange,
  error,
}: SafetyInstructionsFieldProps) {
  const setRow = (index: number, text: string) =>
    onChange(value.map((row, i) => (i === index ? text : row)));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
        Safety instructions
        <span className="text-danger" aria-hidden="true">
          {' '}
          *
        </span>
      </legend>
      <ol className="space-y-2">
        {value.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <span aria-hidden="true" className="text-muted w-5 text-sm">
              {index + 1}.
            </span>
            <input
              id={`warning-instruction-${index}`}
              aria-label={`Safety instruction ${index + 1}`}
              aria-invalid={error && index === 0 ? true : undefined}
              aria-describedby={
                error && index === 0 ? 'safety-instructions-error' : undefined
              }
              maxLength={WARNING_LIMITS.instructionMax}
              placeholder="e.g. Move to higher ground immediately"
              className={INPUT_CLASSES}
              value={row}
              onChange={(event) => setRow(index, event.target.value)}
            />
            {value.length > 1 && (
              <button
                type="button"
                aria-label={`Remove instruction ${index + 1}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="text-muted hover:text-danger rounded-lg p-2"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ol>
      {value.length < WARNING_LIMITS.instructionsMax && (
        <Button
          variant="ghost"
          className="self-start"
          icon={<Plus aria-hidden="true" className="size-4" />}
          onClick={() => onChange([...value, ''])}
        >
          Add instruction
        </Button>
      )}
      {error && (
        <p
          id="safety-instructions-error"
          role="alert"
          className="text-danger text-sm"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}
