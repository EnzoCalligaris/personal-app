"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  ClockIcon,
  DumbbellIcon,
  ListChecksIcon,
  PlayIcon,
  RepeatIcon,
  TimerIcon,
  VideoIcon,
  WeightIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { diasProgramadosLabel, formatarDataRelativa } from "@/lib/format";
import { exibirCarga } from "@/lib/treinos/carga";
import { formatarDuracao } from "@/lib/treinos/duracao";
import type { MeuTreinoDetalhe } from "@/types/aluno-area";
import type { TreinoItemExercicio } from "@/types/treino";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A ficha antes de treinar: o aluno confere o que vem pela frente e começa a
 * sessão. A execução em si acontece em `/aluno/treinos/[id]/sessao`.
 */
export function TreinoDetalhe({ treinoId }: { treinoId: string }) {
  const { data, loading, error, refetch } = useApi<MeuTreinoDetalhe>(
    `/api/aluno/treinos/${treinoId}`
  );

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
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarCheckIcon className="size-3.5" />
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
          <p className="rounded-xl border-l-4 border-primary/50 bg-primary/[0.06] p-3 text-sm leading-relaxed dark:bg-primary/10">
            <span className="font-medium">Do seu Personal: </span>
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
          <Button size="lg" render={<Link href={`/aluno/treinos/${treinoId}/sessao`} />}>
            <PlayIcon />
            Começar treino
          </Button>

          <ol className="flex flex-col gap-3">
            {data.exercicios.map((item) => (
              <li key={item.id}>
                <ItemFicha item={item} />
              </li>
            ))}
          </ol>

          <Button
            size="lg"
            className="sm:hidden"
            render={<Link href={`/aluno/treinos/${treinoId}/sessao`} />}
          >
            <PlayIcon />
            Começar treino
          </Button>
        </>
      )}
    </div>
  );
}

function ItemFicha({ item }: { item: TreinoItemExercicio }) {
  return (
    <article className="flex gap-3 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border">
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 to-muted text-primary/50">
        {item.exercicio.imagemUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.exercicio.imagemUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <DumbbellIcon className="size-6" aria-hidden="true" />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col">
          <span className="text-[0.7rem] font-medium text-muted-foreground">
            {item.ordem}. {item.exercicio.grupoMuscular}
          </span>
          <span className="font-medium">{item.exercicio.nome}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Detalhe icon={RepeatIcon} texto={`${item.series} x ${item.repeticoes}`} />
          {item.carga ? <Detalhe icon={WeightIcon} texto={exibirCarga(item.carga)} /> : null}
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
            className="flex w-fit items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            <VideoIcon className="size-3.5" />
            Ver demonstração
          </a>
        ) : null}
      </div>
    </article>
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
