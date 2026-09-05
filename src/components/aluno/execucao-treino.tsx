"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleIcon,
  ClockIcon,
  DumbbellIcon,
  ListChecksIcon,
  RepeatIcon,
  TimerIcon,
  WeightIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { diasProgramadosLabel, formatarDataRelativa } from "@/lib/format";
import { formatarDuracao } from "@/lib/treinos/duracao";
import { toast } from "@/lib/toast";
import type { MeuTreinoDetalhe } from "@/types/aluno-area";
import type { TreinoItemExercicio } from "@/types/treino";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

/**
 * Execução do treino: o aluno vai marcando os exercícios e, ao final,
 * registra a execução (é o que alimenta o histórico e a sequência).
 */
export function ExecucaoTreino({ treinoId }: { treinoId: string }) {
  const router = useRouter();
  const { data, loading, error, refetch } = useApi<MeuTreinoDetalhe>(
    `/api/aluno/treinos/${treinoId}`
  );

  const [feitos, setFeitos] = React.useState<Set<string>>(new Set());
  const [observacoes, setObservacoes] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  function alternar(id: string) {
    setFeitos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  async function concluir() {
    setSalvando(true);
    try {
      const res = await fetch(`/api/aluno/treinos/${treinoId}/execucoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacoes: observacoes || null }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível registrar o treino.");
        return;
      }

      toast.success("Treino registrado!", { description: "Ele já entrou no seu histórico." });
      router.push("/aluno");
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  if (error) {
    return (
      <ErrorState
        title="Não foi possível abrir este treino"
        description="A ficha pode ter sido removida pelo seu Personal."
        detail={error}
        onRetry={refetch}
        action={
          <Button variant="outline" render={<Link href="/aluno/treinos" />}>
            Voltar para minhas fichas
          </Button>
        }
      />
    );
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const total = data.exercicios.length;
  const concluidos = data.exercicios.filter((item) => feitos.has(item.id)).length;
  const progresso = total === 0 ? 0 : Math.round((concluidos / total) * 100);

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/aluno/treinos" />}>
          <ArrowLeftIcon />
          Minhas fichas
        </Button>
      </div>

      <header className="flex animate-fade-up flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{diasProgramadosLabel(data.diasProgramados)}</Badge>
          {data.ultimaExecucao ? (
            <span className="text-xs text-muted-foreground">
              Feito pela última vez {formatarDataRelativa(data.ultimaExecucao)}
            </span>
          ) : null}
        </div>

        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          {data.nome}
        </h1>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="gap-1">
            <ListChecksIcon className="size-3" />
            {total} {total === 1 ? "exercício" : "exercícios"}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ClockIcon className="size-3" />
            {formatarDuracao(data.duracaoMin)}
          </Badge>
          {data.grupos.map((grupo) => (
            <Badge key={grupo} variant="secondary">
              {grupo}
            </Badge>
          ))}
        </div>

        {data.observacoes ? (
          <p className="rounded-xl bg-muted/60 p-3 text-sm leading-relaxed text-muted-foreground">
            {data.observacoes}
          </p>
        ) : null}
      </header>

      {total === 0 ? (
        <EmptyState
          icon={DumbbellIcon}
          title="Esta ficha ainda não tem exercícios"
          description="Seu Personal ainda está montando este treino."
        />
      ) : (
        <>
          <div className="sticky top-14 z-10 flex items-center gap-3 rounded-2xl bg-card/90 p-3 shadow-soft ring-1 ring-border backdrop-blur-lg md:top-4">
            <div className="flex-1">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium">
                  {concluidos} de {total} exercícios
                </span>
                <span className="tabular-nums text-muted-foreground">{progresso}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={progresso}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso do treino"
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </div>
          </div>

          <ol className="flex flex-col gap-3">
            {data.exercicios.map((item, indice) => (
              <li key={item.id}>
                <ItemExercicio
                  item={item}
                  indice={indice + 1}
                  feito={feitos.has(item.id)}
                  onToggle={() => alternar(item.id)}
                />
              </li>
            ))}
          </ol>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Finalizar</CardTitle>
              <CardDescription>
                Conte como foi (opcional) e registre o treino no seu histórico.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea
                aria-label="Como foi o treino"
                placeholder="Como foi o treino? Alguma dor, carga nova, algo para o Personal saber?"
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                maxLength={500}
                rows={3}
              />
              <Button size="lg" onClick={concluir} disabled={salvando}>
                <CheckIcon />
                {salvando ? "Registrando..." : "Concluir treino"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ItemExercicio({
  item,
  indice,
  feito,
  onToggle,
}: {
  item: TreinoItemExercicio;
  indice: number;
  feito: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={feito}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40",
        feito
          ? "border-primary/40 bg-primary/[0.07] dark:bg-primary/12"
          : "border-border bg-card shadow-soft hover:border-foreground/15 hover:shadow-raised"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
          feito ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {feito ? <CheckIcon className="size-4.5" /> : <CircleIcon className="size-4.5" />}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col">
          <span className="text-[0.7rem] font-medium text-muted-foreground">
            {indice}. {item.exercicio.grupoMuscular}
          </span>
          <span className={cn("font-medium", feito && "line-through opacity-70")}>
            {item.exercicio.nome}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Detalhe icon={RepeatIcon} texto={`${item.series} x ${item.repeticoes}`} />
          {item.carga ? <Detalhe icon={WeightIcon} texto={item.carga} /> : null}
          {item.descansoSeg ? (
            <Detalhe icon={TimerIcon} texto={`${item.descansoSeg}s de descanso`} />
          ) : null}
        </div>

        {item.observacoes ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{item.observacoes}</p>
        ) : null}

        {item.exercicio.videoUrl ? (
          <a
            href={item.exercicio.videoUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="w-fit text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver demonstração
          </a>
        ) : null}
      </div>
    </button>
  );
}

function Detalhe({ icon: Icon, texto }: { icon: typeof RepeatIcon; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-medium">
      <Icon className="size-3 text-muted-foreground" aria-hidden="true" />
      {texto}
    </span>
  );
}
