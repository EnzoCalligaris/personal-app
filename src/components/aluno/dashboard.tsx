"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  DumbbellIcon,
  FlameIcon,
  ListChecksIcon,
  MessageSquareTextIcon,
  MoonIcon,
  PlayIcon,
  TrendingUpIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import {
  diaSemanaLabel,
  formatarDataCalendario,
  formatarDataRelativa,
  formatarDiaPorExtenso,
  formatarIntervaloHorario,
  formatarVariacao,
  iniciais,
} from "@/lib/format";
import { formatarDuracao } from "@/lib/treinos/duracao";
import type { AlunoDashboardResponse, DiaDeTreino, MeuFeedback } from "@/types/aluno-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Skeleton } from "@/components/ui/skeleton";

export function AlunoDashboard({ primeiroNome }: { primeiroNome: string }) {
  const { data, loading, error, refetch } = useApi<AlunoDashboardResponse>("/api/aluno/dashboard");

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <Saudacao nome={primeiroNome} />
        <ErrorState
          title="Não foi possível carregar seu dia"
          description="Tivemos um problema ao buscar seus treinos. Tente novamente."
          detail={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Saudacao nome={primeiroNome} />
        <Skeleton className="h-56 rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Saudacao nome={data.aluno.primeiroNome} data={data.hoje.data} />

      <TreinoDeHoje dia={data.hoje} />

      <Resumo resumo={data.resumo} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ProximoTreino dia={data.proximo} />
        <Evolucao evolucao={data.evolucao} />
        <UltimoFeedback feedback={data.ultimoFeedback} />
      </div>
    </div>
  );
}

function Saudacao({ nome, data }: { nome: string; data?: string }) {
  return (
    <header className="flex animate-fade-up flex-col gap-1">
      <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
        Olá, {nome} <span aria-hidden="true">👋</span>
      </h1>
      {data ? (
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {formatarDiaPorExtenso(data)}
        </p>
      ) : null}
    </header>
  );
}

/* -------------------------------------------------------------------------
   Treino de hoje - o card principal da tela
   ------------------------------------------------------------------------- */

