"use client";

import * as React from "react";
import {
  CalendarCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  DumbbellIcon,
  ListChecksIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatarCronometro, formatarDataRelativa, formatarDiaPorExtenso } from "@/lib/format";
import type { ExecucaoRegistrada, MeuHistoricoResponse } from "@/types/aluno-area";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonList } from "@/components/ui/loading";
import { StatCard } from "@/components/ui/stat-card";

/** Tudo que o aluno já treinou, com o detalhe de cada sessão. */
export function HistoricoTreinos() {
  const { data, loading, error, refetch } = useApi<MeuHistoricoResponse>("/api/aluno/historico");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Seus treinos"
        title="Histórico"
        description="Cada sessão registrada, com os exercícios, as séries e a carga que você usou."
      />

      {error ? (
        <ErrorState title="Não foi possível carregar seu histórico" detail={error} onRetry={refetch} />
      ) : loading || !data ? (
        <SkeletonList items={4} />
      ) : data.execucoes.length === 0 ? (
        <EmptyState
          icon={CalendarCheckIcon}
          title="Nenhum treino registrado ainda"
          description="Ao terminar uma sessão, ela aparece aqui com tudo o que você fez."
        />
      ) : (
        <>
          <section aria-label="Resumo" className="grid grid-cols-3 gap-3">
            <StatCard label="Treinos" value={data.resumo.total} icon={CalendarCheckIcon} />
            <StatCard label="Últimos 30 dias" value={data.resumo.noMes} icon={DumbbellIcon} tone="violet" />
            <StatCard
              label="Minutos"
              value={data.resumo.minutosTotais}
              icon={ClockIcon}
              tone="cyan"
            />
          </section>

          <ol className="flex flex-col gap-3">
            {data.execucoes.map((execucao) => (
              <li key={execucao.id}>
                <ItemHistorico execucao={execucao} />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function ItemHistorico({ execucao }: { execucao: ExecucaoRegistrada }) {
  const [aberto, setAberto] = React.useState(false);
  const temDetalhe = execucao.itens.length > 0;

  return (
    <article className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-border">
      <button
        type="button"
        onClick={() => temDetalhe && setAberto((valor) => !valor)}
        aria-expanded={temDetalhe ? aberto : undefined}
        disabled={!temDetalhe}
        className={cn(
          "flex w-full items-center gap-3 p-4 text-left transition-colors outline-none",
          temDetalhe && "hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/40"
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/12 text-success dark:bg-success/18"
        >
          <CheckIcon className="size-5" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-medium">{execucao.treino.nome}</span>
          <span className="truncate text-xs text-muted-foreground first-letter:uppercase">
            {formatarDiaPorExtenso(execucao.data.slice(0, 10))} · {formatarDataRelativa(execucao.data)}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Badge variant="outline" className="gap-1">
              <ListChecksIcon className="size-3" />
              {execucao.exerciciosConcluidos}/{execucao.totalExercicios}
            </Badge>
            {execucao.totalSeries > 0 ? (
              <Badge variant="outline">{execucao.totalSeries} séries</Badge>
            ) : null}
            {execucao.duracaoSeg ? (
              <Badge variant="outline" className="gap-1">
                <ClockIcon className="size-3" />
                {formatarCronometro(execucao.duracaoSeg)}
              </Badge>
            ) : null}
          </div>
        </div>

        {temDetalhe ? (
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform",
              aberto && "rotate-180"
            )}
          />
        ) : null}
      </button>

      {aberto ? (
        <div className="flex flex-col gap-3 border-t border-border bg-muted/25 p-4">
          <ul className="flex flex-col divide-y divide-border">
            {execucao.itens.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                    item.concluido
                      ? "bg-success/15 text-success dark:bg-success/20"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.concluido ? <CheckIcon className="size-3.5" /> : item.ordem}
                </span>

                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "truncate text-sm",
                      !item.concluido && "text-muted-foreground line-through"
                    )}
                  >
                    {item.nome}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.grupoMuscular}</span>
                </div>

                <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {item.series} x {item.repeticoes}
                  {item.carga ? (
                    <>
                      <br />
                      {item.carga}
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {execucao.observacoes ? (
            <p className="rounded-xl bg-card p-3 text-sm leading-relaxed ring-1 ring-border">
              <span className="font-medium">Sua anotação: </span>
              {execucao.observacoes}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
