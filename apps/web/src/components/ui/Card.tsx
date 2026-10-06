import type { ReactNode } from 'react';

interface CardProps {
  /** Small uppercase section label, e.g. "1. Report Details". */
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <section
      aria-label={title}
      className={`border-border bg-surface rounded-xl border p-4 shadow-sm ${className}`}
    >
      {title && (
        <h2 className="text-muted mb-3 text-xs font-semibold tracking-wide uppercase">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
