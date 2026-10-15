import { useMemo } from 'react';
import { formatClock } from '../call/labels';
import { buildChart, type RiskPoint } from './view';

const GRID = [0, 0.25, 0.5, 0.75, 1];

// Inline SVG line chart: threshold bands behind the line, one dot per tick.
export function RiskChart({ points }: { points: readonly RiskPoint[] }) {
  const chart = useMemo(() => buildChart(points), [points]);
  const { plot } = chart;

  return (
    <svg
      className="dash-chart"
      viewBox={`0 0 ${chart.width} ${chart.height}`}
      role="img"
      aria-label={`Risk over time, ${points.length} readings`}
    >
      {chart.bands.map((b) => (
        <rect
          key={b.action}
          className="dash-chart__band"
          data-action={b.action}
          x={plot.left}
          y={b.y}
          width={plot.right - plot.left}
          height={b.height}
        />
      ))}
      {GRID.map((g) => (
        <g key={g}>
          <line className="dash-chart__grid" x1={plot.left} x2={plot.right} y1={chart.yAt(g)} y2={chart.yAt(g)} />
          <text className="dash-chart__label" x={plot.left - 6} y={chart.yAt(g) + 3} textAnchor="end">
            {Math.round(g * 100)}
          </text>
        </g>
      ))}
      <text className="dash-chart__label" x={plot.left} y={chart.height - 6}>
        0:00
      </text>
      <text className="dash-chart__label" x={plot.right} y={chart.height - 6} textAnchor="end">
        {formatClock(chart.maxSec)}
      </text>
      {chart.path && <path className="dash-chart__line" d={chart.path} />}
      {chart.dots.map((d) => (
        <circle key={d.atSec} className="dash-chart__dot" data-action={d.action} cx={d.x} cy={d.y} r={3.5}>
          <title>{`${formatClock(d.atSec)} · ${Math.round(d.risk * 100)}%`}</title>
        </circle>
      ))}
      {points.length === 0 && (
        <text className="dash-chart__label" x={(plot.left + plot.right) / 2} y={(plot.top + plot.bottom) / 2} textAnchor="middle">
          Waiting for the first reading
        </text>
      )}
    </svg>
  );
}
