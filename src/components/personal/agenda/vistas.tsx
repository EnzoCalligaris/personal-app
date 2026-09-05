"use client";

import {
  CalendarPlusIcon,
  CheckIcon,
  DumbbellIcon,
  LockIcon,
  LockOpenIcon,
  PlusIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { paraISO, hojeUTC } from "@/lib/date-utils";
import { diaSemanaLabel, formatarDataCalendario, iniciais } from "@/lib/format";
import { STATUS_AGENDAMENTO } from "@/lib/agenda/status";
import type { AgendaResponse, AgendamentoAgenda, DiaDaAgenda } from "@/types/agenda";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { AcoesAgenda } from "@/components/personal/agenda/agenda";

const ROTULOS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* -------------------------------------------------------------------------
   Cartão de agendamento (usado nas três vistas)
   ------------------------------------------------------------------------- */

/** Cor da borda por status - é o que identifica o agendamento de relance. */
const BORDA_STATUS: Record<AgendamentoAgenda["status"], string> = {
  CONFIRMADO: "border-l-primary",
  AGENDADO: "border-l-info",
  REAGENDADO: "border-l-warning",
  REALIZADO: "border-l-muted-foreground/40",
  CANCELADO: "border-l-destructive/50",
};

export function CartaoAgendamento({
  item,
  acoes,
  compacto = false,
}: {
  item: AgendamentoAgenda;
  acoes: AcoesAgenda;
  compacto?: boolean;
}) {
  const status = STATUS_AGENDAMENTO[item.status];
  const cancelado = item.status === "CANCELADO";

  // Na semana e no mês a coluna é estreita: cabe hora + primeiro nome, com a
  // cor da borda no lugar do rótulo de status.
  if (compacto) {
    return (
      <button
        type="button"
        onClick={() => acoes.aoAbrir(item)}
        title={`${item.horaInicio} às ${item.horaFim} · ${item.aluno.nome} · ${status.label}`}
        className={cn(
          "flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-l-4 px-1.5 py-1 text-left transition-colors outline-none",
          "focus-visible:ring-[3px] focus-visible:ring-ring/40",
          BORDA_STATUS[item.status],
          cancelado
            ? "border-y-transparent border-r-transparent bg-muted/40 line-through opacity-60"
            : "border-y-border border-r-border bg-card hover:bg-muted/60"
        )}
      >
        <span className="shrink-0 text-[0.7rem] font-semibold tabular-nums">
          {item.horaInicio}
        </span>
        <span className="truncate text-[0.7rem] text-muted-foreground">
          {item.aluno.nome.split(" ")[0]}
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-xl border p-3 transition-colors",
        cancelado
          ? "border-dashed border-border bg-muted/30 opacity-70"
          : item.status === "CONFIRMADO"
            ? "border-primary/30 bg-primary/[0.06] dark:bg-primary/12"
            : "border-border bg-card"
      )}
    >
      <button
        type="button"
        onClick={() => acoes.aoAbrir(item)}
        className="flex items-start gap-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-muted px-1.5 py-1">
          <span className="font-heading text-sm leading-none font-semibold tabular-nums">
            {item.horaInicio}
          </span>
          <span className="pt-0.5 text-[0.65rem] text-muted-foreground tabular-nums">
            {item.horaFim}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              {item.aluno.avatarUrl ? <AvatarImage src={item.aluno.avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-primary/15 text-[0.6rem] font-medium text-primary dark:bg-primary/20">
                {iniciais(item.aluno.nome)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium">{item.aluno.nome}</span>
          </div>

          {item.treino ? (
            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <DumbbellIcon className="size-3 shrink-0" aria-hidden="true" />
              {item.treino.nome}
            </span>
          ) : null}

          <Badge variant={status.variant} className="w-fit">
            {status.curto}
          </Badge>
        </div>
      </button>

      {!cancelado && item.status !== "REALIZADO" ? (
        <div className="flex flex-wrap gap-1.5">
          {item.status !== "CONFIRMADO" ? (
            <Button variant="outline" size="xs" onClick={() => acoes.aoConfirmar(item)}>
              <CheckIcon />
              Confirmar
            </Button>
          ) : null}
          <Button variant="outline" size="xs" onClick={() => acoes.aoRealizar(item)}>
            <CheckIcon />
            Concluído
          </Button>
          <Button variant="ghost" size="xs" onClick={() => acoes.aoReagendar(item)}>
            Reagendar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FaixaBloqueio({
  bloqueio,
  acoes,
}: {
  bloqueio: DiaDaAgenda["bloqueios"][number];
  acoes: AcoesAgenda;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-warning/50 bg-warning/[0.07] p-2.5 dark:bg-warning/12">
      <LockIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-medium">
          {bloqueio.diaInteiro
            ? "Dia bloqueado"
            : `${bloqueio.horaInicio} às ${bloqueio.horaFim} bloqueado`}
        </span>
        {bloqueio.motivo ? (
          <span className="truncate text-xs text-muted-foreground">{bloqueio.motivo}</span>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => acoes.aoLiberar(bloqueio.id)}
        title="Liberar este horário"
      >
        <LockOpenIcon />
        Liberar
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Vista de dia
   ------------------------------------------------------------------------- */

export function VistaDia({ dia, acoes }: { dia: DiaDaAgenda | undefined; acoes: AcoesAgenda }) {
  if (!dia) return null;

  const semTrabalho = dia.trabalho.length === 0;
  const vazio = dia.agendamentos.length === 0 && dia.bloqueios.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              {diaSemanaLabel(dia.diaSemana)}
              {dia.trabalho.length ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {dia.trabalho.map((faixa) => `${faixa.horaInicio}–${faixa.horaFim}`).join(" · ")}
                </span>
              ) : (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  sem horário de trabalho
                </span>
              )}
            </span>
            <Button size="xs" variant="outline" onClick={() => acoes.aoAgendar(dia.data)}>
              <PlusIcon />
              Agendar
            </Button>
          </div>

          {dia.bloqueios.length ? (
            <div className="flex flex-col gap-2">
              {dia.bloqueios.map((bloqueio) => (
                <FaixaBloqueio key={bloqueio.id} bloqueio={bloqueio} acoes={acoes} />
              ))}
            </div>
          ) : null}

          {vazio && semTrabalho ? (
            <EmptyState
              size="sm"
              icon={CalendarPlusIcon}
              title="Sem horário de trabalho neste dia"
              description="Configure seus horários de trabalho para o sistema gerar os atendimentos disponíveis."
            />
          ) : dia.agendamentos.length === 0 ? (
            <EmptyState
              size="sm"
              icon={CalendarPlusIcon}
              title="Nenhum atendimento marcado"
              description="Escolha um horário livre abaixo para marcar um atendimento."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {dia.agendamentos.map((item) => (
                <CartaoAgendamento key={item.id} item={item} acoes={acoes} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {dia.livres.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Horários livres</span>
              <span className="text-xs text-muted-foreground">
                {dia.livres.length} {dia.livres.length === 1 ? "horário" : "horários"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {dia.livres.map((slot) => (
                <button
                  key={slot.horaInicio}
                  type="button"
                  onClick={() => acoes.aoAgendar(dia.data, slot.horaInicio, slot.horaFim)}
                  className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-2 py-2.5 text-xs font-medium tabular-nums transition-colors outline-none hover:border-primary/50 hover:bg-primary/[0.06] focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  <span className="font-heading text-sm font-semibold">{slot.horaInicio}</span>
                  <span className="text-[0.65rem] text-muted-foreground">{slot.horaFim}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Vista de semana
   ------------------------------------------------------------------------- */

export function VistaSemana({ agenda, acoes }: { agenda: AgendaResponse; acoes: AcoesAgenda }) {
  const hoje = paraISO(hojeUTC());

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {agenda.dias.map((dia) => {
        const ehHoje = dia.data === hoje;
        const ativos = dia.agendamentos.filter((item) => item.status !== "CANCELADO");

        return (
          <section
            key={dia.data}
            aria-label={`${diaSemanaLabel(dia.diaSemana)}, ${formatarDataCalendario(dia.data)}`}
            className={cn(
              "flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-soft ring-1 transition-colors",
              ehHoje ? "ring-2 ring-primary" : "ring-border"
            )}
          >
            <button
              type="button"
              onClick={() => acoes.aoAbrirDia(dia.data)}
              className="flex items-center justify-between gap-2 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              <span className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">
                  {ROTULOS_SEMANA[new Date(`${dia.data}T12:00:00Z`).getUTCDay()]}
                </span>
                <span
                  className={cn(
                    "font-heading text-lg leading-none font-semibold tabular-nums",
                    ehHoje && "text-primary"
                  )}
                >
                  {dia.data.slice(8, 10)}
                </span>
              </span>

              {ativos.length ? (
                <Badge variant="secondary" className="tabular-nums">
                  {ativos.length}
                </Badge>
              ) : null}
            </button>

            <div className="flex flex-col gap-1.5">
              {dia.bloqueios.map((bloqueio) => (
                <span
                  key={bloqueio.id}
                  title={bloqueio.motivo ?? "Horário bloqueado"}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-warning/50 bg-warning/[0.07] px-2 py-1 text-[0.65rem] font-medium text-warning dark:bg-warning/12"
                >
                  <LockIcon className="size-3" />
                  {bloqueio.diaInteiro ? "Dia todo" : bloqueio.horaInicio}
                </span>
              ))}

              {dia.agendamentos.map((item) => (
                <CartaoAgendamento key={item.id} item={item} acoes={acoes} compacto />
              ))}

              {dia.agendamentos.length === 0 && dia.bloqueios.length === 0 ? (
                <span className="py-1 text-xs text-muted-foreground">
                  {dia.trabalho.length ? "Livre" : "Sem expediente"}
                </span>
              ) : null}
            </div>

            {dia.livres.length ? (
              <button
                type="button"
                onClick={() => acoes.aoAgendar(dia.data, dia.livres[0].horaInicio, dia.livres[0].horaFim)}
                className="mt-auto flex items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-[0.7rem] font-medium text-muted-foreground transition-colors outline-none hover:border-primary/50 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <PlusIcon className="size-3" />
                {dia.livres.length} {dia.livres.length === 1 ? "livre" : "livres"}
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Vista de mês
   ------------------------------------------------------------------------- */

export function VistaMes({ agenda, acoes }: { agenda: AgendaResponse; acoes: AcoesAgenda }) {
  const hoje = paraISO(hojeUTC());
  const mesDaReferencia = agenda.referencia.slice(0, 7);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
        {ROTULOS_SEMANA.map((rotulo) => (
          <span key={rotulo}>{rotulo}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {agenda.dias.map((dia) => {
          const doMes = dia.data.slice(0, 7) === mesDaReferencia;
          const ehHoje = dia.data === hoje;
          const ativos = dia.agendamentos.filter((item) => item.status !== "CANCELADO");
          const bloqueado = dia.bloqueios.some((bloqueio) => bloqueio.diaInteiro);

          return (
            <button
              key={dia.data}
              type="button"
              onClick={() => acoes.aoAbrirDia(dia.data)}
              title={`${formatarDataCalendario(dia.data)}: ${ativos.length} atendimento(s)`}
              className={cn(
                "flex min-h-20 flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors outline-none",
                "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                doMes ? "border-border bg-card hover:bg-muted/50" : "border-transparent bg-muted/30",
                bloqueado && "border-dashed border-warning/50 bg-warning/[0.06]",
                ehHoje && "ring-2 ring-primary"
              )}
            >
              <span className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    ehHoje ? "text-primary" : doMes ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {dia.data.slice(8, 10)}
                </span>
                {bloqueado ? <LockIcon className="size-3 text-warning" /> : null}
              </span>

              <span className="flex flex-col gap-0.5">
                {ativos.slice(0, 2).map((item) => (
                  <span
                    key={item.id}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[0.6rem] font-medium",
                      item.status === "CONFIRMADO"
                        ? "bg-primary/15 text-primary dark:bg-primary/20"
                        : item.status === "REALIZADO"
                          ? "bg-muted text-muted-foreground"
                          : "bg-info/12 text-info dark:bg-info/18"
                    )}
                  >
                    {item.horaInicio} {item.aluno.nome.split(" ")[0]}
                  </span>
                ))}
                {ativos.length > 2 ? (
                  <span className="px-1 text-[0.6rem] text-muted-foreground">
                    +{ativos.length - 2}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-primary/20" />
          Confirmado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-info/15" />
          A confirmar
        </span>
        <span className="flex items-center gap-1.5">
          <LockIcon className="size-3 text-warning" />
          Dia bloqueado
        </span>
      </div>
    </div>
  );
}
