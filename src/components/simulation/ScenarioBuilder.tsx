"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Zap } from "lucide-react";
import type { SimulationConfig } from "@/types";

const schema = z.object({
  trigger_event: z
    .string()
    .min(20, "Describe the trigger event in at least 20 characters")
    .max(2000, "Maximum 2000 characters"),
  domain: z.enum([
    "Military",
    "Financial",
    "Political",
    "Humanitarian",
    "Trade",
    "Energy",
  ]),
  time_horizon: z.enum(["24h", "7d", "30d", "90d", "1y"]),
  actors: z.string().optional(),
  regions: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ScenarioBuilderProps {
  onSubmit: (config: SimulationConfig) => void;
  isLoading?: boolean;
}

const EXAMPLE_SCENARIOS = [
  "China announces naval blockade of Taiwan Strait, cutting commercial shipping",
  "Iran crosses nuclear threshold, Israel convenes emergency security cabinet",
  "Russia terminates all gas contracts with European nations mid-winter",
  "North Korea conducts 7th nuclear test, UNSC emergency session called",
];

const DOMAIN_OPTIONS = [
  { value: "Military", label: "Military / Conflict" },
  { value: "Financial", label: "Financial / Economic" },
  { value: "Political", label: "Political / Diplomatic" },
  { value: "Humanitarian", label: "Humanitarian / Social" },
  { value: "Trade", label: "Trade / Supply Chain" },
  { value: "Energy", label: "Energy / Resources" },
];

const HORIZON_OPTIONS = [
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "1y", label: "1 Year" },
];

export function ScenarioBuilder({ onSubmit, isLoading }: ScenarioBuilderProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      domain: "Military",
      time_horizon: "30d",
      trigger_event: "",
      actors: "",
      regions: "",
    },
  });

  const triggerValue = watch("trigger_event");

  const handleFormSubmit = (values: FormValues) => {
    const config: SimulationConfig = {
      trigger_event: values.trigger_event,
      domain: values.domain,
      time_horizon: values.time_horizon,
      actors: values.actors
        ? values.actors.split(",").map((a) => a.trim()).filter(Boolean)
        : [],
      regions: values.regions
        ? values.regions.split(",").map((r) => r.trim()).filter(Boolean)
        : [],
    };
    onSubmit(config);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {/* Trigger event */}
      <div>
        <label className="axiom-label">Trigger Event *</label>
        <textarea
          {...register("trigger_event")}
          className="axiom-textarea"
          placeholder="Describe the geopolitical event to simulate..."
          rows={4}
        />
        <div className="flex items-center justify-between mt-1">
          {errors.trigger_event ? (
            <p className="text-[11px] text-axiom-red">
              {errors.trigger_event.message}
            </p>
          ) : (
            <p className="text-[10px] text-white/25">
              Be specific: include actors, locations, and the nature of the event
            </p>
          )}
          <span className="text-[10px] font-mono text-white/25 shrink-0">
            {triggerValue.length}/2000
          </span>
        </div>

        {/* Example scenarios */}
        <div className="mt-2 space-y-1">
          <p className="text-[10px] font-mono text-white/25 uppercase tracking-wider">
            Examples:
          </p>
          {EXAMPLE_SCENARIOS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setValue("trigger_event", ex)}
              className="block w-full text-left text-[11px] text-axiom-cyan/60 hover:text-axiom-cyan transition-colors px-2 py-1 rounded-[2px] hover:bg-axiom-cyan/[0.05] border border-transparent hover:border-axiom-cyan/20"
            >
              → {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Domain */}
      <div>
        <label className="axiom-label">Primary Domain</label>
        <select {...register("domain")} className="axiom-select">
          {DOMAIN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Time horizon */}
      <div>
        <label className="axiom-label">Analysis Time Horizon</label>
        <div className="grid grid-cols-5 gap-1.5">
          {HORIZON_OPTIONS.map((opt) => {
            const current = watch("time_horizon");
            const isActive = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue("time_horizon", opt.value as SimulationConfig["time_horizon"])}
                className={`py-1.5 rounded-[2px] text-[11px] font-semibold uppercase tracking-wider border transition-all font-ui ${
                  isActive
                    ? "bg-axiom-amber/20 text-axiom-amber border-axiom-amber/50"
                    : "bg-white/[0.04] text-white/40 border-white/[0.08] hover:border-white/[0.15] hover:text-white/60"
                }`}
              >
                {opt.value}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actor set */}
      <div>
        <label className="axiom-label">Actor Set (optional)</label>
        <input
          {...register("actors")}
          className="axiom-input"
          placeholder="e.g. PLA Navy, US 7th Fleet, TSMC, NATO"
        />
        <p className="text-[10px] text-white/25 mt-1">
          Comma-separated list of key actors to include in analysis
        </p>
      </div>

      {/* Regions */}
      <div>
        <label className="axiom-label">Focus Regions (optional)</label>
        <input
          {...register("regions")}
          className="axiom-input"
          placeholder="e.g. Taiwan Strait, South China Sea"
        />
        <p className="text-[10px] text-white/25 mt-1">
          Comma-separated list of regions to focus the analysis on
        </p>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={isLoading}
        icon={<Zap size={14} />}
        className="mt-2"
      >
        {isLoading ? "Simulating..." : "Run Simulation"}
      </Button>
    </form>
  );
}
