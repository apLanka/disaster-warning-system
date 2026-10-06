/** A grey placeholder shaped like the content that is loading. Hidden from screen readers. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-neutral-tint animate-pulse rounded ${className}`}
    />
  );
}
