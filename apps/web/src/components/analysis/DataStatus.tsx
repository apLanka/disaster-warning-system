import { CircleAlert, CircleCheck } from 'lucide-react';

import type { DataStatus as DataStatusDto } from '@repo/types';

/** Says whether the report is complete, and if not, exactly what is missing or pending. */
export function DataStatus({ status }: { status: DataStatusDto }) {
  if (status.complete) {
    return (
      <p className="bg-success-tint text-success inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
        <CircleCheck aria-hidden="true" className="size-4" />
        Data Complete
      </p>
    );
  }
  return (
    <div className="bg-warning-tint text-warning-text space-y-2 rounded-lg p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold">
        <CircleAlert aria-hidden="true" className="size-4" />
        Data Incomplete
      </p>
      <ul
        aria-label="Reasons the data is incomplete"
        className="list-disc pl-6"
      >
        {status.issues.map((issue) => (
          <li key={issue.kind}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}
