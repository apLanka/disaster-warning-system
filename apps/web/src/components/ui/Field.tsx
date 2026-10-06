import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Label above, helper or error text below (style guide 5.2). */
export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="text-muted text-xs font-semibold tracking-wide uppercase"
      >
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : (
        hint && <p className="text-muted text-sm">{hint}</p>
      )}
    </div>
  );
}

export const INPUT_CLASSES =
  'border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-40 aria-invalid:border-danger';
