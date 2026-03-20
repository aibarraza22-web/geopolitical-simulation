"use client";

import { cn, getDomainColor } from "@/lib/utils";
import type { MapLayer } from "@/types";

interface LayerTogglesProps {
  layers: MapLayer[];
  onToggle: (id: string) => void;
}

export function LayerToggles({ layers, onToggle }: LayerTogglesProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider mr-1">
        Layers
      </span>
      {layers.map((layer) => (
        <button
          key={layer.id}
          onClick={() => onToggle(layer.id)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-[11px] font-semibold uppercase tracking-wider border transition-all duration-150 font-ui",
            layer.enabled
              ? "border-opacity-60 bg-opacity-15"
              : "border-white/[0.08] bg-transparent text-white/30 hover:text-white/50"
          )}
          style={
            layer.enabled
              ? {
                  borderColor: `${layer.color}60`,
                  backgroundColor: `${layer.color}15`,
                  color: layer.color,
                }
              : undefined
          }
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: layer.enabled ? layer.color : "rgba(255,255,255,0.2)",
            }}
          />
          {layer.label}
        </button>
      ))}
    </div>
  );
}

export const DEFAULT_LAYERS: MapLayer[] = [
  {
    id: "conflict",
    label: "Conflict",
    domain: "Military",
    color: getDomainColor("Military"),
    enabled: true,
  },
  {
    id: "financial",
    label: "Financial",
    domain: "Financial",
    color: getDomainColor("Financial"),
    enabled: true,
  },
  {
    id: "trade",
    label: "Trade",
    domain: "Trade",
    color: getDomainColor("Trade"),
    enabled: false,
  },
  {
    id: "energy",
    label: "Energy",
    domain: "Energy",
    color: getDomainColor("Energy"),
    enabled: false,
  },
];
