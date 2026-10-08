import {
  districtName,
  SHELTER_STATUS_LABELS,
  type ShelterSummary,
} from '@repo/types';

import { formatNumber } from '../../lib/format';
import { PendingSyncChip } from './SyncChip';

const HEAD =
  'text-muted px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase';

export function ShelterTable({ shelters }: { shelters: ShelterSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">Shelters and their occupancy</caption>
        <thead className="bg-page">
          <tr>
            <th scope="col" className={HEAD}>
              Shelter
            </th>
            <th scope="col" className={HEAD}>
              District
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              Capacity
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              Peak
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              Latest
            </th>
            <th scope="col" className={HEAD}>
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {shelters.map((shelter) => (
            <tr key={shelter.shelterId} className="h-12">
              <td className="px-4">
                {shelter.name}
                {shelter.pendingRecords > 0 && (
                  <>
                    {' '}
                    <PendingSyncChip />
                  </>
                )}
              </td>
              <td className="px-4">{districtName(shelter.districtCode)}</td>
              <td className="px-4 text-right">
                {formatNumber(shelter.capacity)}
              </td>
              <td className="px-4 text-right">
                {formatNumber(shelter.peakOccupancy)}
              </td>
              <td className="px-4 text-right">
                {formatNumber(shelter.latestOccupancy)}
              </td>
              <td className="px-4">{SHELTER_STATUS_LABELS[shelter.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