function TreinoDeHoje({ dia }: { dia: DiaDeTreino }) {
  if (dia.tipo !== "TREINO" || !dia.treino) {
    return (
      <Card className="animate-fade-up">
        <CardHeader className="border-b">
          <CardTitle>Treino de hoje</CardTitle>
          <CardDescription>{diaSemanaLabel(dia.diaSemana)}</CardDescription>
        </CardHeader>
        <CardContent>
          {dia.tipo === "DESCANSO" ? (
            <EmptyState
              size="sm"
              icon={MoonIcon}
              title="Hoje é dia de descanso"
              description="Sua programação não tem treino para hoje. Aproveite para se recuperar - o próximo treino já está logo abaixo."
              action={
                <Button size="sm" variant="outline" render={<Link href="/aluno/treinos" />}>
                  Ver minhas fichas
                </Button>
              }
            />
          ) : (
            <EmptyState
              size="sm"
              icon={DumbbellIcon}
              title="Nenhum treino programado"
              description="Seu Personal ainda não montou a programação para esta data. Assim que montar, o treino do dia aparece aqui."
              action={
                <Button size="sm" variant="outline" render={<Link href="/aluno/treinos" />}>
                  Ver minhas fichas
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    );
  }

  const { treino } = dia;

  return (
    <section
      aria-label="Treino de hoje"
      className="relative animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-primary/18 via-primary/10 to-card p-5 shadow-soft ring-1 ring-primary/25 sm:p-6 dark:from-primary/22 dark:via-primary/12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-12 size-48 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">Treino de hoje</Badge>
          <span className="text-xs font-medium text-muted-foreground">
            {diaSemanaLabel(dia.diaSemana)}
          </span>
          {dia.executado ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2Icon className="size-3.5" />
              Concluído
            </Badge>
          ) : null}
          {treino.ativo ? null : <Badge variant="warning">Ficha arquivada</Badge>}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {treino.nome}
          </h2>
          {treino.grupos.length ? (
            <p className="text-sm text-muted-foreground">{treino.grupos.join(" · ")}</p>
          ) : null}
        </div>

        <dl className="flex flex-wrap gap-2">
          <Metrica
            icon={ListChecksIcon}
            valor={String(treino.totalExercicios)}
            rotulo={treino.totalExercicios === 1 ? "exercício" : "exercícios"}
          />
          <Metrica
            icon={ClockIcon}
            valor={formatarDuracao(treino.duracaoMin)}
            rotulo="duração estimada"
          />
          {dia.agendamento ? (
            <Metrica
              icon={CalendarDaysIcon}
              valor={formatarIntervaloHorario(dia.agendamento.horaInicio, dia.agendamento.horaFim)}
              rotulo="com seu Personal"
            />
          ) : null}
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button size="lg" render={<Link href={`/aluno/treinos/${treino.id}`} />}>
            <PlayIcon />
            {dia.executado ? "Treinar de novo" : "Começar treino"}
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/aluno/treinos" />}>
            Minhas fichas
          </Button>
        </div>
      </div>
    </section>
  );
}

function Metrica({
  icon: Icon,
  valor,
  rotulo,
}: {
  icon: typeof ClockIcon;
  valor: string;
  rotulo: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-card/70 px-3 py-2 ring-1 ring-border/70 backdrop-blur-sm">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <div className="flex flex-col leading-tight">
        <dt className="sr-only">{rotulo}</dt>
        <dd className="font-heading text-sm font-semibold tabular-nums">{valor}</dd>
        <span className="text-[0.7rem] text-muted-foreground">{rotulo}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Faixa de indicadores
   ------------------------------------------------------------------------- */

function Resumo({ resumo }: { resumo: AlunoDashboardResponse["resumo"] }) {
  const itens = [
    {
      icon: FlameIcon,
      valor: resumo.sequencia,
      rotulo: resumo.sequencia === 1 ? "treino seguido" : "treinos seguidos",
      tom: "text-chart-4",
    },
    {
      icon: DumbbellIcon,
      valor: `${resumo.concluidosNaSemana}/${resumo.treinosNaSemana}`,
      rotulo: "na semana",
      tom: "text-primary",
    },
    {
      icon: CheckCircle2Icon,
      valor: resumo.totalExecucoes,
      rotulo: "treinos no total",
      tom: "text-chart-3",
    },
  ];

  return (
    <section
      aria-label="Seus números"
      className="grid grid-cols-3 gap-2 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border sm:gap-3 sm:p-4"
    >
      {itens.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.rotulo} className="flex flex-col items-center gap-1 text-center">
            <Icon className={cn("size-4", item.tom)} aria-hidden="true" />
            <span className="font-heading text-xl leading-none font-semibold tabular-nums sm:text-2xl">
              {item.valor}
            </span>
            <span className="text-[0.7rem] leading-tight text-muted-foreground">{item.rotulo}</span>
          </div>
        );
      })}
    </section>
  );
}

/* -------------------------------------------------------------------------
   Próximo treino, evolução e feedback
   ------------------------------------------------------------------------- */

