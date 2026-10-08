import {
  WARNING_LEVEL_LABELS,
  WARNING_LEVELS,
  type WarningLevel,
} from '@repo/types';

import { LEVEL_CLASSES } from '../../lib/warningLevels';

interface LevelPickerProps {
  value: WarningLevel | '';
  onChange: (level: WarningLevel) => void;
  error?: string;
}

/** The wireframe's four coloured buttons, as one radio group. */
export function LevelPicker({ value, onChange, error }: LevelPickerProps) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
        Warning level
        <span className="text-danger" aria-hidden="true">
          {' '}
          *
        </span>
      </legend>
      <div
        role="radiogroup"
        aria-label="Warning level"
        aria-describedby={error ? 'warning-level-error' : undefined}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {WARNING_LEVELS.map((level, index) => {
          const checked = value === level;
          return (
            <button
              key={level}
              id={index === 0 ? 'warning-level' : undefined}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(level)}
              className={`h-10 rounded-lg text-sm font-semibold transition ${LEVEL_CLASSES[level]} ${
                checked
                  ? 'ring-ink ring-2 ring-offset-2'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              {WARNING_LEVEL_LABELS[level]}
            </button>
          );
        })}
      </div>
      {error && (
        <p
          id="warning-level-error"
          role="alert"
          className="text-danger text-sm"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}
