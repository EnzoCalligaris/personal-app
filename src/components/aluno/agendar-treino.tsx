"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  InfoIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { diaSemanaLabel, formatarDiaPorExtenso, iniciais } from "@/lib/format";
import { toast } from "@/lib/toast";
import type {
  DiaParaAgendar,
  DiasParaAgendarResponse,
  HorariosParaAgendarResponse,
} from "@/types/aluno-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

/**
 * Agendar treino: escolher a data, ver os horários realmente disponíveis,
 * escolher um e confirmar. A tela mostra apenas o que as regras do Personal
 * permitem - e o servidor revalida tudo na hora de gravar.
 */
export function AgendarTreino() {
  const router = useRouter();

  const { data: janela, loading, error, refetch } = useApi<DiasParaAgendarResponse>(
    "/api/aluno/agenda/dias"
  );

  const [dataEscolhida, setDataEscolhida] = React.useState<string | null>(null);
  const [horario, setHorario] = React.useState<{ horaInicio: string; horaFim: string } | null>(
    null
  );
  const [observacoes, setObservacoes] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  // O primeiro dia com vaga já vem selecionado - é o que o aluno quer ver.
  const primeiroLivre = janela?.dias.find((dia) => !dia.indisponivel)?.data ?? null;
  const data = dataEscolhida ?? primeiroLivre;

  const { data: horarios, loading: carregandoHorarios } = useApi<HorariosParaAgendarResponse>(
    data ? `/api/aluno/agenda/horarios?data=${data}` : null
  );

  async function confirmar() {
    if (!data || !horario) return;

    setSalvando(true);
    try {
      const res = await fetch("/api/aluno/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          horaInicio: horario.horaInicio,
          horaFim: horario.horaFim,
          observacoes: observacoes || null,
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível agendar.");
        return;
      }

      toast.success("Treino agendado!", {
        description:
          body?.status === "CONFIRMADO"
            ? "Seu horário está confirmado."
            : "Seu Personal vai confirmar o horário.",
      });
      router.push("/aluno/agenda");
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Atendimentos" title="Agendar treino" />
        <ErrorState
          title="Não foi possível abrir a agenda"
          detail={error}
          onRetry={refetch}
          action={
            <Button variant="outline" render={<Link href="/aluno/agenda" />}>
              Voltar para minha agenda
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/aluno/agenda" />}>
          <ArrowLeftIcon />
          Minha agenda
        </Button>
      </div>

      <PageHeader
        eyebrow="Atendimentos"
        title="Agendar treino"
        description="Escolha o dia e o horário com seu Personal. Só aparecem horários realmente disponíveis."
      />

      {loading || !janela ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : !janela.regras.permiteAgendamento ? (
        <EmptyState
          icon={CalendarDaysIcon}
          title="Seu Personal prefere marcar os horários"
          description="Fale com ele para combinar o próximo atendimento - assim que ele marcar, o horário aparece na sua agenda."
          action={
            <Button variant="outline" render={<Link href="/aluno/agenda" />}>
              Ver minha agenda
            </Button>
          }
        />
      ) : janela.ativos >= janela.regras.maxAtivosPorAluno ? (
        <EmptyState
          icon={CalendarCheckIcon}
          title="Você já tem o limite de treinos marcados"
          description={`Seu Personal permite ${janela.regras.maxAtivosPorAluno} ${
            janela.regras.maxAtivosPorAluno === 1 ? "atendimento marcado" : "atendimentos marcados"
          } por vez. Cancele um deles para marcar outro.`}
          action={
            <Button render={<Link href="/aluno/agenda" />}>Ver meus horários</Button>
          }
        />
      ) : (
        <>
          {janela.personal ? (
            <Card size="sm">
              <CardContent className="flex flex-wrap items-center gap-3">
                <Avatar>
                  {janela.personal.avatarUrl ? (
                    <AvatarImage src={janela.personal.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary dark:bg-primary/20">
                    {iniciais(janela.personal.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{janela.personal.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    Marque com no mínimo {janela.regras.antecedenciaMinHoras}h de antecedência ·
                    cancele com {janela.regras.cancelamentoMinHoras}h
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>1. Escolha o dia</CardTitle>
              <CardDescription>
                Os próximos {janela.dias.length} dias, com quantos horários cada um tem livre.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {janela.dias.every((dia) => dia.indisponivel) ? (
                <EmptyState
                  size="sm"
                  icon={CalendarDaysIcon}
                  title="Nenhum horário disponível por enquanto"
                  description="Seu Personal ainda não tem horários livres nesta janela. Tente de novo mais tarde ou fale com ele."
                />
              ) : (
                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                  <div className="flex min-w-max gap-2">
                    {janela.dias.map((dia) => (
                      <BotaoDia
                        key={dia.data}
                        dia={dia}
                        selecionado={data === dia.data}
                        onEscolher={() => {
                          setDataEscolhida(dia.data);
                          setHorario(null);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {data ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>2. Escolha o horário</CardTitle>
                <CardDescription className="first-letter:uppercase">
                  {formatarDiaPorExtenso(data)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {carregandoHorarios ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, indice) => (
                      <Skeleton key={indice} className="h-12 rounded-xl" />
                    ))}
                  </div>
                ) : !horarios || horarios.livres.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3">
                    <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {horarios?.mensagem ?? "Nenhum horário disponível neste dia."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {horarios.livres.map((slot) => (
                      <button
                        key={slot.horaInicio}
                        type="button"
                        onClick={() => setHorario(slot)}
                        aria-pressed={horario?.horaInicio === slot.horaInicio}
                        className={cn(
                          "flex flex-col items-center rounded-xl border px-2 py-2.5 transition-all outline-none",
                          "focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-95",
                          horario?.horaInicio === slot.horaInicio
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.06]"
                        )}
                      >
                        <span className="font-heading text-sm font-semibold tabular-nums">
                          {slot.horaInicio}
                        </span>
                        <span
                          className={cn(
                            "text-[0.65rem] tabular-nums",
                            horario?.horaInicio === slot.horaInicio
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground"
                          )}
                        >
                          {slot.horaFim}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {horario && data ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>3. Confirme</CardTitle>
                <CardDescription>
                  {janela.regras.confirmacaoAutomatica
                    ? "Seu horário fica confirmado na hora."
                    : "Seu Personal recebe o pedido e confirma o horário."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-xl bg-primary/[0.07] p-3 ring-1 ring-primary/25 dark:bg-primary/12">
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-card text-primary">
                    <span className="font-heading text-lg leading-none font-semibold tabular-nums">
                      {data.slice(8, 10)}
                    </span>
                    <span className="text-[0.6rem] uppercase">
                      {diaSemanaLabel(
                        janela.dias.find((dia) => dia.data === data)?.diaSemana ?? "SEGUNDA"
                      ).slice(0, 3)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium first-letter:uppercase">
                      {formatarDiaPorExtenso(data)}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
                      <ClockIcon className="size-3.5" aria-hidden="true" />
                      {horario.horaInicio} às {horario.horaFim}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agendar-observacoes">Quer avisar alguma coisa? (opcional)</Label>
                  <Textarea
                    id="agendar-observacoes"
                    rows={2}
                    maxLength={300}
                    value={observacoes}
                    onChange={(evento) => setObservacoes(evento.target.value)}
                    placeholder="Ex.: quero focar em pernas, estou com dor no ombro..."
                  />
                </div>

                <Button size="lg" onClick={confirmar} disabled={salvando}>
                  {salvando ? <Spinner /> : <CheckIcon />}
                  Confirmar agendamento
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function BotaoDia({
  dia,
  selecionado,
  onEscolher,
}: {
  dia: DiaParaAgendar;
  selecionado: boolean;
  onEscolher: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      disabled={dia.indisponivel}
      aria-pressed={selecionado}
      className={cn(
        "flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-2 py-2.5 transition-all outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40",
        dia.indisponivel
          ? "cursor-not-allowed border-dashed border-border bg-muted/30 text-muted-foreground opacity-60"
          : selecionado
            ? "border-primary bg-primary text-primary-foreground shadow-soft"
            : "border-border bg-card hover:border-primary/40"
      )}
    >
      <span className="text-[0.65rem] font-medium uppercase">
        {diaSemanaLabel(dia.diaSemana).slice(0, 3)}
      </span>
      <span className="font-heading text-lg leading-none font-semibold tabular-nums">
        {dia.data.slice(8, 10)}
      </span>
      <span
        className={cn(
          "text-[0.6rem] tabular-nums",
          selecionado ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        {dia.indisponivel ? "—" : `${dia.livres} livre${dia.livres === 1 ? "" : "s"}`}
      </span>
    </button>
  );
}
