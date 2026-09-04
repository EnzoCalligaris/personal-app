import type { LucideIcon } from "lucide-react";
import { InboxIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = React.ComponentProps<"div"> & {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Ação principal (ex.: <Button>Criar treino</Button>). */
  action?: React.ReactNode;
  /** Ação secundária, discreta. */
  secondaryAction?: React.ReactNode;
  size?: "default" | "sm";
};

/** Estado vazio: nada aqui ainda, com um caminho claro para a próxima ação. */
function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  secondaryAction,
  size = "default",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      data-size={size}
      className={cn(
        "flex animate-fade-up flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 text-center",
        size === "sm" ? "gap-3 py-8" : "gap-4 py-14",
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-2xl bg-muted text-muted-foreground",
          size === "sm" ? "size-11" : "size-14"
        )}
      >
        <Icon className={size === "sm" ? "size-5" : "size-6"} />
      </div>

      <div className="flex flex-col gap-1.5">
        <h3
          className={cn(
            "font-heading font-semibold tracking-tight text-foreground",
            size === "sm" ? "text-sm" : "text-base"
          )}
        >
          {title}
        </h3>
        {description ? (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-balance text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {action || secondaryAction ? (
        <div className="mt-1 flex flex-col-reverse items-center gap-2 sm:flex-row">
          {secondaryAction}
          {action}
        </div>
      ) : null}
    </div>
  );
}

export { EmptyState };
