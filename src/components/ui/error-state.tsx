"use client";

import { AlertTriangleIcon, RotateCwIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ErrorStateProps = React.ComponentProps<"div"> & {
  title?: string;
  description?: string;
  /** Detalhe técnico opcional (ex.: mensagem do erro). */
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  size?: "default" | "sm";
};

/** Estado de erro: o que aconteceu e como tentar de novo. */
function ErrorState({
  title = "Algo deu errado",
  description = "Não foi possível carregar estas informações. Tente novamente em instantes.",
  detail,
  onRetry,
  retryLabel = "Tentar novamente",
  action,
  size = "default",
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn(
        "flex animate-fade-up flex-col items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/[0.04] px-6 text-center dark:bg-destructive/[0.07]",
        size === "sm" ? "gap-3 py-8" : "gap-4 py-14",
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-2xl bg-destructive/10 text-destructive",
          size === "sm" ? "size-11" : "size-14"
        )}
      >
        <AlertTriangleIcon className={size === "sm" ? "size-5" : "size-6"} />
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
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-balance text-muted-foreground">
          {description}
        </p>
        {detail ? (
          <p className="mx-auto max-w-sm truncate font-mono text-xs text-muted-foreground/70">
            {detail}
          </p>
        ) : null}
      </div>

      {onRetry || action ? (
        <div className="mt-1 flex flex-col-reverse items-center gap-2 sm:flex-row">
          {action}
          {onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              <RotateCwIcon />
              {retryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { ErrorState };
