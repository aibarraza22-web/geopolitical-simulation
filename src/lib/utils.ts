import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";
import type { SignalSeverity } from "@/types";

// =============================================================================
// Tailwind class merger
// =============================================================================
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// =============================================================================
// Date utilities
// =============================================================================
export function formatDate(date: string | Date, pattern = "MMM d, yyyy"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, pattern);
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy HH:mm 'UTC'");
}

// =============================================================================
// Risk score color mapping
// =============================================================================
export function getRiskColor(score: number): string {
  if (score >= 80) return "#ff3b3b"; // critical red
  if (score >= 65) return "#f0a500"; // amber warning
  if (score >= 45) return "#f0c040"; // yellow elevated
  return "#00e676"; // green safe
}

export function getRiskColorClass(score: number): string {
  if (score >= 80) return "text-axiom-red";
  if (score >= 65) return "text-axiom-amber";
  if (score >= 45) return "text-yellow-400";
  return "text-axiom-green";
}

export function getRiskLabel(score: number): string {
  if (score >= 80) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 45) return "MEDIUM";
  if (score >= 25) return "LOW";
  return "MINIMAL";
}

export function getRiskBgColor(score: number): string {
  if (score >= 80) return "rgba(255, 59, 59, 0.15)";
  if (score >= 65) return "rgba(240, 165, 0, 0.15)";
  if (score >= 45) return "rgba(240, 192, 64, 0.15)";
  return "rgba(0, 230, 118, 0.15)";
}

// =============================================================================
// Severity color mapping
// =============================================================================
export function getSeverityColor(severity: SignalSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "#ff3b3b";
    case "HIGH":
      return "#f0a500";
    case "MEDIUM":
      return "#f0c040";
    case "LOW":
      return "#00d4ff";
    case "INFO":
      return "#6b7280";
  }
}

export function getSeverityBgClass(severity: SignalSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-axiom-red/20 text-axiom-red border-axiom-red/40";
    case "HIGH":
      return "bg-axiom-amber/20 text-axiom-amber border-axiom-amber/40";
    case "MEDIUM":
      return "bg-yellow-400/20 text-yellow-400 border-yellow-400/40";
    case "LOW":
      return "bg-axiom-cyan/20 text-axiom-cyan border-axiom-cyan/40";
    case "INFO":
      return "bg-gray-500/20 text-gray-400 border-gray-500/40";
  }
}

// =============================================================================
// Text utilities
// =============================================================================
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// =============================================================================
// Number formatting
// =============================================================================
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatPercent(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function formatCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: n >= 1_000_000 ? "compact" : "standard",
  }).format(n);
}

// =============================================================================
// Domain color mapping
// =============================================================================
export function getDomainColor(domain: string): string {
  const map: Record<string, string> = {
    Military: "#ff3b3b",
    Financial: "#f0a500",
    Political: "#00d4ff",
    Humanitarian: "#a78bfa",
    Trade: "#34d399",
    Energy: "#fb923c",
  };
  return map[domain] ?? "#6b7280";
}

// =============================================================================
// Trend formatting
// =============================================================================
export function formatTrend(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return delta.toString();
}

export function getTrendColor(delta: number): string {
  if (delta > 0) return "#ff3b3b"; // rising = more risky = red
  if (delta < 0) return "#00e676"; // falling = less risky = green
  return "#6b7280";
}
