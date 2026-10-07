import {
  districtName,
  RESOURCE_TYPE_LABELS,
  type ResourceRow,
} from '@repo/types';

import { formatNumber } from '../../lib/format';
import { PendingSyncChip } from './SyncChip';

const HEAD =
  'text-muted px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase';

export function ResourceTable({ rows }: { rows: ResourceRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">Resources distributed</caption>
        <thead className="bg-page">
          <tr>
            <th scope="col" className={HEAD}>
              District
            </th>
            <th scope="col" className={HEAD}>
              Resource type
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              Quantity
            </th>
            <th scope="col" className={HEAD}>
              Source organisation
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((row, index) => (
            <tr key={index} className="h-12">
              <td className="px-4">{districtName(row.districtCode)}</td>
              <td className="px-4">
                {RESOURCE_TYPE_LABELS[row.resourceType]}
                <span className="text-muted"> · {row.resourceName}</span>
              </td>
              <td className="px-4 text-right">
                {formatNumber(row.quantity)} {row.unit}
              </td>
              <td className="px-4">
                {row.organisationName}
                {row.syncStatus === 'PENDING' && (
                  <>
                    {' '}
                    <PendingSyncChip />
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
