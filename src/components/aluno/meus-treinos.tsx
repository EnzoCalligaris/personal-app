"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ChevronRightIcon,
  ClockIcon,
  DumbbellIcon,
  ListChecksIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import {
  diasProgramadosLabel,
  formatarCronometro,
  formatarDataRelativa,
  plural,
} from "@/lib/format";
import { formatarDuracao } from "@/lib/treinos/duracao";
import type { MeusTreinosResponse } from "@/types/aluno-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonList } from "@/components/ui/loading";

/** Fichas do aluno e o histórico do que ele já executou. */
export function MeusTreinos() {
  const { data, loading, error, refetch } = useApi<MeusTreinosResponse>("/api/aluno/treinos");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Minhas fichas"
        title="Treinos"
        description="As fichas que seu Personal montou para você, com os dias em que cada uma entra na semana."
      />

      {error ? (
        <ErrorState
          title="Não foi possível carregar seus treinos"
          detail={error}
          onRetry={refetch}
        />
      ) : loading || !data ? (
        <SkeletonList items={3} />
      ) : data.treinos.length === 0 ? (
        <EmptyState
          icon={DumbbellIcon}
          title="Nenhuma ficha ainda"
          description="Assim que seu Personal montar seu treino, ele aparece aqui pronto para executar."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.treinos.map((treino) => (
            <li key={treino.id}>
              <Link
                href={`/aluno/treinos/${treino.id}`}
                className="group flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary dark:bg-primary/18"
                >
                  <DumbbellIcon className="size-5" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">{treino.nome}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {diasProgramadosLabel(treino.diasProgramados)}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Badge variant="outline" className="gap-1">
                      <ListChecksIcon className="size-3" />
                      {treino.totalExercicios}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <ClockIcon className="size-3" />
                      {formatarDuracao(treino.duracaoMin)}
                    </Badge>
                    {treino.ultimaExecucao ? (
                      <Badge variant="success" className="gap-1">
                        <CalendarCheckIcon className="size-3" />
                        {formatarDataRelativa(treino.ultimaExecucao)}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Últimos treinos</CardTitle>
          <CardDescription>As sessões que você registrou.</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" render={<Link href="/aluno/historico" />}>
              Ver histórico
              <ArrowRightIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <SkeletonList items={2} />
          ) : data.historico.length === 0 ? (
            <EmptyState
              size="sm"
              icon={CalendarCheckIcon}
              title="Nada registrado ainda"
              description="Ao terminar uma sessão de treino, ela entra no seu histórico com tudo o que você fez."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.historico.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/12 text-success dark:bg-success/18"
                  >
                    <CalendarCheckIcon className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {item.treino.nome}
                      {/* Ficha excluída pelo Personal: a execução permanece. */}
                      {item.treino.id === null ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (ficha removida)
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                      {item.exerciciosConcluidos}/{item.totalExercicios} exercícios
                      {item.totalSeries ? ` · ${plural(item.totalSeries, "série")}` : ""}
                      {item.duracaoSeg ? ` · ${formatarCronometro(item.duracaoSeg)}` : ""}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatarDataRelativa(item.data)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
