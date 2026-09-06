"use client";

import * as React from "react";
import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  LockIcon,
  SettingsIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { dataUTC, hojeUTC, paraISO, somarDiasUTC } from "@/lib/date-utils";
import { formatarDataCalendario, formatarDiaPorExtenso } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { AgendaResponse, AgendamentoAgenda, VistaAgenda } from "@/types/agenda";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { VistaDia, VistaMes, VistaSemana } from "@/components/personal/agenda/vistas";
import {
  AgendamentoModal,
  BloqueioModal,
  DetalheAgendamentoModal,
  HorariosDeTrabalhoModal,
} from "@/components/personal/agenda/modais";

const ROTULO_VISTA: Record<VistaAgenda, string> = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
};

/** Quantos dias avança/retrocede cada seta, por vista. */
function navegar(vista: VistaAgenda, referencia: Date, direcao: 1 | -1): Date {
  if (vista === "dia") return somarDiasUTC(referencia, direcao);
  if (vista === "semana") return somarDiasUTC(referencia, 7 * direcao);

  return new Date(
    Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth() + direcao, 1)
  );
}

function titulo(vista: VistaAgenda, agenda: AgendaResponse | null) {
  if (!agenda) return "";

  if (vista === "dia") return formatarDiaPorExtenso(agenda.referencia);
  if (vista === "semana") {
    return `${formatarDataCalendario(agenda.de)} a ${formatarDataCalendario(agenda.ate)}`;
  }

  const [ano, mes] = agenda.referencia.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(ano, mes - 1, 1)
  );
}

/**
 * Agenda do Personal: as três vistas (dia, semana e mês) sobre a mesma
 * resposta da API, com as ações de confirmar, reagendar, cancelar, marcar como
 * realizado e bloquear/liberar horários.
 */
