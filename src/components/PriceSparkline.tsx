import { useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { parseFipePrice } from "../services/fipeParsing";
import type { FipePriceHistory } from "../types/vehicle";
import "./PriceSparkline.css";

interface PriceSparklineProps {
  history: FipePriceHistory[];
}

const width = 320;
const height = 64;
const padding = { top: 8, right: 8, bottom: 8, left: 8 };

const percent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

/**
 * Stat tile with the latest FIPE value, its change over the history and a
 * sparkline. Single series, so no legend; the table below is the full view.
 */
export function PriceSparkline({ history }: PriceSparklineProps) {
  const [active, setActive] = useState<number | null>(null);
  const points = [...history]
    .sort((left, right) => Number(left.reference) - Number(right.reference))
    .map((item) => ({ ...item, value: parseFipePrice(item.price) }))
    .filter((item) => item.value > 0);

  const first = points[0];
  const last = points.at(-1);
  if (points.length < 2 || !first || !last) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (index: number) => padding.left + (index / (points.length - 1)) * plotWidth;
  // A flat history sits in the middle instead of on an edge.
  const y = (value: number) =>
    max === min
      ? padding.top + plotHeight / 2
      : padding.top + (1 - (value - min) / (max - min)) * plotHeight;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(" ");

  const change = ((last.value - first.value) / first.value) * 100;
  const shown = active === null ? null : points[active];
  const marker = active ?? points.length - 1;

  function pick(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const relative = ((event.clientX - box.left) / box.width) * width;
    const index = Math.round(((relative - padding.left) / plotWidth) * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, index)));
  }

  function step(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = active ?? points.length - 1;
    const next = current + (event.key === "ArrowRight" ? 1 : -1);
    setActive(Math.max(0, Math.min(points.length - 1, next)));
  }

  return (
    <div className="sparkline-tile">
      <div className="sparkline-figures">
        <span className="sparkline-label">
          {shown ? shown.month : `Valor FIPE · ${last.month}`}
        </span>
        <strong>{shown ? shown.price : last.price}</strong>
        <span className="sparkline-change">
          {change > 0 ? "▲" : change < 0 ? "▼" : "■"} {percent.format(change)}% desde{" "}
          {first.month}
        </span>
      </div>
      <div className="sparkline-plot">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Valor FIPE de ${first.month} (${first.price}) a ${last.month} (${last.price}), variação de ${percent.format(change)}%. Use as setas para percorrer os meses.`}
          tabIndex={0}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
          onKeyDown={step}
          onBlur={() => setActive(null)}
        >
          {active !== null && (
            <line
              className="sparkline-crosshair"
              x1={x(active)}
              x2={x(active)}
              y1={padding.top - 4}
              y2={height - padding.bottom + 4}
            />
          )}
          <path className="sparkline-line" d={path} />
        </svg>
        {/* HTML, so the stretched SVG does not squash the dot into an ellipse. */}
        <span
          className="sparkline-marker"
          aria-hidden="true"
          style={{
            left: `${(x(marker) / width) * 100}%`,
            top: `${(y((points[marker] ?? last).value) / height) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
