import { cn } from "@/lib/utils";

type PageHeaderProps = React.ComponentProps<"header"> & {
  /** Texto pequeno acima do título (ex.: seção atual). */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Botões/ações do topo da página. */
  actions?: React.ReactNode;
};

/** Cabeçalho padrão de página: título, apoio e ações. */
function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        {eyebrow ? (
          <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-balance text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export { PageHeader };
