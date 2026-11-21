import { TrendingDown, TrendingUp } from "lucide-react";
import { fipeTrend } from "../../catalog/fipeTrend";
import type { FipePriceHistory } from "../../types/vehicle";
import "./FipeTrendNote.css";

const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
const format = (value: number) => `${percent.format(value).replace("-", "−")}%`;

const explanation =
  "A FIPE é a média dos preços pesquisados ao longo de um mês e sai depois dele, então anda " +
  "atrás do mercado. Quando ela cai ou sobe rápido, os anúncios costumam já estar abaixo (ou " +
  "acima) da tabela.";

/** Under the FIPE price: how it moved lately, and a warning when it moves fast. */
export function FipeTrendNote({ history }: { history: FipePriceHistory[] }) {
  const trend = fipeTrend(history);
  if (!trend) return null;
  const since = trend.since.replace(/ de \d{4}$/, "");
  const periods: string[] = [
    ...(trend.month !== null ? [`${format(trend.month)} no último mês`] : []),
    ...(trend.months > 1 ? [`${format(trend.total)} desde ${since}`] : []),
  ];
  const Icon = trend.signal === "alta" ? TrendingUp : TrendingDown;
  return (
    <div className={`fipe-trend${trend.signal ? ` fipe-trend-${trend.signal}` : ""}`} title={explanation}>
      <p>
        Tendência FIPE: {periods.join(" · ")}
      </p>
      {trend.signal && (
        <p className="fipe-trend-signal">
          <Icon size={14} aria-hidden="true" />
          {trend.signal === "queda"
            ? "Queda acima do normal: o preço de mercado provavelmente já está abaixo da FIPE."
            : "Em alta: o preço de mercado provavelmente já está acima da FIPE."}
        </p>
      )}
    </div>
  );
}
