import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Estado de carregamento centralizado, para áreas de conteúdo. */
function LoadingState({
  message = "Carregando...",
  className,
  ...props
}: React.ComponentProps<"div"> & { message?: string }) {
  return (
    <div
      data-slot="loading-state"
      className={cn(
        "flex min-h-48 animate-fade-up flex-col items-center justify-center gap-3 py-12 text-center",
        className
      )}
      {...props}
    >
      <Spinner size="lg" className="text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/** Cobre o container pai enquanto uma ação acontece (o pai precisa ser relative). */
function LoadingOverlay({
  message,
  className,
  ...props
}: React.ComponentProps<"div"> & { message?: string }) {
  return (
    <div
      data-slot="loading-overlay"
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-background/70 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      <Spinner size="lg" className="text-primary" />
      {message ? <p className="text-sm font-medium text-muted-foreground">{message}</p> : null}
    </div>
  );
}

/** Placeholder de um card de conteúdo. */
function SkeletonCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <Card className={cn("", className)} {...props}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </CardContent>
    </Card>
  );
}

/** Placeholder de uma lista (n itens). */
function SkeletonList({
  items = 3,
  className,
  ...props
}: React.ComponentProps<"div"> & { items?: number }) {
  return (
    <div data-slot="skeleton-list" className={cn("flex flex-col gap-3", className)} {...props}>
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border"
        >
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export { LoadingState, LoadingOverlay, SkeletonCard, SkeletonList };