export function AgendaPersonal() {
  const [vista, setVista] = React.useState<VistaAgenda>("semana");
  const [referencia, setReferencia] = React.useState<string>(() => paraISO(hojeUTC()));
  const [versao, setVersao] = React.useState(0);

  const [novoAgendamento, setNovoAgendamento] = React.useState<{
    data: string;
    horaInicio?: string;
    horaFim?: string;
  } | null>(null);
  const [reagendando, setReagendando] = React.useState<AgendamentoAgenda | null>(null);
  const [detalhe, setDetalhe] = React.useState<AgendamentoAgenda | null>(null);
  const [bloqueando, setBloqueando] = React.useState<string | null>(null);
  const [configurando, setConfigurando] = React.useState(false);

  const { data, loading, error, refetch } = useApi<AgendaResponse>(
    `/api/personal/agenda?vista=${vista}&data=${referencia}&v=${versao}`
  );

  function atualizar() {
    setVersao((valor) => valor + 1);
  }

  function irPara(dataISO: string, novaVista: VistaAgenda = "dia") {
    setReferencia(dataISO);
    setVista(novaVista);
  }

  /** Ações do card de agendamento: confirmar, realizar e cancelar. */
  async function mudarStatus(agendamento: AgendamentoAgenda, status: string, mensagem: string) {
    const res = await fetch(`/api/personal/agendamentos/${agendamento.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      toast.error(body?.error ?? "Não foi possível atualizar o agendamento.");
      return;
    }

    toast.success(mensagem);
    setDetalhe(null);
    atualizar();
  }

  async function liberarBloqueio(bloqueioId: string) {
    const res = await fetch(`/api/personal/agenda/bloqueios/${bloqueioId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Não foi possível liberar o horário.");
      return;
    }
    toast.success("Horário liberado.");
    atualizar();
  }

  const acoes = {
    aoAbrir: setDetalhe,
    aoConfirmar: (item: AgendamentoAgenda) =>
      mudarStatus(item, "CONFIRMADO", "Agendamento confirmado."),
    aoRealizar: (item: AgendamentoAgenda) =>
      mudarStatus(item, "REALIZADO", "Treino marcado como concluído."),
    aoCancelar: (item: AgendamentoAgenda) => mudarStatus(item, "CANCELADO", "Agendamento cancelado."),
    aoReagendar: setReagendando,
    aoLiberar: liberarBloqueio,
    aoAgendar: (data: string, horaInicio?: string, horaFim?: string) =>
      setNovoAgendamento({ data, horaInicio, horaFim }),
    aoAbrirDia: (data: string) => irPara(data),
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Atendimentos"
        title="Agenda"
        description="Seus horários de trabalho, os atendimentos marcados e o que ainda está livre."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfigurando(true)}>
              <SettingsIcon />
              Configurações
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBloqueando(data?.referencia ?? referencia)}
            >
              <LockIcon />
              Bloquear
            </Button>
            <Button
              size="sm"
              className="order-first sm:order-none"
              onClick={() => setNovoAgendamento({ data: data?.referencia ?? referencia })}
            >
              <CalendarPlusIcon />
              Novo agendamento
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Vista da agenda"
          className="flex gap-1 rounded-xl bg-muted p-1"
        >
          {(Object.keys(ROTULO_VISTA) as VistaAgenda[]).map((opcao) => (
            <button
              key={opcao}
              role="tab"
              type="button"
              aria-selected={vista === opcao}
              onClick={() => setVista(opcao)}
              className={
                vista === opcao
                  ? "rounded-lg bg-card px-3 py-1.5 text-sm font-medium shadow-soft"
                  : "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {ROTULO_VISTA[opcao]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Período anterior"
            onClick={() => setReferencia(paraISO(navegar(vista, dataUTC(referencia), -1)))}
          >
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReferencia(paraISO(hojeUTC()))}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Próximo período"
            onClick={() => setReferencia(paraISO(navegar(vista, dataUTC(referencia), 1)))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      <h2 className="font-heading text-lg font-semibold first-letter:uppercase">
        {titulo(vista, data)}
      </h2>

      {error ? (
        <ErrorState title="Não foi possível carregar a agenda" detail={error} onRetry={refetch} />
      ) : loading || !data ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, indice) => (
              <Skeleton key={indice} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : (
        <>
          <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Atendimentos" value={data.resumo.agendamentos} icon={CalendarDaysIcon} />
            <StatCard
              label="Confirmados"
              value={data.resumo.confirmados}
              icon={CheckIcon}
              tone="violet"
            />
            <StatCard
              label="A confirmar"
              value={data.resumo.pendentes}
              icon={ClockIcon}
              tone="amber"
            />
            <StatCard
              label={vista === "mes" ? "Realizados" : "Horários livres"}
              value={vista === "mes" ? data.resumo.realizados : data.resumo.livres}
              icon={vista === "mes" ? CheckIcon : CalendarPlusIcon}
              tone="cyan"
            />
          </section>

          {vista === "dia" ? (
            <VistaDia dia={data.dias[0]} acoes={acoes} />
          ) : vista === "semana" ? (
            <VistaSemana agenda={data} acoes={acoes} />
          ) : (
            <VistaMes agenda={data} acoes={acoes} />
          )}
        </>
      )}

      <AgendamentoModal
        open={novoAgendamento !== null || reagendando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setNovoAgendamento(null);
            setReagendando(null);
          }
        }}
        agendamento={reagendando}
        dataInicial={reagendando?.data ?? novoAgendamento?.data ?? referencia}
        horarioInicial={
          novoAgendamento?.horaInicio
            ? { horaInicio: novoAgendamento.horaInicio, horaFim: novoAgendamento.horaFim! }
            : null
        }
        onSalvo={() => {
          setNovoAgendamento(null);
          setReagendando(null);
          atualizar();
        }}
      />

      <BloqueioModal
        open={bloqueando !== null}
        onOpenChange={(aberto) => !aberto && setBloqueando(null)}
        dataInicial={bloqueando ?? referencia}
        onSalvo={() => {
          setBloqueando(null);
          atualizar();
        }}
      />

      <HorariosDeTrabalhoModal
        open={configurando}
        onOpenChange={setConfigurando}
        onMudou={atualizar}
      />

      <DetalheAgendamentoModal
        agendamento={detalhe}
        onOpenChange={(aberto) => !aberto && setDetalhe(null)}
        onConfirmar={acoes.aoConfirmar}
        onRealizar={acoes.aoRealizar}
        onCancelar={acoes.aoCancelar}
        onReagendar={(item) => {
          setDetalhe(null);
          setReagendando(item);
        }}
      />
    </div>
  );
}

export type AcoesAgenda = {
  aoAbrir: (agendamento: AgendamentoAgenda) => void;
  aoConfirmar: (agendamento: AgendamentoAgenda) => void;
  aoRealizar: (agendamento: AgendamentoAgenda) => void;
  aoCancelar: (agendamento: AgendamentoAgenda) => void;
  aoReagendar: (agendamento: AgendamentoAgenda) => void;
  aoLiberar: (bloqueioId: string) => void;
  aoAgendar: (data: string, horaInicio?: string, horaFim?: string) => void;
  aoAbrirDia: (data: string) => void;
};
