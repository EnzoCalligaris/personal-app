"use client";

import * as React from "react";
import {
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  DumbbellIcon,
  LockIcon,
  XIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatarDiaPorExtenso, iniciais } from "@/lib/format";
import { STATUS_AGENDAMENTO } from "@/lib/agenda/status";
import { toast } from "@/lib/toast";
import type {
  AgendamentoAgenda,
  HorariosLivresResponse,
  SlotLivre,
} from "@/types/agenda";
import type { AlunoListResponse } from "@/types/aluno";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalClose } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  HorariosDeTrabalhoEditor,
  RegrasDaAgendaEditor,
} from "@/components/personal/agenda/configuracoes";


const SEM_HORARIO: Record<HorariosLivresResponse["motivo"], string> = {
  OK: "",
  SEM_TRABALHO: "Você não trabalha neste dia. Ajuste seus horários de trabalho para liberar atendimentos.",
  BLOQUEADO: "O dia inteiro está bloqueado na sua agenda.",
  LOTADO: "Todos os horários deste dia já estão ocupados.",
};

/* -------------------------------------------------------------------------
   Novo agendamento e reagendamento
   ------------------------------------------------------------------------- */

export function AgendamentoModal({
  open,
  onOpenChange,
  agendamento,
  dataInicial,
  horarioInicial,
  onSalvo,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  /** Presente = reagendamento. */
  agendamento: AgendamentoAgenda | null;
  dataInicial: string;
  horarioInicial: SlotLivre | null;
  onSalvo: () => void;
}) {
  const reagendando = agendamento !== null;

  const [alunoId, setAlunoId] = React.useState("");
  const [data, setData] = React.useState(dataInicial);
  const [slot, setSlot] = React.useState<SlotLivre | null>(horarioInicial);
  const [observacoes, setObservacoes] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  // Reabrir o modal em outro contexto precisa recomeçar dos valores novos.
  const [contexto, setContexto] = React.useState("");
  const contextoAtual = `${open}:${agendamento?.id ?? "novo"}:${dataInicial}:${horarioInicial?.horaInicio ?? ""}`;
  if (open && contexto !== contextoAtual) {
    setContexto(contextoAtual);
    setAlunoId(agendamento?.aluno.id ?? "");
    setData(dataInicial);
    setSlot(horarioInicial);
    setObservacoes(agendamento?.observacoes ?? "");
  }

  const { data: alunosData } = useApi<AlunoListResponse>(
    open && !reagendando ? "/api/personal/alunos?status=ATIVO" : null
  );
  const { data: horarios, loading: carregandoHorarios } = useApi<HorariosLivresResponse>(
    open ? `/api/personal/agenda/horarios?data=${data}` : null
  );

  const alunos = alunosData?.alunos ?? [];
  const nomeDoAluno = alunos.find((aluno) => aluno.id === alunoId)?.nome;

  // No reagendamento o horário atual também é uma opção válida.
  const opcoes: SlotLivre[] = React.useMemo(() => {
    const livres = horarios?.livres ?? [];
    if (!horarioInicial) return livres;
    const jaTem = livres.some((item) => item.horaInicio === horarioInicial.horaInicio);
    return jaTem ? livres : [horarioInicial, ...livres].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [horarios, horarioInicial]);

  async function salvar() {
    if (!slot) {
      toast.error("Escolha um horário.");
      return;
    }
    if (!reagendando && !alunoId) {
      toast.error("Escolha o aluno.");
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch(
        reagendando ? `/api/personal/agendamentos/${agendamento.id}` : "/api/personal/agendamentos",
        {
          method: reagendando ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(reagendando ? {} : { alunoId }),
            data,
            horaInicio: slot.horaInicio,
            horaFim: slot.horaFim,
            observacoes: observacoes || null,
          }),
        }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível salvar o agendamento.");
        return;
      }

      toast.success(reagendando ? "Agendamento remarcado." : "Atendimento agendado.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={reagendando ? "Reagendar atendimento" : "Novo agendamento"}
      description={
        reagendando
          ? `Escolha o novo horário de ${agendamento.aluno.nome}.`
          : "O sistema mostra apenas os horários livres dentro do seu expediente."
      }
      footer={
        <>
          <ModalClose render={<Button variant="ghost">Cancelar</Button>} />
          <Button onClick={salvar} disabled={salvando || !slot}>
            {salvando ? <Spinner /> : <CheckIcon />}
            {reagendando ? "Reagendar" : "Agendar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {reagendando ? (
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-3">
            <Avatar size="sm">
              {agendamento.aluno.avatarUrl ? (
                <AvatarImage src={agendamento.aluno.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="bg-primary/15 text-[0.6rem] text-primary dark:bg-primary/20">
                {iniciais(agendamento.aluno.nome)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{agendamento.aluno.nome}</span>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              antes: {agendamento.horaInicio}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="agendamento-aluno">Aluno</Label>
            <Select value={alunoId} onValueChange={(valor) => setAlunoId(valor ?? "")}>
              <SelectTrigger id="agendamento-aluno" className="w-full">
                <SelectValue placeholder="Selecione o aluno">
                  {() => nomeDoAluno ?? "Selecione o aluno"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {alunos.map((aluno) => (
                  <SelectItem key={aluno.id} value={aluno.id}>
                    {aluno.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="agendamento-data">Data</Label>
          <Input
            id="agendamento-data"
            type="date"
            value={data}
            onChange={(evento) => {
              setData(evento.target.value);
              setSlot(null);
            }}
          />
          <span className="text-xs text-muted-foreground first-letter:uppercase">
            {formatarDiaPorExtenso(data)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Horário</Label>
          {carregandoHorarios ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, indice) => (
                <Skeleton key={indice} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : opcoes.length === 0 ? (
            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              {SEM_HORARIO[horarios?.motivo ?? "SEM_TRABALHO"]}
            </p>
          ) : (
            <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {opcoes.map((opcao) => (
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="agendamento-observacoes">Observações (opcional)</Label>
          <Textarea
            id="agendamento-observacoes"
            rows={2}
            maxLength={500}
            value={observacoes}
            onChange={(evento) => setObservacoes(evento.target.value)}
            placeholder="Algo que você queira lembrar sobre este atendimento"
          />
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   Bloquear horário
   ------------------------------------------------------------------------- */

export function BloqueioModal({
  open,
  onOpenChange,
  dataInicial,
  onSalvo,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  dataInicial: string;
  onSalvo: () => void;
}) {
  const [data, setData] = React.useState(dataInicial);
  const [diaInteiro, setDiaInteiro] = React.useState(true);
  const [horaInicio, setHoraInicio] = React.useState("12:00");
  const [horaFim, setHoraFim] = React.useState("14:00");
  const [motivo, setMotivo] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  const [contexto, setContexto] = React.useState("");
  const contextoAtual = `${open}:${dataInicial}`;
  if (open && contexto !== contextoAtual) {
    setContexto(contextoAtual);
    setData(dataInicial);
    setDiaInteiro(true);
    setMotivo("");
  }

  async function salvar() {
    setSalvando(true);
    try {
      const res = await fetch("/api/personal/agenda/bloqueios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          horaInicio: diaInteiro ? null : horaInicio,
          horaFim: diaInteiro ? null : horaFim,
          motivo: motivo || null,
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível bloquear o horário.");
        return;
      }

      toast.success(diaInteiro ? "Dia bloqueado." : "Horário bloqueado.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Bloquear horário"
      description="Horário bloqueado some da lista de disponíveis e não aceita agendamento."
      footer={
        <>
          <ModalClose render={<Button variant="ghost">Cancelar</Button>} />
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Spinner /> : <LockIcon />}
            Bloquear
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bloqueio-data">Data</Label>
          <Input
            id="bloqueio-data"
            type="date"
            value={data}
            onChange={(evento) => setData(evento.target.value)}
          />
        </div>

        <div className="flex gap-1.5">
          {[
            { valor: true, rotulo: "Dia inteiro" },
            { valor: false, rotulo: "Faixa de horário" },
          ].map((opcao) => (
            <button
              key={String(opcao.valor)}
              type="button"
              onClick={() => setDiaInteiro(opcao.valor)}
              aria-pressed={diaInteiro === opcao.valor}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors outline-none",
                "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                diaInteiro === opcao.valor
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>

        {!diaInteiro ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bloqueio-inicio">Das</Label>
              <Input
                id="bloqueio-inicio"
                type="time"
                value={horaInicio}
                onChange={(evento) => setHoraInicio(evento.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bloqueio-fim">Até</Label>
              <Input
                id="bloqueio-fim"
                type="time"
                value={horaFim}
                onChange={(evento) => setHoraFim(evento.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="bloqueio-motivo">Motivo (opcional)</Label>
          <Input
            id="bloqueio-motivo"
            maxLength={120}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Consulta médica, viagem, almoço..."
          />
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   Horários de trabalho
   ------------------------------------------------------------------------- */

export function HorariosDeTrabalhoModal({
  open,
  onOpenChange,
  onMudou,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  onMudou: () => void;
}) {
  const [duracaoPadrao, setDuracaoPadrao] = React.useState(60);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Configurações da agenda"
      description="Seus horários de trabalho e as regras para o aluno marcar sozinho."
      footer={<ModalClose render={<Button>Fechar</Button>} />}
    >
      {/* Os mesmos editores da página de perfil - um lugar só para a lógica. */}
      <div className="flex flex-col gap-6">
        <HorariosDeTrabalhoEditor onMudou={onMudou} duracaoPadrao={duracaoPadrao} />
        <div className="border-t border-border pt-4">
          <RegrasDaAgendaEditor
            onMudou={onMudou}
            onRegras={(regras) => setDuracaoPadrao(regras.duracaoPadraoMin)}
          />
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   Detalhe do agendamento
   ------------------------------------------------------------------------- */

export function DetalheAgendamentoModal({
  agendamento,
  onOpenChange,
  onConfirmar,
  onRealizar,
  onCancelar,
  onReagendar,
}: {
  agendamento: AgendamentoAgenda | null;
  onOpenChange: (aberto: boolean) => void;
  onConfirmar: (agendamento: AgendamentoAgenda) => void;
  onRealizar: (agendamento: AgendamentoAgenda) => void;
  onCancelar: (agendamento: AgendamentoAgenda) => void;
  onReagendar: (agendamento: AgendamentoAgenda) => void;
}) {
  if (!agendamento) return null;

  const status = STATUS_AGENDAMENTO[agendamento.status];
  const encerrado = agendamento.status === "CANCELADO" || agendamento.status === "REALIZADO";

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title={agendamento.aluno.nome}
      description={`${formatarDiaPorExtenso(agendamento.data)} · ${agendamento.horaInicio} às ${agendamento.horaFim}`}
      footer={
        <>
          <ModalClose render={<Button variant="ghost">Fechar</Button>} />
          {!encerrado ? (
            <Button variant="destructive" onClick={() => onCancelar(agendamento)}>
              <XIcon />
              Cancelar atendimento
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {agendamento.treino ? (
            <Badge variant="outline" className="gap-1">
              <DumbbellIcon className="size-3" />
              {agendamento.treino.nome}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <CalendarDaysIcon className="size-3" />
              Sem treino programado
            </Badge>
          )}
        </div>

        {agendamento.observacoes ? (
          <p className="rounded-xl bg-muted/60 p-3 text-sm leading-relaxed">
            {agendamento.observacoes}
          </p>
        ) : null}

        {!encerrado ? (
          <div className="flex flex-wrap gap-2">
            {agendamento.status !== "CONFIRMADO" ? (
              <Button size="sm" onClick={() => onConfirmar(agendamento)}>
                <CheckIcon />
                Confirmar
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => onRealizar(agendamento)}>
              <CheckIcon />
              Marcar treino como concluído
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReagendar(agendamento)}>
              <ClockIcon />
              Reagendar
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
