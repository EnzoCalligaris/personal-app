"use client";

import Link from "next/link";
import {
  ActivityIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  ClipboardPlusIcon,
  ClockIcon,
  DumbbellIcon,
  UserPlusIcon,
  UsersRoundIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { diaSemanaLabel, formatarData, formatarDataRelativa, iniciais } from "@/lib/format";
import type { StatusAgendamento } from "@/types";
import type {
  DashboardAgendamento,
  DashboardAluno,
  DashboardAvaliacao,
  DashboardData,
} from "@/types/dashboard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";

const STATUS_BADGE: Record<
  StatusAgendamento,
  { label: string; variant: "info" | "warning" | "success" | "destructive" }
> = {
  AGENDADO: { label: "Agendado", variant: "info" },
  REAGENDADO: { label: "Reagendado", variant: "warning" },
  REALIZADO: { label: "Realizado", variant: "success" },
  CANCELADO: { label: "Cancelado", variant: "destructive" },
};

const ACOES_RAPIDAS = [
  { label: "Novo aluno", href: "/personal/alunos", icon: UserPlusIcon },
  { label: "Novo treino", href: "/personal/treinos", icon: DumbbellIcon },
  { label: "Nova avaliação", href: "/personal/avaliacoes", icon: ClipboardPlusIcon },
  { label: "Ver agenda", href: "/personal/agenda", icon: CalendarPlusIcon },
];

export function PersonalDashboard({ primeiroNome }: { primeiroNome: string }) {
  const { data, loading, error, refetch } = useApi<DashboardData>("/api/personal/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Visão geral"
        title={`Olá, ${primeiroNome}`}
        description="Acompanhe seus alunos e o que está acontecendo hoje."
      />

      <AcoesRapidas />

      {loading ? <DashboardSkeleton /> : null}

      {error && !loading ? (
        <ErrorState
          title="Não foi possível carregar o dashboard"
          description="Houve um problema ao buscar seus dados. Verifique sua conexão e tente novamente."
          detail={error}
          onRetry={refetch}
        />
      ) : null}

      {data && !loading ? (
        <>
          <Resumo data={data} />
          <div className="grid gap-4 lg:grid-cols-3">
            <AgendaDoDia data={data} className="lg:col-span-2" />
            <ProximosAgendamentos itens={data.proximosAgendamentos} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <AlunosRecentes alunos={data.alunosRecentes} className="lg:col-span-2" />
            <AvaliacoesRecentes avaliacoes={data.avaliacoesRecentes} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function AcoesRapidas() {
  return (
    <section aria-label="Ações rápidas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ACOES_RAPIDAS.map((acao) => (
        <Link
          key={acao.href}
          href={acao.href}
          className={cn(
            "group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-sm font-medium shadow-soft transition-all duration-200 outline-none",
            "hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-raised",
            "focus-visible:ring-[3px] focus-visible:ring-ring/40 active:translate-y-0 active:scale-[0.98]"
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground dark:bg-primary/18">
            <acao.icon className="size-4.5" />
          </span>
          <span className="min-w-0 leading-tight text-balance">{acao.label}</span>
        </Link>
      ))}
    </section>
  );
}

function Resumo({ data }: { data: DashboardData }) {
  const { resumo } = data;

  return (
    <section aria-label="Resumo" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Total de alunos" value={resumo.totalAlunos} icon={UsersRoundIcon} />
        <StatCard
          label="Alunos ativos"
          value={resumo.alunosAtivos}
          icon={ActivityIcon}
          tone="violet"
        />
        <StatCard label="Treinos de hoje" value={resumo.treinosDoDia} icon={DumbbellIcon} tone="cyan" />
        <StatCard
          label="Próximos agendamentos"
          value={resumo.proximosAgendamentos}
          icon={CalendarDaysIcon}
          tone="amber"
        />
        <StatCard
          label="Avaliações recentes"
          value={resumo.avaliacoesRecentes}
          icon={ClipboardPlusIcon}
          tone="neutral"
          className="col-span-2 lg:col-span-1"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Alunos ativos = treino ativo ou atividade nos últimos 30 dias · treinos de hoje = programados
        para {diaSemanaLabel(data.hoje.diaSemana).toLowerCase()} · próximos agendamentos incluem os
        de hoje que ainda vão acontecer.
      </p>
    </section>
  );
}

function ItemAgendamento({ item }: { item: DashboardAgendamento }) {
  const status = STATUS_BADGE[item.status];

  return (
    <li className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 transition-colors hover:border-border hover:bg-muted/50">
      <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-muted px-2 py-1.5">
        <span className="font-heading text-sm font-semibold tabular-nums">{item.horaInicio}</span>
        <span className="text-[0.65rem] text-muted-foreground tabular-nums">{item.horaFim}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{item.aluno.nome}</span>
        <span className="truncate text-xs text-muted-foreground">
          {item.treino ? item.treino.nome : "Sem treino programado para o dia"}
        </span>
      </div>

      <Badge variant={status.variant} className="shrink-0">
        {status.label}
      </Badge>
    </li>
  );
}

function AgendaDoDia({ data, className }: { data: DashboardData; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle>Agenda de hoje</CardTitle>
        <CardDescription>
          {diaSemanaLabel(data.hoje.diaSemana)}, {formatarData(data.hoje.data)}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/personal/agenda" />}>
            Ver agenda
            <ArrowRightIcon />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {data.agendaDoDia.length === 0 ? (
          <EmptyState
            size="sm"
            icon={CalendarDaysIcon}
            title="Nenhum atendimento hoje"
            description="Quando um aluno agendar um horário para hoje, ele aparece aqui com status e treino do dia."
            action={
              <Button size="sm" variant="outline" render={<Link href="/personal/agenda" />}>
                Definir horários
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {data.agendaDoDia.map((item) => (
              <ItemAgendamento key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ProximosAgendamentos({ itens }: { itens: DashboardAgendamento[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Próximos dias</CardTitle>
        <CardDescription>Agendamentos a partir de amanhã.</CardDescription>
      </CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <EmptyState
            size="sm"
            icon={ClockIcon}
            title="Nada agendado à frente"
            description="Os próximos horários confirmados aparecerão aqui."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {itens.slice(0, 5).map((item) => {
              const status = STATUS_BADGE[item.status];
              return (
                <li key={item.id} className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatarData(item.data)}
                    </span>
                    <span className="font-heading text-sm font-semibold tabular-nums">
                      {item.horaInicio}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{item.aluno.nome}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.treino?.nome ?? "Sem treino programado"}
                    </span>
                  </div>
                  <Badge variant={status.variant} className="shrink-0">
                    {status.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AlunosRecentes({ alunos, className }: { alunos: DashboardAluno[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle>Alunos recentes</CardTitle>
        <CardDescription>Últimos alunos vinculados a você.</CardDescription>
        {alunos.length > 0 ? (
          <CardAction>
            <Button variant="ghost" size="sm" render={<Link href="/personal/alunos" />}>
              Ver todos
              <ArrowRightIcon />
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {alunos.length === 0 ? (
          <EmptyState
            size="sm"
            icon={UsersRoundIcon}
            title="Nenhum aluno vinculado ainda"
            description="Cadastre seu primeiro aluno para começar a montar treinos e acompanhar a evolução."
            action={
              <Button size="sm" render={<Link href="/personal/alunos" />}>
                <UserPlusIcon />
                Cadastrar aluno
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {alunos.map((aluno) => (
              <li
                key={aluno.id}
                className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 transition-colors hover:border-border hover:bg-muted/50"
              >
                <Avatar>
                  <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary dark:bg-primary/20">
                    {iniciais(aluno.nome)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{aluno.nome}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {aluno.proximoTreino
                      ? `${aluno.proximoTreino.nome} · ${diaSemanaLabel(aluno.proximoTreino.diaSemana)}`
                      : "Sem treino cadastrado"}
                  </span>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={aluno.ativo ? "success" : "secondary"}>
                    {aluno.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <span className="hidden text-[0.7rem] text-muted-foreground sm:block">
                    {aluno.ultimaExecucao
                      ? `Treinou ${formatarDataRelativa(aluno.ultimaExecucao)}`
                      : `Entrou ${formatarDataRelativa(aluno.criadoEm)}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AvaliacoesRecentes({ avaliacoes }: { avaliacoes: DashboardAvaliacao[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Avaliações recentes</CardTitle>
        <CardDescription>Últimas bioimpedâncias registradas.</CardDescription>
      </CardHeader>
      <CardContent>
        {avaliacoes.length === 0 ? (
          <EmptyState
            size="sm"
            icon={ClipboardPlusIcon}
            title="Nenhuma avaliação registrada"
            description="Registre a primeira avaliação para acompanhar a evolução dos seus alunos."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {avaliacoes.map((avaliacao) => (
              <li key={avaliacao.id} className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{avaliacao.aluno.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatarDataRelativa(avaliacao.data)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  {avaliacao.peso !== null ? (
                    <span className="font-heading text-sm font-semibold tabular-nums">
                      {avaliacao.peso.toLocaleString("pt-BR")} kg
                    </span>
                  ) : null}
                  {avaliacao.percentualGordura !== null ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {avaliacao.percentualGordura.toLocaleString("pt-BR")}% gordura
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando dashboard">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn("h-28 rounded-2xl", index === 4 && "col-span-2 lg:col-span-1")}
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
