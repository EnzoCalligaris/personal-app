"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  CalendarX2Icon,
  ClockIcon,
  InfoIcon,
  XIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import {
  formatarDataRelativa,
  formatarDiaPorExtenso,
  formatarIntervaloHorario,
  iniciais,
} from "@/lib/format";
import { STATUS_AGENDAMENTO } from "@/lib/agenda/status";
import { toast } from "@/lib/toast";
import type { MeuAgendamento, MinhaAgendaResponse } from "@/types/aluno-area";
import type { HorariosParaAgendarResponse } from "@/types/aluno-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalClose } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonList } from "@/components/ui/loading";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function MinhaAgenda() {
  const [versao, setVersao] = React.useState(0);
  const { data, loading, error, refetch } = useApi<MinhaAgendaResponse>(
    `/api/aluno/agenda?v=${versao}`
  );

  const [cancelando, setCancelando] = React.useState<MeuAgendamento | null>(null);
  const [reagendando, setReagendando] = React.useState<MeuAgendamento | null>(null);

  function atualizar() {
    setVersao((valor) => valor + 1);
  }

  const proximo = data?.proximos.find((item) => item.status !== "CANCELADO") ?? null;
  const demais = data?.proximos.filter((item) => item.id !== proximo?.id) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Atendimentos"
        title="Minha agenda"
        description="Seus horários com o Personal - os que ainda vão acontecer e os que já passaram."
        actions={
          <Button render={<Link href="/aluno/agenda/agendar" />}>
            <CalendarPlusIcon />
            Agendar treino
          </Button>
        }
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
                    cancelamento e reagendamento com {data.regras.cancelamentoMinHoras}h de
                    antecedência
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <ProximoTreino
            agendamento={proximo}
            onCancelar={setCancelando}
            onReagendar={setReagendando}
          />

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Próximos horários</CardTitle>
              <CardDescription>Compromissos marcados daqui para frente.</CardDescription>
            </CardHeader>
            <CardContent>
              {demais.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={CalendarDaysIcon}
                  title={proximo ? "Nenhum outro horário marcado" : "Nenhum horário marcado"}
                  description="Marque seu próximo treino em poucos toques."
                  action={
                    <Button size="sm" render={<Link href="/aluno/agenda/agendar" />}>
                      <CalendarPlusIcon />
                      Agendar treino
                    </Button>
                  }
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {demais.map((item) => (
                    <ItemAgendamento
                      key={item.id}
                      item={item}
                      destaque
                      onCancelar={setCancelando}
                      onReagendar={setReagendando}
                    />
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

      <CancelamentoModal
        agendamento={cancelando}
        onOpenChange={(aberto) => !aberto && setCancelando(null)}
        onCancelado={() => {
          setCancelando(null);
          atualizar();
        }}
      />

      <ReagendamentoModal
        agendamento={reagendando}
        onOpenChange={(aberto) => !aberto && setReagendando(null)}
        onReagendado={() => {
          setReagendando(null);
          atualizar();
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
   Próximo treino
   ------------------------------------------------------------------------- */

function ProximoTreino({
  agendamento,
  onCancelar,
  onReagendar,
}: {
  agendamento: MeuAgendamento | null;
  onCancelar: (item: MeuAgendamento) => void;
  onReagendar: (item: MeuAgendamento) => void;
}) {
  if (!agendamento) return null;

  const status = STATUS_AGENDAMENTO[agendamento.status];
  const dataISO = agendamento.data.slice(0, 10);

  return (
    <section
      aria-label="Próximo treino"
      className="relative animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-primary/18 via-primary/10 to-card p-5 shadow-soft ring-1 ring-primary/25 dark:from-primary/22 dark:via-primary/12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-12 size-48 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">Próximo treino</Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-card text-primary shadow-soft">
            <span className="font-heading text-xl leading-none font-semibold tabular-nums">
              {dataISO.slice(8, 10)}
            </span>
            <span className="pt-0.5 text-[0.6rem] uppercase">
              {new Intl.DateTimeFormat("pt-BR", { month: "short" })
                .format(new Date(`${dataISO}T12:00:00Z`))
                .replace(".", "")}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-heading text-lg leading-tight font-semibold first-letter:uppercase">
              {formatarDiaPorExtenso(dataISO)}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
              <ClockIcon className="size-4" aria-hidden="true" />
              {formatarIntervaloHorario(agendamento.horaInicio, agendamento.horaFim)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatarDataRelativa(agendamento.data)}
            </span>
          </div>
        </div>

        {agendamento.observacoes ? (
          <p className="rounded-xl bg-card/70 p-3 text-sm leading-relaxed backdrop-blur-sm">
            {agendamento.observacoes}
          </p>
        ) : null}

        {agendamento.podeDesmarcar ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onReagendar(agendamento)}>
              <ClockIcon />
              Reagendar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onCancelar(agendamento)}>
              <XIcon />
              Cancelar
            </Button>
          </div>
        ) : (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            O prazo para cancelar ou reagendar sozinho já passou. Fale com seu Personal.
          </p>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   Lista
   ------------------------------------------------------------------------- */

function ItemAgendamento({
  item,
  destaque,
  onCancelar,
  onReagendar,
}: {
  item: MeuAgendamento;
  destaque?: boolean;
  onCancelar?: (item: MeuAgendamento) => void;
  onReagendar?: (item: MeuAgendamento) => void;
}) {
  const status = STATUS_AGENDAMENTO[item.status];
  const cancelado = item.status === "CANCELADO";

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3 transition-colors",
        destaque && !cancelado ? "border-border bg-card" : "border-transparent bg-muted/40",
        cancelado && "opacity-70"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-primary/10 px-2 py-1.5 text-primary dark:bg-primary/16">
          <span className="font-heading text-sm leading-none font-semibold tabular-nums">
            {item.horaInicio}
          </span>
          <span className="pt-0.5 text-[0.65rem] text-muted-foreground tabular-nums">
            {item.horaFim}
          </span>
        </div>

        <div className="flex min-w-40 flex-1 flex-col">
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
          {status.curto}
        </Badge>
      </div>

      {item.podeDesmarcar && onCancelar && onReagendar ? (
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="xs" onClick={() => onReagendar(item)}>
            Reagendar
          </Button>
          <Button variant="ghost" size="xs" onClick={() => onCancelar(item)}>
            Cancelar
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------------------
   Cancelar e reagendar
   ------------------------------------------------------------------------- */

function CancelamentoModal({
  agendamento,
  onOpenChange,
  onCancelado,
}: {
  agendamento: MeuAgendamento | null;
  onOpenChange: (aberto: boolean) => void;
  onCancelado: () => void;
}) {
  const [salvando, setSalvando] = React.useState(false);

  if (!agendamento) return null;

  async function cancelar() {
    setSalvando(true);
    try {
      const res = await fetch(`/api/aluno/agendamentos/${agendamento!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELADO" }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível cancelar.");
        return;
      }

      toast.success("Atendimento cancelado.");
      onCancelado();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title="Cancelar atendimento?"
      description={`${formatarDiaPorExtenso(agendamento.data.slice(0, 10))} · ${agendamento.horaInicio} às ${agendamento.horaFim}`}
      footer={
        <>
          <ModalClose render={<Button variant="ghost">Manter horário</Button>} />
          <Button variant="destructive" onClick={cancelar} disabled={salvando}>
            {salvando ? <Spinner /> : <XIcon />}
            Cancelar atendimento
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        O horário volta a ficar livre para outros alunos. Se quiser apenas mudar o dia, use
        &quot;Reagendar&quot;.
      </p>
    </Modal>
  );
}

function ReagendamentoModal({
  agendamento,
  onOpenChange,
  onReagendado,
}: {
  agendamento: MeuAgendamento | null;
  onOpenChange: (aberto: boolean) => void;
  onReagendado: () => void;
}) {
  const [data, setData] = React.useState("");
  const [slot, setSlot] = React.useState<{ horaInicio: string; horaFim: string } | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  // Trocar de agendamento recomeça a escolha.
  const [contexto, setContexto] = React.useState("");
  if (agendamento && contexto !== agendamento.id) {
    setContexto(agendamento.id);
    setData(agendamento.data.slice(0, 10));
    setSlot(null);
  }

  const { data: horarios, loading } = useApi<HorariosParaAgendarResponse>(
    agendamento && data ? `/api/aluno/agenda/horarios?data=${data}` : null
  );

  if (!agendamento) return null;

  async function reagendar() {
    if (!slot) return;

    setSalvando(true);
    try {
      const res = await fetch(`/api/aluno/agendamentos/${agendamento!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, horaInicio: slot.horaInicio, horaFim: slot.horaFim }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível reagendar.");
        return;
      }

      toast.success("Horário remarcado.");
      onReagendado();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title="Reagendar treino"
      description="Escolha o novo dia e horário entre os disponíveis."
      footer={
        <>
          <ModalClose render={<Button variant="ghost">Voltar</Button>} />
          <Button onClick={reagendar} disabled={salvando || !slot}>
            {salvando ? <Spinner /> : <ClockIcon />}
            Reagendar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          Horário atual: {formatarDiaPorExtenso(agendamento.data.slice(0, 10))} ·{" "}
          {agendamento.horaInicio}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reagendar-data">Nova data</Label>
          <Input
            id="reagendar-data"
            type="date"
            value={data}
            onChange={(evento) => {
              setData(evento.target.value);
              setSlot(null);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Horário</Label>
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, indice) => (
                <Skeleton key={indice} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : !horarios || horarios.livres.length === 0 ? (
            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              {horarios?.mensagem ?? "Nenhum horário disponível neste dia."}
            </p>
          ) : (
            <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {horarios.livres.map((opcao) => (
                <button
                  key={opcao.horaInicio}
                  type="button"
                  onClick={() => setSlot(opcao)}
                  aria-pressed={slot?.horaInicio === opcao.horaInicio}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium tabular-nums transition-colors outline-none",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                    slot?.horaInicio === opcao.horaInicio
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-foreground/20"
                  )}
                >
                  {opcao.horaInicio}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
