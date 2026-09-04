import type { LucideIcon } from "lucide-react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const toneStyles = {
  primary: "bg-primary/12 text-primary dark:bg-primary/15",
  violet: "bg-chart-2/12 text-chart-2 dark:bg-chart-2/20",
  cyan: "bg-chart-3/12 text-chart-3 dark:bg-chart-3/20",
  amber: "bg-chart-4/15 text-chart-4 dark:bg-chart-4/20",
  neutral: "bg-muted text-muted-foreground",
} as const;

type StatCardProps = React.ComponentProps<"div"> & {
  label: string;
  value?: React.ReactNode;
  unit?: string;
  icon?: LucideIcon;
  tone?: keyof typeof toneStyles;
  /** Variação em relação ao período anterior (ex.: "+12%"). */
  trend?: { value: string; direction: "up" | "down"; positive?: boolean };
  loading?: boolean;
};

/** Card de métrica: rótulo, valor em destaque e variação. */
function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "primary",
  trend,
  loading = false,
  className,
  ...props
}: StatCardProps) {
  const trendPositive = trend?.positive ?? trend?.direction === "up";
  const TrendIcon = trend?.direction === "up" ? TrendingUpIcon : TrendingDownIcon;

  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border transition-shadow hover:shadow-raised sm:p-5",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon ? (
          <span
            aria-hidden="true"
            className={cn("flex size-9 items-center justify-center rounded-xl", toneStyles[tone])}
          >
            <Icon className="size-4.5" />
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-3xl">
            {value ?? "--"}
          </span>
          {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
        </div>
      )}

      {trend && !loading ? (
        <div
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            trendPositive
              ? "bg-success/12 text-success dark:bg-success/18"
              : "bg-destructive/12 text-destructive dark:bg-destructive/18"
          )}
        >
          <TrendIcon className="size-3" aria-hidden="true" />
          {trend.value}
        </div>
      ) : null}
    </div>
  );
}

export { StatCard };
