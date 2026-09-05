"use client";

import { CalendarDaysIcon, CalendarX2Icon, ClockIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import {
  formatarDataRelativa,
  formatarDiaPorExtenso,
  formatarIntervaloHorario,
  iniciais,
} from "@/lib/format";
import type { StatusAgendamento } from "@/types";
import type { MeuAgendamento, MinhaAgendaResponse } from "@/types/aluno-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonList } from "@/components/ui/loading";

const STATUS: Record<
  StatusAgendamento,
  { label: string; variant: "info" | "warning" | "success" | "destructive" }
> = {
  AGENDADO: { label: "Agendado", variant: "info" },
  REAGENDADO: { label: "Reagendado", variant: "warning" },
  REALIZADO: { label: "Realizado", variant: "success" },
  CANCELADO: { label: "Cancelado", variant: "destructive" },
};

export function MinhaAgenda() {
  const { data, loading, error, refetch } = useApi<MinhaAgendaResponse>("/api/aluno/agenda");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Atendimentos"
        title="Agenda"
        description="Seus horários com o Personal - os que ainda vão acontecer e os que já passaram."
      />

      {error ? (
        <ErrorState title="Não foi possível carregar sua agenda" detail={error} onRetry={refetch} />
      ) : loading || !data ? (
        <SkeletonList items={3} />
      ) : (
        <>
          {data.personal ? (
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <Avatar>
                  {data.personal.avatarUrl ? (
                    <AvatarImage src={data.personal.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary dark:bg-primary/20">
                    {iniciais(data.personal.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{data.personal.nome}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    seu Personal Trainer
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Próximos horários</CardTitle>
              <CardDescription>Compromissos marcados daqui para frente.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.proximos.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={CalendarDaysIcon}
                  title="Nenhum horário marcado"
                  description="Quando seu Personal agendar um atendimento, ele aparece aqui com data, horário e status."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.proximos.map((item) => (
                    <ItemAgendamento key={item.id} item={item} destaque />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Histórico</CardTitle>
              <CardDescription>Atendimentos anteriores.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.anteriores.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={CalendarX2Icon}
                  title="Nada por aqui ainda"
                  description="Seus atendimentos passados ficarão registrados nesta lista."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.anteriores.map((item) => (
                    <ItemAgendamento key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ItemAgendamento({ item, destaque }: { item: MeuAgendamento; destaque?: boolean }) {
  const status = STATUS[item.status];
  const cancelado = item.status === "CANCELADO";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-colors",
        destaque && !cancelado ? "border-border bg-card" : "border-transparent bg-muted/40",
        cancelado && "opacity-70"
      )}
    >
      <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-primary/10 px-2 py-1.5 text-primary dark:bg-primary/16">
        <span className="font-heading text-sm leading-none font-semibold tabular-nums">
          {item.horaInicio}
        </span>
        <span className="pt-0.5 text-[0.65rem] text-muted-foreground tabular-nums">
          {item.horaFim}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium first-letter:uppercase">
          {formatarDiaPorExtenso(item.data.slice(0, 10))}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ClockIcon className="size-3" aria-hidden="true" />
          {formatarIntervaloHorario(item.horaInicio, item.horaFim)} ·{" "}
          {formatarDataRelativa(item.data)}
        </span>
        {item.observacoes ? (
          <span className="truncate text-xs text-muted-foreground">{item.observacoes}</span>
        ) : null}
      </div>

      <Badge variant={status.variant} className="shrink-0">
        {status.label}
      </Badge>
    </li>
  );
}
