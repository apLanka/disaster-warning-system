import { linearScale, niceMax, ticks } from '../../lib/chartScale';
import { formatNumber } from '../../lib/format';

const WIDTH = 640;
const HEIGHT = 260;
const MARGIN = { top: 16, right: 24, bottom: 40, left: 56 };

export interface Bar {
  label: string;
  value: number;
}

interface BarChartProps {
  bars: Bar[];
  /** Names what the bars measure, for the caption and the table. */
  valueLabel: string;
  labelHeading: string;
}

/** Vertical bars with a table of the same numbers underneath. */
export function BarChart({ bars, valueLabel, labelHeading }: BarChartProps) {
  const top = niceMax(Math.max(0, ...bars.map((bar) => bar.value)));
  const y = linearScale([0, top], [HEIGHT - MARGIN.bottom, MARGIN.top]);
  const slot = (WIDTH - MARGIN.left - MARGIN.right) / Math.max(bars.length, 1);
  const barWidth = Math.min(64, slot * 0.6);
  const baseline = HEIGHT - MARGIN.bottom;

  const description =
    bars.length === 0
      ? `No ${valueLabel.toLowerCase()} recorded`
      : `${valueLabel} for ${bars.length} ${bars.length === 1 ? 'district' : 'districts'}: ${bars
          .map((bar) => `${bar.label} ${formatNumber(bar.value)}`)
          .join(', ')}.`;

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
        {bars.map((bar, index) => {
          const centre = MARGIN.left + slot * index + slot / 2;
          return (
            <g key={bar.label}>
              <rect
                data-testid="bar"
                x={centre - barWidth / 2}
                y={y(bar.value)}
                width={barWidth}
                height={baseline - y(bar.value)}
                rx={3}
                className="fill-navy"
              />
              <text
                x={centre}
                y={HEIGHT - 16}
                textAnchor="middle"
                className="fill-muted text-[11px]"
              >
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="text-muted text-xs">{valueLabel}</figcaption>

      <table className="w-full text-sm">
        <caption className="sr-only">{valueLabel}</caption>
        <thead className="bg-page">
          <tr>
            <th
              scope="col"
              className="text-muted px-3 py-2 text-left text-xs uppercase"
            >
              {labelHeading}
            </th>
            <th
              scope="col"
              className="text-muted px-3 py-2 text-right text-xs uppercase"
            >
              Quantity
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {bars.map((bar) => (
            <tr key={bar.label}>
              <td className="px-3 py-1.5">{bar.label}</td>
              <td className="px-3 py-1.5 text-right">
                {formatNumber(bar.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
