"use client";

import * as React from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { CalendarioResponse, DiaPrevisto } from "@/types/programacao";
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
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

const ROTULOS = ["D", "S", "T", "Q", "Q", "S", "S"];

function paraISO(data: Date) {
  return data.toISOString().slice(0, 10);
}

function inicioDaSemanaUTC(data: Date) {
  const d = new Date(data);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

function somarDias(data: Date, dias: number) {
  const d = new Date(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

function hojeUTC() {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

const SEMANAS_VISIVEIS = 4;

/**
 * Calendário do aluno: mostra, dia a dia, o que a programação prevê. É a
 * mesma resolução que responderá "treino de hoje" no app do aluno.
 */
export function CalendarioTreinos({ alunoId, chave }: { alunoId: string; chave?: number }) {
  // Sempre começa no domingo, para as colunas baterem com os dias da semana.
  const [inicio, setInicio] = React.useState(() => inicioDaSemanaUTC(hojeUTC()));

  const de = paraISO(inicio);
  const ate = paraISO(somarDias(inicio, SEMANAS_VISIVEIS * 7 - 1));

  const { data, loading, error, refetch } = useApi<CalendarioResponse>(
    `/api/personal/alunos/${alunoId}/calendario?de=${de}&ate=${ate}&v=${chave ?? 0}`
  );

  const hoje = paraISO(hojeUTC());

  return (
    <Card>
      <CardHeader className="border-b max-md:grid-cols-1!">
        <CardTitle>Calendário de treinos</CardTitle>
        <CardDescription>
          O que está previsto em cada data, resolvido pela programação vigente.
        </CardDescription>
        <CardAction className="max-md:col-start-1 max-md:row-span-1 max-md:row-start-3 max-md:justify-self-start">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Semanas anteriores"
              onClick={() => setInicio((atual) => somarDias(atual, -7 * SEMANAS_VISIVEIS))}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInicio(inicioDaSemanaUTC(hojeUTC()))}
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Próximas semanas"
              onClick={() => setInicio((atual) => somarDias(atual, 7 * SEMANAS_VISIVEIS))}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent>
        {loading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : error ? (
          <ErrorState
            size="sm"
            title="Não foi possível carregar o calendário"
            detail={error}
            onRetry={refetch}
          />
        ) : data ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
              {ROTULOS.map((rotulo, indice) => (
                <span key={`${rotulo}-${indice}`}>{rotulo}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {data.dias.map((dia) => (
                <CelulaDia key={dia.data} dia={dia} ehHoje={dia.data === hoje} />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-primary/25 ring-1 ring-primary/40" />
                Treino previsto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded bg-muted ring-1 ring-border" />
                Descanso
              </span>
              <span className="flex items-center gap-1.5">
                <CheckIcon className="size-3 text-success" />
                Execução registrada
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CelulaDia({ dia, ehHoje }: { dia: DiaPrevisto; ehHoje: boolean }) {
  const numero = Number(dia.data.slice(8, 10));
  const temTreino = dia.tipo === "TREINO";

  return (
    <button
      type="button"
      onClick={() =>
        toast.info(
          temTreino
            ? `${new Date(dia.data + "T12:00:00Z").toLocaleDateString("pt-BR")}: ${dia.treino?.nome}`
            : dia.tipo === "DESCANSO"
              ? `${new Date(dia.data + "T12:00:00Z").toLocaleDateString("pt-BR")}: descanso`
              : "Sem programação para esta data"
        )
      }
      title={
        temTreino ? dia.treino?.nome : dia.tipo === "DESCANSO" ? "Descanso" : "Sem programação"
      }
      className={cn(
        "flex min-h-16 flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors",
        temTreino
          ? "border-primary/40 bg-primary/12 hover:bg-primary/20 dark:bg-primary/15"
          : dia.tipo === "DESCANSO"
            ? "border-border bg-muted/40 hover:bg-muted"
            : "border-dashed border-border bg-transparent hover:bg-muted/40",
        ehHoje && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
    >
      <span className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            ehHoje ? "text-primary" : "text-muted-foreground"
          )}
        >
          {numero}
        </span>
        {dia.executado ? <CheckIcon className="size-3 text-success" /> : null}
      </span>

      {temTreino ? (
        <span className="line-clamp-2 text-[0.65rem] leading-tight font-medium">
          {dia.treino?.nome}
        </span>
      ) : dia.tipo === "DESCANSO" ? (
        <span className="text-[0.65rem] text-muted-foreground">Descanso</span>
      ) : null}

      {dia.treinoInativo ? (
        <Badge variant="warning" className="h-4 px-1 text-[0.6rem]">
          inativo
        </Badge>
      ) : null}
    </button>
  );
}
