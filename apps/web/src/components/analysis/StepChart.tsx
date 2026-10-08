import type { OccupancyPoint } from '@repo/types';

import { linearScale, niceMax, stepPath, ticks } from '../../lib/chartScale';
import { formatDayTime, formatNumber } from '../../lib/format';

const WIDTH = 640;
const HEIGHT = 260;
const MARGIN = { top: 16, right: 24, bottom: 36, left: 56 };

interface StepChartProps {
  series: OccupancyPoint[];
  /** Combined capacity, drawn as a dashed line when it fits the chart. */
  capacity?: number;
}

/**
 * Total shelter occupancy over time as a step line: a reading holds until the next
 * one. The same numbers are in the table underneath, for anyone who cannot read a
 * chart.
 */
export function StepChart({ series, capacity }: StepChartProps) {
  const times = series.map((point) => new Date(point.at).getTime());
  const peak = Math.max(0, ...series.map((point) => point.occupancy));
  const top = niceMax(Math.max(peak, capacity ?? 0));

  const x = linearScale(
    [Math.min(...times), Math.max(...times)],
    [MARGIN.left, WIDTH - MARGIN.right],
  );
  const y = linearScale([0, top], [HEIGHT - MARGIN.bottom, MARGIN.top]);

  const points = series.map((point, index) => ({
    x: x(times[index]!),
    y: y(point.occupancy),
  }));
  const last = points.at(-1);
  const first = points[0];
  const description =
    series.length === 0
      ? 'No occupancy readings'
      : `Total shelter occupancy rose to a peak of ${formatNumber(peak)} across ${series.length} readings, from ${formatDayTime(series[0]!.at)} to ${formatDayTime(series.at(-1)!.at)}.`;

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={description}
        className="h-auto w-full"
      >
        {ticks(top).map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted text-[11px]"
            >
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {capacity !== undefined && capacity > 0 && (
          <line
            data-testid="capacity-line"
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={y(capacity)}
            y2={y(capacity)}
            className="stroke-danger"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        )}

        {points.length > 0 && (
          <path
            d={stepPath(points)}
            fill="none"
            className="stroke-navy"
            strokeWidth={2.5}
          />
        )}
        {points.map((point, index) => (
          <circle
            key={series[index]!.at}
            cx={point.x}
            cy={point.y}
            r={3.5}
            className="fill-navy"
          />
        ))}

        {first && series[0] && (
          <text
            x={first.x}
            y={HEIGHT - 12}
            textAnchor={series.length === 1 ? 'middle' : 'start'}
            className="fill-muted text-[11px]"
          >
            {formatDayTime(series[0].at)}
          </text>
        )}
        {last && series.length > 1 && (
          <text
            x={last.x}
            y={HEIGHT - 12}
            textAnchor="end"
            className="fill-muted text-[11px]"
          >
            {formatDayTime(series.at(-1)!.at)}
          </text>
        )}
      </svg>

      <figcaption className="text-muted text-xs">
        Total occupancy across shelters
        {capacity
          ? `. Dashed line: combined capacity (${formatNumber(capacity)}).`
          : '.'}
      </figcaption>

      <table className="w-full text-sm">
        <caption className="sr-only">Total shelter occupancy over time</caption>
        <thead className="bg-page">
          <tr>
            <th
              scope="col"
              className="text-muted px-3 py-2 text-left text-xs uppercase"
            >
              Time
            </th>
            <th
              scope="col"
              className="text-muted px-3 py-2 text-right text-xs uppercase"
            >
              Occupancy
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {series.map((point) => (
            <tr key={point.at}>
              <td className="px-3 py-1.5">{formatDayTime(point.at)}</td>
              <td className="px-3 py-1.5 text-right">
                {formatNumber(point.occupancy)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
