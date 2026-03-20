"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendingUp } from "lucide-react";

// Data format accepted by the chart
export interface TrendDataPoint {
  date: string;
  [region: string]: string | number;
}

interface RiskTrendChartProps {
  data?: TrendDataPoint[];
  regions?: string[];
  height?: number;
  showLegend?: boolean;
}

const REGION_COLORS: Record<string, string> = {
  "Taiwan Strait": "#f0a500",
  "Ukraine-Russia": "#ff3b3b",
  "Iran-Israel": "#ff6b6b",
  "Middle East": "#00d4ff",
  Global: "#00e676",
  "South China Sea": "#a855f7",
  "Sahel Region": "#f97316",
  "Korean Peninsula": "#ec4899",
  Venezuela: "#84cc16",
};

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-axiom-panel border border-white/[0.10] rounded-sm px-3 py-2 shadow-xl">
      <p className="text-[10px] font-mono text-white/50 mb-2">
        {label ? format(parseISO(label), "MMM d") : ""}
      </p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-white/60 min-w-[100px]">
              {item.dataKey}
            </span>
            <span
              className="text-[11px] font-mono font-bold ml-auto"
              style={{ color: item.color }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiskTrendChart({
  data = [],
  regions = ["Taiwan Strait", "Ukraine-Russia", "Iran-Israel", "Global"],
  height = 220,
  showLegend = true,
}: RiskTrendChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <EmptyState
          icon={<TrendingUp size={20} />}
          title="No historical data yet"
          description="Risk trend history will appear here as data accumulates."
        />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
      >
        <defs>
          {regions.map((region) => (
            <linearGradient
              key={region}
              id={`gradient-${region.replace(/\s/g, "-")}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={REGION_COLORS[region] ?? "#6b7280"}
                stopOpacity={0.25}
              />
              <stop
                offset="95%"
                stopColor={REGION_COLORS[region] ?? "#6b7280"}
                stopOpacity={0}
              />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.08)"
          vertical={false}
          opacity={0.2}
        />

        <XAxis
          dataKey="date"
          tick={{
            fill: "rgba(255,255,255,0.3)",
            fontSize: 9,
            fontFamily: "var(--font-share-tech)",
          }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(val: string) => format(parseISO(val), "M/d")}
          interval={6}
        />

        <YAxis
          domain={[0, 100]}
          tick={{
            fill: "rgba(255,255,255,0.3)",
            fontSize: 9,
            fontFamily: "var(--font-share-tech)",
          }}
          tickLine={false}
          axisLine={false}
        />

        <Tooltip content={<CustomTooltip />} />

        {showLegend && (
          <Legend
            wrapperStyle={{
              paddingTop: "12px",
              fontSize: "10px",
              fontFamily: "var(--font-barlow)",
              color: "rgba(255,255,255,0.5)",
              backgroundColor: "transparent",
            }}
          />
        )}

        {regions.map((region) => (
          <Area
            key={region}
            type="monotone"
            dataKey={region}
            stroke={REGION_COLORS[region] ?? "#6b7280"}
            strokeWidth={1.5}
            fill={`url(#gradient-${region.replace(/\s/g, "-")})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
