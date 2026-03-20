import { cn, getSeverityBgClass } from "@/lib/utils";
import type { SignalSeverity, SignalDomain } from "@/types";

interface SeverityBadgeProps {
  severity: SignalSeverity;
  className?: string;
  size?: "sm" | "md";
}

export function SeverityBadge({
  severity,
  className,
  size = "md",
}: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border rounded-[2px] font-mono font-bold tracking-widest uppercase",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        getSeverityBgClass(severity),
        className
      )}
    >
      {severity}
    </span>
  );
}

interface DomainBadgeProps {
  domain: SignalDomain | string;
  className?: string;
}

const domainColors: Record<string, string> = {
  Military: "bg-red-500/15 text-red-400 border-red-500/30",
  Financial: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Political: "bg-cyan-400/15 text-cyan-400 border-cyan-400/30",
  Humanitarian: "bg-violet-400/15 text-violet-400 border-violet-400/30",
  Trade: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  Energy: "bg-orange-400/15 text-orange-400 border-orange-400/30",
};

export function DomainBadge({ domain, className }: DomainBadgeProps) {
  const colorClass = domainColors[domain] ?? "bg-white/10 text-white/60 border-white/20";
  return (
    <span
      className={cn(
        "inline-flex items-center border rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider font-ui",
        colorClass,
        className
      )}
    >
      {domain}
    </span>
  );
}

interface TagBadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function TagBadge({ children, className }: TagBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono bg-white/[0.05] text-white/50 border border-white/[0.07]",
        className
      )}
    >
      {children}
    </span>
  );
}
