import { cn } from "../lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
  label,
}: {
  /** 0–1 */
  value: number;
  className?: string;
  indicatorClassName?: string;
  label: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-[width] duration-300 ease-out", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
