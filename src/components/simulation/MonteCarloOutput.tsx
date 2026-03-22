"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { STATE_LABELS, STATE_COLORS, STATES } from "@/lib/monte-carlo";
import type { MonteCarloResponse } from "@/app/api/simulate/monte-carlo/route";
import { TrendingUp, TrendingDown, Minus, Users, Activity } from "lucide-react";

interface Props {
  data: MonteCarloResponse;
}

const MODIFIER_COLOR = (m: number) =>
  m > 0.1 ? "#ef4444" : m < -0.1 ? "#4ade80" : "#fbbf24";

const MODIFIER_LABEL = (m: number) =>
  m > 0.2
    ? "Strongly Escalatory"
    : m > 0.05
    ? "Escalatory"
    : m < -0.2
    ? "Strongly De-escalatory"
    : m < -0.05
    ? "De-escalatory"
    : "Neutral";

const POSTURE_COLOR: Record<string, string> = {
  aggressive: "#ef4444",
  deterrent: "#f97316",
  diplomatic: "#4ade80",
  defensive: "#fbbf24",
  opportunistic: "#a78bfa",
  neutral: "#6b7280",
};

export function MonteCarloOutput({ data }: Props) {
  const { result, agentDecisions, aggregateModifier, riskScore, signalCount, flashpoint, time_horizon } = data;

  // Final state bar chart data
  const finalBarData = STATES.map((state) => ({
    name: STATE_LABELS[state],
    value: Math.round(result.finalStateDistribution[state] * 100),
    color: STATE_COLORS[state],
  })).filter((d) => d.value > 0);

  // Peak state bar chart data
  const peakBarData = STATES.map((state) => ({
    name: STATE_LABELS[state],
    value: Math.round(result.peakStateDistribution[state] * 100),
    color: STATE_COLORS[state],
  })).filter((d) => d.value > 0);

  // Trajectory area chart data
  const trajectoryData = result.trajectoryData.map((d) => ({
    step: d.step,
    ...Object.fromEntries(
      STATES.map((state) => [
        STATE_LABELS[state],
        Math.round(d[state] * 100),
      ])
    ),
  }));

  const mostLikelyColor =
    STATE_COLORS[result.mostLikelyFinalState] ?? "#ffffff";
  const worstCaseColor = STATE_COLORS[result.worstCaseState] ?? "#ef4444";

  return (
    <div className="space-y-5">
      {/* Header summary */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard
          label="Most Likely Outcome"
          value={STATE_LABELS[result.mostLikelyFinalState]}
          sub={`${Math.round(result.finalStateDistribution[result.mostLikelyFinalState] * 100)}% probability`}
          color={mostLikelyColor}
        />
        <SummaryCard
          label="Worst Case (≥5%)"
          value={STATE_LABELS[result.worstCaseState]}
          sub={`${Math.round(result.peakStateDistribution[result.worstCaseState] * 100)}% of simulations`}
          color={worstCaseColor}
        />
        <SummaryCard
          label="Risk Score"
          value={`${riskScore}/100`}
          sub="Current regional risk"
          color="#fbbf24"
        />
        <SummaryCard
          label="Signals Analyzed"
          value={signalCount}
          sub={`Last 7 days · ${result.simCount.toLocaleString()} MC runs`}
          color="#38bdf8"
        />
      </div>

      {/* Trajectory chart */}
      <div className="rounded-sm border border-white/[0.07] p-4">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-3">
          State Probability Trajectory — {flashpoint} · {time_horizon}
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trajectoryData} stackOffset="expand">
            <XAxis
              dataKey="step"
              tick={{ fill: "#ffffff40", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Time Steps",
                position: "insideBottom",
                offset: -2,
                fill: "#ffffff30",
                fontSize: 9,
              }}
            />
            <YAxis
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              tick={{ fill: "#ffffff40", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={35}
            />
            <Tooltip
              formatter={(value: number) => [`${Math.round(value)}%`]}
              contentStyle={{
                background: "#0a0f1a",
                border: "1px solid #ffffff15",
                borderRadius: 2,
                fontSize: 11,
              }}
              labelStyle={{ color: "#ffffff60" }}
            />
            {STATES.map((state) => (
              <Area
                key={state}
                type="monotone"
                dataKey={STATE_LABELS[state]}
                stackId="1"
                stroke={STATE_COLORS[state]}
                fill={STATE_COLORS[state]}
                fillOpacity={0.75}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Final state + peak state charts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-sm border border-white/[0.07] p-4">
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-3">
            Final State Distribution
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={finalBarData} layout="vertical" barCategoryGap={6}>
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: "#ffffff40", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#ffffff60", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "Probability"]}
                contentStyle={{
                  background: "#0a0f1a",
                  border: "1px solid #ffffff15",
                  borderRadius: 2,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="value" radius={[0, 2, 2, 0]}>
                {finalBarData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-sm border border-white/[0.07] p-4">
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-3">
            Peak State Reached
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={peakBarData} layout="vertical" barCategoryGap={6}>
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: "#ffffff40", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#ffffff60", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "Simulations"]}
                contentStyle={{
                  background: "#0a0f1a",
                  border: "1px solid #ffffff15",
                  borderRadius: 2,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="value" radius={[0, 2, 2, 0]}>
                {peakBarData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top paths */}
      <div className="rounded-sm border border-white/[0.07] p-4">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Activity size={10} />
          Most Common Trajectories
        </p>
        <div className="space-y-2">
          {result.pathDistribution.map((path, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-white/25 w-4 shrink-0">
                {i + 1}.
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-white/70">{path.label}</span>
                  <span className="text-[11px] font-mono text-axiom-amber">
                    {Math.round(path.probability * 100)}%
                  </span>
                </div>
                <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-axiom-amber/60 rounded-full"
                    style={{ width: `${path.probability * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-agent decisions */}
      {agentDecisions.length > 0 && (
        <div className="rounded-sm border border-white/[0.07] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={10} />
              Multi-Agent Decision Layer
            </p>
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-mono"
                style={{ color: MODIFIER_COLOR(aggregateModifier) }}
              >
                Net: {MODIFIER_LABEL(aggregateModifier)}
              </span>
              {aggregateModifier > 0.05 ? (
                <TrendingUp size={11} className="text-axiom-red" />
              ) : aggregateModifier < -0.05 ? (
                <TrendingDown size={11} className="text-axiom-green" />
              ) : (
                <Minus size={11} className="text-axiom-amber" />
              )}
            </div>
          </div>
          <div className="space-y-2.5">
            {agentDecisions.map((agent, i) => (
              <div
                key={i}
                className="p-3 rounded-[2px] border border-white/[0.06] bg-white/[0.02]"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-white/80">
                      {agent.name}
                    </span>
                    <span
                      className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-[2px]"
                      style={{
                        color: POSTURE_COLOR[agent.posture] ?? "#6b7280",
                        background: `${POSTURE_COLOR[agent.posture] ?? "#6b7280"}15`,
                        border: `1px solid ${POSTURE_COLOR[agent.posture] ?? "#6b7280"}30`,
                      }}
                    >
                      {agent.posture}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-mono shrink-0"
                    style={{ color: MODIFIER_COLOR(agent.escalation_modifier) }}
                  >
                    {agent.escalation_modifier > 0 ? "+" : ""}
                    {(agent.escalation_modifier * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  {agent.decision}
                </p>
                <p className="text-[10px] text-white/35 mt-0.5 italic">
                  {agent.rationale}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-sm border border-white/[0.07] p-3 bg-white/[0.02]">
      <p className="text-[9px] font-mono text-white/35 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className="text-sm font-bold font-ui leading-tight"
        style={{ color }}
      >
        {value}
      </p>
      <p className="text-[10px] text-white/35 mt-0.5">{sub}</p>
    </div>
  );
}
