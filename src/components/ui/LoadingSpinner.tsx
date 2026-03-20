import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  color?: string;
  className?: string;
}

const sizeMap = {
  xs: "w-3 h-3 border-[1.5px]",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-[3px]",
};

export function LoadingSpinner({
  size = "md",
  color,
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "rounded-full animate-spin border-t-transparent",
        sizeMap[size],
        !color && "border-axiom-amber",
        className
      )}
      style={
        color
          ? {
              borderColor: color,
              borderTopColor: "transparent",
            }
          : undefined
      }
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-axiom-body">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-xs font-mono tracking-widest text-white/40 uppercase">
          Initializing AXIOM...
        </p>
      </div>
    </div>
  );
}
