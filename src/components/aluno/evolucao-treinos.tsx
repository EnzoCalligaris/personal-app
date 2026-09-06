"use client";

import * as React from "react";
import Link from "next/link";
import {
  ActivityIcon,
  CalendarCheckIcon,
  ChevronRightIcon,
  DumbbellIcon,
  FlameIcon,
  TrendingUpIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatarDataCalendario, formatarVariacao, plural } from "@/lib/format";
import { formatarCarga } from "@/lib/treinos/carga";
import type { EvolucaoExercicio, ProgressoResponse, SemanaDeTreino } from "@/types/aluno-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { GraficoEvolucao } from "@/components/aluno/grafico-evolucao";

/**
 * Evolução dos treinos: frequência, sequência e a progressão de carga por
 * exercício. Nada aqui é estimado - se não houve treino registrado, a tela
 * explica que os números aparecem conforme o aluno treina.
 */
export function EvolucaoDosTreinos() {
  const { data, loading, error, refetch } = useApi<ProgressoResponse>("/api/aluno/progresso");

  if (error) {
    return <ErrorState title="Não foi possível carregar sua evolução" detail={error} onRetry={refetch} />;
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, indice) => (
            <Skeleton key={indice} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (data.resumo.totalConcluidos === 0) {
    return (
      <EmptyState
        icon={TrendingUpIcon}
        title="Sua evolução começa no primeiro treino"
        description="Assim que você concluir treinos pelo app, aparecem aqui a sua frequência, a sequência de treinos e a progressão de carga de cada exercício."
        action={
          <Button render={<Link href="/aluno/treinos" />}>
            <DumbbellIcon />
            Ver minhas fichas
          </Button>
        }
      />
    );
  }

  const { resumo } = data;

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Seus números" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Treinos concluídos"
          value={resumo.totalConcluidos}
          icon={CalendarCheckIcon}
        />
        <StatCard
          label="Sequência"
          value={resumo.sequenciaAtual}
          unit={resumo.sequenciaAtual === 1 ? "treino" : "treinos"}
          icon={FlameIcon}
          tone="amber"
        />
        <StatCard
          label="Frequência"
          value={resumo.frequenciaSemanal.toLocaleString("pt-BR")}
          unit="por semana"
          icon={ActivityIcon}
          tone="violet"
        />
        <StatCard
          label={resumo.aderencia ? "Últimas 4 semanas" : "Nesta semana"}
          value={resumo.aderencia ? resumo.aderencia.realizados : resumo.naSemana}
          unit={
            resumo.aderencia
              ? `de ${resumo.aderencia.previstos} programados`
              : resumo.naSemana === 1
                ? "treino"
                : "treinos"
          }
          icon={DumbbellIcon}
          tone="cyan"
        />
      </section>

      {resumo.melhorSequencia > resumo.sequenciaAtual ? (
        <p className="-mt-1 text-xs text-muted-foreground">
          Sua melhor sequência até hoje foi de{" "}
          <span className="font-medium text-foreground">
            {plural(resumo.melhorSequencia, "treino")} {resumo.melhorSequencia === 1 ? "seguido" : "seguidos"}
          </span>
          . Dias de descanso não quebram a sequência.
        </p>
      ) : null}

      <Frequencia semanas={data.semanas} />

      <EvolucaoDeCarga exercicios={data.exercicios} />
    </div>
  );
}

/* -------------------------------------------------------------------------
   Frequência semanal
   ------------------------------------------------------------------------- */

