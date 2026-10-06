import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span aria-hidden="true" className="text-muted">
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      {description && <p className="text-muted text-sm">{description}</p>}
      {action}
    </div>
  );
}