function ProximoTreino({ dia }: { dia: DiaDeTreino | null }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Próximo treino</CardTitle>
        <CardDescription>Quando é o próximo compromisso com a sua rotina.</CardDescription>
      </CardHeader>
      <CardContent>
        {!dia || !dia.treino ? (
          <EmptyState
            size="sm"
            icon={CalendarDaysIcon}
            title="Nada programado à frente"
            description="Não há treino previsto para os próximos dias."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/12 text-primary dark:bg-primary/18">
                <span className="font-heading text-lg leading-none font-semibold tabular-nums">
                  {dia.data.slice(8, 10)}
                </span>
                <span className="text-[0.65rem] uppercase">
                  {formatarDataCalendario(dia.data).split(" ").at(-1)}
                </span>
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{diaSemanaLabel(dia.diaSemana)}</span>
                <span className="truncate text-sm text-muted-foreground">{dia.treino.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {dia.agendamento
                    ? formatarIntervaloHorario(dia.agendamento.horaInicio, dia.agendamento.horaFim)
                    : "Sem horário marcado"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">
                {dia.treino.totalExercicios}{" "}
                {dia.treino.totalExercicios === 1 ? "exercício" : "exercícios"}
              </Badge>
              <Badge variant="outline">{formatarDuracao(dia.treino.duracaoMin)}</Badge>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              render={<Link href="/aluno/agenda" />}
            >
              Ver agenda
              <ArrowRightIcon />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Evolucao({ evolucao }: { evolucao: AlunoDashboardResponse["evolucao"] }) {
  const { ultima } = evolucao;

  const metricas = [
    { rotulo: "Peso", dado: evolucao.peso, unidade: "kg", menorMelhor: true },
    { rotulo: "Gordura", dado: evolucao.percentualGordura, unidade: "%", menorMelhor: true },
    { rotulo: "Massa magra", dado: evolucao.massaMagra, unidade: "kg", menorMelhor: false },
    { rotulo: "IMC", dado: evolucao.imc, unidade: "", menorMelhor: true },
  ].filter((item) => item.dado !== null);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Evolução</CardTitle>
        <CardDescription>
          {ultima
            ? `Última avaliação ${formatarDataRelativa(ultima.data)}`
            : "Sua composição corporal ao longo do tempo."}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/aluno/evolucao" />}>
            Ver tudo
            <ArrowRightIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {metricas.length === 0 ? (
          <EmptyState
            size="sm"
            icon={TrendingUpIcon}
            title="Nenhuma avaliação ainda"
            description="Depois da sua primeira bioimpedância, os números e a evolução aparecem aqui."
          />
        ) : (
          <dl className="grid grid-cols-2 gap-3">
            {metricas.map((item) => (
              <div key={item.rotulo} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{item.rotulo}</dt>
                <dd className="font-heading text-lg leading-none font-semibold tabular-nums">
                  {item.dado!.atual.toLocaleString("pt-BR")}
                  {item.unidade ? (
                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                      {item.unidade}
                    </span>
                  ) : null}
                </dd>
                {item.dado!.variacao !== null ? (
                  <span
                    className={cn(
                      "text-[0.7rem] font-medium tabular-nums",
                      item.dado!.variacao === 0
                        ? "text-muted-foreground"
                        : item.dado!.variacao < 0 === item.menorMelhor
                          ? "text-success"
                          : "text-warning"
                    )}
                  >
                    {formatarVariacao(item.dado!.variacao)} desde a anterior
                  </span>
                ) : (
                  <span className="text-[0.7rem] text-muted-foreground">primeira medição</span>
                )}
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function UltimoFeedback({ feedback }: { feedback: MeuFeedback | null }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Último feedback</CardTitle>
        <CardDescription>O que seu Personal comentou por último.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/aluno/feedback" />}>
            Ver tudo
            <ArrowRightIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!feedback ? (
          <EmptyState
            size="sm"
            icon={MessageSquareTextIcon}
            title="Nenhum feedback ainda"
            description="Quando seu Personal comentar seus treinos ou avaliações, o recado aparece aqui."
          />
        ) : (
          <figure className="flex flex-col gap-3">
            <blockquote className="text-sm leading-relaxed text-pretty">
              “{feedback.texto}”
            </blockquote>
            <figcaption className="flex items-center gap-2">
              <Avatar size="sm">
                {feedback.personal?.avatarUrl ? (
                  <AvatarImage src={feedback.personal.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary dark:bg-primary/20">
                  {iniciais(feedback.personal?.nome ?? "PT")}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium">
                  {feedback.personal?.nome ?? "Seu Personal"}
                </span>
                <span className="text-[0.7rem] text-muted-foreground">
                  {formatarDataRelativa(feedback.criadoEm)}
                </span>
              </div>
            </figcaption>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}