function Frequencia({ semanas }: { semanas: SemanaDeTreino[] }) {
  const maximo = Math.max(1, ...semanas.map((semana) => Math.max(semana.realizados, semana.previstos)));
  const temAlgo = semanas.some((semana) => semana.realizados > 0);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Frequência</CardTitle>
        <CardDescription>Treinos concluídos por semana, nas últimas 12 semanas.</CardDescription>
      </CardHeader>
      <CardContent>
        {!temAlgo ? (
          <EmptyState
            size="sm"
            icon={ActivityIcon}
            title="Ainda sem treinos nas últimas semanas"
            description="Cada treino concluído vira uma barra aqui."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex h-32 items-end gap-1.5">
              {semanas.map((semana, indice) => {
                const altura = Math.round((semana.realizados / maximo) * 100);
                const previstoAltura = Math.round((semana.previstos / maximo) * 100);
                const ehAtual = indice === semanas.length - 1;

                return (
                  <div
                    key={semana.inicio}
                    className="group relative flex h-full flex-1 flex-col justify-end gap-1"
                    title={`${formatarDataCalendario(semana.inicio)} a ${formatarDataCalendario(
                      semana.fim
                    )}: ${plural(semana.realizados, "treino")}${
                      semana.previstos
                        ? ` de ${semana.previstos} ${
                            semana.previstos === 1 ? "programado" : "programados"
                          }`
                        : ""
                    }`}
                  >
                    {/* Traço do previsto: dá contexto à barra do realizado. */}
                    {semana.previstos > 0 ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 border-t border-dashed border-muted-foreground/40"
                        style={{ bottom: `calc(${previstoAltura}% + 1.25rem)` }}
                      />
                    ) : null}

                    <span
                      className={cn(
                        "w-full rounded-t-md transition-colors",
                        ehAtual ? "bg-primary" : "bg-primary/45 group-hover:bg-primary/70"
                      )}
                      style={{ height: `${Math.max(altura, semana.realizados > 0 ? 6 : 2)}%` }}
                    />
                    <span className="text-center text-[0.6rem] leading-none text-muted-foreground tabular-nums">
                      {semana.inicio.slice(8, 10)}/{semana.inicio.slice(5, 7)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-primary/45" />
                Treinos concluídos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t border-dashed border-muted-foreground/60" />
                Programado pelo seu Personal
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------
   Evolução de carga por exercício
   ------------------------------------------------------------------------- */

function EvolucaoDeCarga({ exercicios }: { exercicios: EvolucaoExercicio[] }) {
  const comGrafico = exercicios.filter((exercicio) => exercicio.temGrafico);
  const [selecionado, setSelecionado] = React.useState<string | null>(null);

  const atual =
    comGrafico.find((exercicio) => exercicio.chave === selecionado) ?? comGrafico[0] ?? null;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Evolução por exercício</CardTitle>
        <CardDescription>
          A carga que você registrou em cada exercício, treino a treino.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {exercicios.length === 0 ? (
          <EmptyState
            size="sm"
            icon={DumbbellIcon}
            title="Nenhum exercício registrado ainda"
            description="Ao concluir um treino pela tela de execução, cada exercício entra aqui com a carga que você usou."
          />
        ) : comGrafico.length === 0 ? (
          <EmptyState
            size="sm"
            icon={TrendingUpIcon}
            title="Falta um segundo treino para comparar"
            description="A progressão aparece quando o mesmo exercício for registrado com carga em pelo menos dois treinos."
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {comGrafico.map((exercicio) => (
                <button
                  key={exercicio.chave}
                  type="button"
                  onClick={() => setSelecionado(exercicio.chave)}
                  aria-pressed={atual?.chave === exercicio.chave}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors outline-none",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                    atual?.chave === exercicio.chave
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {exercicio.nome}
                </button>
              ))}
            </div>

            {atual ? <DetalheDoExercicio exercicio={atual} /> : null}
          </>
        )}

        {/* Os que ainda não dão gráfico continuam visíveis: o aluno vê o que já registrou. */}
        {exercicios.length > comGrafico.length ? (
          <details className="rounded-xl bg-muted/40 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Outros exercícios registrados ({exercicios.length - comGrafico.length})
            </summary>
            <ul className="flex flex-col gap-2 pt-3">
              {exercicios
                .filter((exercicio) => !exercicio.temGrafico)
                .map((exercicio) => (
                  <li
                    key={exercicio.chave}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{exercicio.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {exercicio.grupoMuscular}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {exercicio.sessoes} {exercicio.sessoes === 1 ? "treino" : "treinos"}
                      {exercicio.cargaAtual !== null ? ` · ${formatarCarga(exercicio.cargaAtual)}` : ""}
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetalheDoExercicio({ exercicio }: { exercicio: EvolucaoExercicio }) {
  const pontos = exercicio.registros
    .filter((registro) => registro.cargaKg !== null)
    .map((registro) => ({ data: registro.data, valor: registro.cargaKg! }));

  const evoluiu = exercicio.variacaoKg !== null && exercicio.variacaoKg !== 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-heading text-lg font-semibold">{exercicio.nome}</span>
          <span className="text-xs text-muted-foreground">
            {exercicio.grupoMuscular} · {exercicio.sessoes}{" "}
            {exercicio.sessoes === 1 ? "treino" : "treinos"}
            {exercicio.cargaMaxima !== null
              ? ` · melhor carga: ${formatarCarga(exercicio.cargaMaxima)}`
              : ""}
          </span>
        </div>

        {evoluiu ? (
          <Badge
            variant={exercicio.variacaoKg! > 0 ? "success" : "warning"}
            className="gap-1"
            title="Diferença entre o primeiro e o último treino registrado"
          >
            <TrendingUpIcon className="size-3" />
            {formatarVariacao(exercicio.variacaoKg!)} kg
            {exercicio.variacaoPercentual !== null
              ? ` (${formatarVariacao(exercicio.variacaoPercentual)}%)`
              : ""}
          </Badge>
        ) : (
          <Badge variant="secondary">Mesma carga do primeiro treino</Badge>
        )}
      </div>

      <GraficoEvolucao pontos={pontos} unidade=" kg" rotulo={exercicio.nome} />

      {/* A progressão em texto: é como o aluno conta a própria evolução. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {exercicio.registros.map((registro, indice) => (
          <React.Fragment key={registro.data}>
            {indice > 0 ? (
              <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            ) : null}
            <span
              title={`${formatarDataCalendario(registro.data)} · ${registro.series} x ${registro.repeticoes}`}
              className={cn(
                "rounded-lg px-2 py-1 text-xs font-medium tabular-nums",
                indice === exercicio.registros.length - 1
                  ? "bg-primary/15 text-primary dark:bg-primary/20"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {registro.cargaKg !== null ? formatarCarga(registro.cargaKg) : (registro.carga ?? "--")}
            </span>
          </React.Fragment>
        ))}
      </div>

      <ul className="flex flex-col divide-y divide-border text-sm">
        {[...exercicio.registros].reverse().map((registro) => (
          <li key={registro.data} className="flex items-center justify-between gap-3 py-2">
            <span className="text-muted-foreground">{formatarDataCalendario(registro.data)}</span>
            <span className="tabular-nums">
              {registro.series} x {registro.repeticoes}
              {registro.carga ? ` · ${registro.carga}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
