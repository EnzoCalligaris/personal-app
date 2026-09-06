"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { diaSemanaLabel } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { DiaSemana } from "@/types";
import type {
  FaixaDeTrabalho,
  HorariosDeTrabalhoResponse,
  RegrasAgendamento,
} from "@/types/agenda";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

const DIAS: DiaSemana[] = [
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
  "DOMINGO",
];

/** Limites validados também no servidor (`src/lib/validations/agenda.ts`). */
const LIMITES = {
  duracaoMin: { min: 15, max: 240 },
  antecedenciaMinHoras: { min: 0, max: 168 },
  cancelamentoMinHoras: { min: 0, max: 168 },
  janelaDias: { min: 1, max: 180 },
  maxAtivosPorAluno: { min: 1, max: 20 },
  duracaoPadraoMin: { min: 15, max: 240 },
} as const;

function foraDoIntervalo(valor: number, limite: { min: number; max: number }) {
  return !Number.isFinite(valor) || valor < limite.min || valor > limite.max;
}

/* -------------------------------------------------------------------------
   Horários de trabalho
   ------------------------------------------------------------------------- */

export function HorariosDeTrabalhoEditor({
  onMudou,
  duracaoPadrao = 60,
}: {
  onMudou?: () => void;
  /** Sugestão para o campo de duração ao adicionar uma faixa. */
  duracaoPadrao?: number;
}) {
  const { data, loading } = useApi<HorariosDeTrabalhoResponse>("/api/personal/agenda/trabalho");

  const [faixas, setFaixas] = React.useState<FaixaDeTrabalho[] | null>(null);
  const lista = faixas ?? data?.faixas ?? [];

  const [diaSemana, setDiaSemana] = React.useState<DiaSemana>("SEGUNDA");
  const [horaInicio, setHoraInicio] = React.useState("06:00");
  const [horaFim, setHoraFim] = React.useState("12:00");
  const [duracao, setDuracao] = React.useState(String(duracaoPadrao));
  const [salvando, setSalvando] = React.useState(false);

  // Validação no cliente: a mesma regra que o servidor aplica.
  const erroHorario = horaFim <= horaInicio ? "O término precisa ser depois do início." : null;
  const erroDuracao = foraDoIntervalo(Number(duracao), LIMITES.duracaoMin)
    ? `Use entre ${LIMITES.duracaoMin.min} e ${LIMITES.duracaoMin.max} minutos.`
    : null;

  async function adicionar() {
    if (erroHorario || erroDuracao) return;

    setSalvando(true);
    try {
      const res = await fetch("/api/personal/agenda/trabalho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diaSemana,
          horaInicio,
          horaFim,
          duracaoMin: Number(duracao),
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível salvar a faixa.");
        return;
      }

      setFaixas(body.faixas as FaixaDeTrabalho[]);
      toast.success("Horário de trabalho adicionado.");
      onMudou?.();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(faixaId: string) {
    const res = await fetch(`/api/personal/agenda/trabalho/${faixaId}`, { method: "DELETE" });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      toast.error(body?.error ?? "Não foi possível remover.");
      return;
    }

    setFaixas(body.faixas as FaixaDeTrabalho[]);
    toast.success("Faixa removida.");
    onMudou?.();
  }

  const porDia = DIAS.map((dia) => ({
    dia,
    faixas: lista.filter((faixa) => faixa.diaSemana === dia),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <span className="text-sm font-medium">Adicionar faixa</span>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <Label htmlFor="trabalho-dia">Dia</Label>
            <Select
              value={diaSemana}
              onValueChange={(valor) => setDiaSemana((valor as DiaSemana) ?? "SEGUNDA")}
            >
              <SelectTrigger id="trabalho-dia" className="w-full">
                <SelectValue>{() => diaSemanaLabel(diaSemana)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIAS.map((dia) => (
                  <SelectItem key={dia} value={dia}>
                    {diaSemanaLabel(dia)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trabalho-inicio">Das</Label>
            <Input
              id="trabalho-inicio"
              type="time"
              value={horaInicio}
              onChange={(evento) => setHoraInicio(evento.target.value)}
              aria-invalid={!!erroHorario}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trabalho-fim">Até</Label>
            <Input
              id="trabalho-fim"
              type="time"
              value={horaFim}
              onChange={(evento) => setHoraFim(evento.target.value)}
              aria-invalid={!!erroHorario}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trabalho-duracao">Atendimento (min)</Label>
            <Input
              id="trabalho-duracao"
              type="number"
              min={LIMITES.duracaoMin.min}
              max={LIMITES.duracaoMin.max}
              step={15}
              value={duracao}
              onChange={(evento) => setDuracao(evento.target.value)}
              aria-invalid={!!erroDuracao}
            />
          </div>
        </div>

        {erroHorario || erroDuracao ? (
          <span className="text-xs text-destructive">{erroHorario ?? erroDuracao}</span>
        ) : null}

        <Button
          size="sm"
          onClick={adicionar}
          disabled={salvando || !!erroHorario || !!erroDuracao}
          className="self-start"
        >
          {salvando ? <Spinner /> : <PlusIcon />}
          Adicionar
        </Button>
      </div>

      {loading && !faixas ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, indice) => (
            <Skeleton key={indice} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {porDia.map(({ dia, faixas: doDia }) => (
            <li
              key={dia}
              className="flex items-start gap-3 border-b border-border pb-2 last:border-0"
            >
              <span className="w-20 shrink-0 pt-1 text-sm font-medium">{diaSemanaLabel(dia)}</span>

              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {doDia.length === 0 ? (
                  <span className="pt-1 text-xs text-muted-foreground">Não atendo</span>
                ) : (
                  doDia.map((faixa) => (
                    <span
                      key={faixa.id}
                      className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs font-medium tabular-nums"
                    >
                      {faixa.horaInicio}–{faixa.horaFim}
                      <span className="text-muted-foreground">· {faixa.duracaoMin}min</span>
                      <button
                        type="button"
                        onClick={() => remover(faixa.id)}
                        aria-label={`Remover ${faixa.horaInicio} às ${faixa.horaFim}`}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Regras de agendamento
   ------------------------------------------------------------------------- */

const CAMPOS_NUMERICOS: {
  chave: keyof typeof LIMITES;
  rotulo: string;
  ajuda: string;
}[] = [
  {
    chave: "duracaoPadraoMin",
    rotulo: "Duração padrão do treino (min)",
    ajuda: "Sugestão ao criar uma faixa de trabalho.",
  },
  {
    chave: "antecedenciaMinHoras",
    rotulo: "Tempo mínimo para agendar (h)",
    ajuda: "Quanto tempo antes o aluno precisa marcar.",
  },
  {
    chave: "janelaDias",
    rotulo: "Tempo máximo para agendar (dias)",
    ajuda: "Até quantos dias à frente ele pode marcar.",
  },
  {
    chave: "cancelamentoMinHoras",
    rotulo: "Cancelamento (h)",
    ajuda: "Prazo para o aluno cancelar ou reagendar sozinho.",
  },
  {
    chave: "maxAtivosPorAluno",
    rotulo: "Máximo de marcações por aluno",
    ajuda: "Atendimentos futuros que cada aluno pode ter.",
  },
];

export function RegrasDaAgendaEditor({
  onMudou,
  onRegras,
}: {
  onMudou?: () => void;
  /** Avisa o pai das regras carregadas (para sugerir a duração padrão). */
  onRegras?: (regras: RegrasAgendamento) => void;
}) {
  const { data } = useApi<{ regras: RegrasAgendamento }>("/api/personal/agenda/regras");
  const [regras, setRegras] = React.useState<RegrasAgendamento | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  const atual = regras ?? data?.regras ?? null;

  // Repassa as regras ao pai uma única vez, quando elas chegam.
  const avisou = React.useRef(false);
  React.useEffect(() => {
    if (!data?.regras || avisou.current) return;
    avisou.current = true;
    onRegras?.(data.regras);
  }, [data, onRegras]);

  async function salvar(mudanca: Partial<RegrasAgendamento>) {
    if (!atual) return;

    const novas = { ...atual, ...mudanca };

    // Não manda para o servidor o que já sabemos que ele vai recusar.
    for (const [chave, limite] of Object.entries(LIMITES)) {
      const valor = novas[chave as keyof RegrasAgendamento];
      if (typeof valor === "number" && foraDoIntervalo(valor, limite)) {
        toast.error(`Valor fora do permitido (${limite.min} a ${limite.max}).`);
        return;
      }
    }

    setRegras(novas);
    setSalvando(true);

    try {
      const res = await fetch("/api/personal/agenda/regras", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novas),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível salvar as regras.");
        setRegras(atual);
        return;
      }

      setRegras(body.regras as RegrasAgendamento);
      onMudou?.();
    } finally {
      setSalvando(false);
    }
  }

  if (!atual) return <Skeleton className="h-56 rounded-xl" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          Estas regras valem para o aluno marcar sozinho.
        </span>
        {salvando ? <Spinner size="sm" /> : null}
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-start justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Aluno pode marcar sozinho</span>
            <span className="text-xs text-muted-foreground">
              Desligado, só você marca os horários.
            </span>
          </span>
          <Switch
            checked={atual.permiteAgendamento}
            onCheckedChange={(marcado) => salvar({ permiteAgendamento: marcado })}
          />
        </label>

        <label className="flex items-start justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Confirmar automaticamente</span>
            <span className="text-xs text-muted-foreground">
              Desligado, o pedido do aluno fica aguardando seu aceite.
            </span>
          </span>
          <Switch
            checked={atual.confirmacaoAutomatica}
            onCheckedChange={(marcado) => salvar({ confirmacaoAutomatica: marcado })}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPOS_NUMERICOS.map((campo) => {
          const limite = LIMITES[campo.chave];
          const valor = atual[campo.chave as keyof RegrasAgendamento] as number;
          const invalido = foraDoIntervalo(valor, limite);

          return (
            <div key={campo.chave} className="flex flex-col gap-1.5">
              <Label htmlFor={`regra-${campo.chave}`} className="text-xs">
                {campo.rotulo}
              </Label>
              <Input
                id={`regra-${campo.chave}`}
                type="number"
                min={limite.min}
                max={limite.max}
                value={String(valor)}
                aria-invalid={invalido}
                onChange={(evento) =>
                  setRegras({ ...atual, [campo.chave]: Number(evento.target.value) })
                }
                onBlur={(evento) => salvar({ [campo.chave]: Number(evento.target.value) })}
              />
              <span
                className={cn(
                  "text-[0.7rem]",
                  invalido ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {invalido ? `Use entre ${limite.min} e ${limite.max}.` : campo.ajuda}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
