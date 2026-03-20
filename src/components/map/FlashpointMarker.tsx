"use client";

import { motion } from "framer-motion";
import { getRiskColor } from "@/lib/utils";
import type { RegionRiskData } from "@/types";

interface FlashpointMarkerProps {
  region: RegionRiskData;
  coordinates: [number, number]; // projected [x, y] in SVG space
  onClick?: (region: RegionRiskData) => void;
  onHover?: (region: RegionRiskData | null, x?: number, y?: number) => void;
}

// Fixed lat/lng for each of the 8 monitored flashpoints
export const FLASHPOINT_COORDINATES: Record<string, [number, number]> = {
  "Taiwan Strait":    [120.9, 23.7],
  "Ukraine-Russia":   [35.0, 49.0],
  "Iran-Israel":      [35.5, 32.0],
  "Middle East":      [45.0, 25.0],
  "South China Sea":  [114.0, 15.0],
  "Sahel Region":     [-2.0, 15.0],
  "Korean Peninsula": [127.5, 38.0],
  "Venezuela":        [-66.0, 8.0],
};

export function FlashpointMarker({
  region,
  coordinates,
  onClick,
  onHover,
}: FlashpointMarkerProps) {
  const color = getRiskColor(region.risk_score);
  const isCritical = region.risk_score >= 80;
  const isHigh = region.risk_score >= 65;

  // Dot radius scales with risk score
  const dotRadius = isCritical ? 5.5 : isHigh ? 4.5 : 3.5;
  const ringRadius = isCritical ? 14 : isHigh ? 11 : 9;

  return (
    <g
      transform={`translate(${coordinates[0]}, ${coordinates[1]})`}
      style={{ cursor: "pointer" }}
      onClick={() => onClick?.(region)}
      onMouseEnter={(e) => onHover?.(region, e.clientX, e.clientY)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Outer pulsing ring — primary */}
      <motion.circle
        r={ringRadius}
        fill="none"
        stroke={color}
        strokeWidth={isCritical ? 1.5 : 1}
        initial={{ opacity: 0.7, scale: 1 }}
        animate={{ opacity: 0, scale: 2.2 }}
        transition={{
          duration: isCritical ? 1.4 : 2.0,
          repeat: Infinity,
          ease: "easeOut",
        }}
        style={{ originX: "0px", originY: "0px" }}
      />

      {/* Second pulsing ring — for critical/high */}
      {(isCritical || isHigh) && (
        <motion.circle
          r={ringRadius}
          fill="none"
          stroke={color}
          strokeWidth={1}
          initial={{ opacity: 0.45, scale: 1 }}
          animate={{ opacity: 0, scale: 2.8 }}
          transition={{
            duration: isCritical ? 1.4 : 2.0,
            repeat: Infinity,
            ease: "easeOut",
            delay: 0.45,
          }}
          style={{ originX: "0px", originY: "0px" }}
        />
      )}

      {/* Third ring for critical — triple pulse */}
      {isCritical && (
        <motion.circle
          r={ringRadius}
          fill="none"
          stroke={color}
          strokeWidth={0.8}
          initial={{ opacity: 0.25, scale: 1 }}
          animate={{ opacity: 0, scale: 3.5 }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: "easeOut",
            delay: 0.9,
          }}
          style={{ originX: "0px", originY: "0px" }}
        />
      )}

      {/* Inner glow */}
      <circle
        r={dotRadius + 2}
        fill={color}
        fillOpacity={0.15}
      />

      {/* Inner solid dot */}
      <circle
        r={dotRadius}
        fill={color}
        fillOpacity={0.95}
        stroke={color}
        strokeWidth={1}
        strokeOpacity={0.4}
      />

      {/* Risk score label for high-risk flashpoints */}
      {region.risk_score >= 70 && (
        <text
          x={0}
          y={-(dotRadius + 5)}
          textAnchor="middle"
          fill={color}
          fontSize="7.5"
          fontFamily="var(--font-share-tech)"
          fontWeight="bold"
          opacity={0.95}
        >
          {region.risk_score}
        </text>
      )}
    </g>
  );
}
