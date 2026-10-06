import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

export type ButtonVariant =
  'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-orange text-white hover:opacity-90',
  secondary: 'bg-navy text-white hover:bg-navy-hover',
  success: 'bg-success text-white hover:opacity-90',
  danger: 'bg-danger text-white hover:opacity-90',
  ghost: 'border border-border bg-surface text-ink hover:bg-page',
};

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  /** Shows a spinner and blocks further clicks, so a request cannot be sent twice. */
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  loading = false,
  icon,
  className = '',
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
