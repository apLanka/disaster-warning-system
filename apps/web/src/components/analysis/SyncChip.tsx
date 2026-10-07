/** Marks a record that has not yet synchronised, so it is never mistaken for settled data. */
export function PendingSyncChip() {
  return (
    <span className="bg-warning-tint text-warning-text inline-flex rounded-full px-2 py-0.5 text-xs font-semibold">
      Pending sync
    </span>
  );
}
