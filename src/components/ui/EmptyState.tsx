import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-8 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08]">
          <span className="text-white/30">{icon}</span>
        </div>
      )}
      <h3 className="font-display text-lg tracking-widest text-white/40 mb-2">
        {title.toUpperCase()}
      </h3>
      {description && (
        <p className="text-xs text-white/30 max-w-xs leading-relaxed font-ui mb-6">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
