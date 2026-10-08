import { Link } from 'react-router-dom';

import {
  districtName,
  EVENT_STATUS_LABELS,
  HAZARD_TYPE_LABELS,
  type DisasterEventDto,
} from '@repo/types';

import { analysisScopePath } from '../../lib/routes';
import { formatDate, formatPeriod } from '../../lib/format';
import { Button } from '../ui/Button';

const HEAD =
  'text-muted px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase';

export function EventsTable({ events }: { events: DisasterEventDto[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="bg-page">
          <tr>
            <th scope="col" className={HEAD}>
              Event
            </th>
            <th scope="col" className={HEAD}>
              Hazard type
            </th>
            <th scope="col" className={HEAD}>
              Affected districts
            </th>
            <th scope="col" className={HEAD}>
              Period
            </th>
            <th scope="col" className={HEAD}>
              Status
            </th>
            <th scope="col" className={HEAD}>
              Updated
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {events.map((event) => (
            <tr key={event.id} className="hover:bg-page/60 h-14">
              <td className="px-4">
                <p className="font-semibold">{event.name}</p>
                <p className="text-muted font-mono text-xs">{event.eventId}</p>
              </td>
              <td className="px-4">{HAZARD_TYPE_LABELS[event.hazardType]}</td>
              <td className="px-4">
                {event.districtCodes.map(districtName).join(', ')}
              </td>
              <td className="px-4 whitespace-nowrap">
                {formatPeriod(event.startedAt, event.endedAt)}
              </td>
              <td className="px-4">
                <span className="bg-success-tint text-success inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-current"
                  />
                  {EVENT_STATUS_LABELS[event.status]}
                </span>
              </td>
              <td className="text-muted px-4 whitespace-nowrap">
                {formatDate(event.updatedAt)}
              </td>
              <td className="px-4 text-right">
                <Link
                  to={analysisScopePath(event.id)}
                  aria-label={`Analyse ${event.name}`}
                >
                  <Button variant="secondary" tabIndex={-1} aria-hidden="true">
                    Analyse
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
