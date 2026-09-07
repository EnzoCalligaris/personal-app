"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarRangeIcon,
  DumbbellIcon,
  MoonIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { diaSemanaLabel, formatarData, plural } from "@/lib/format";
import { hojeISO } from "@/lib/fuso";
import { toast } from "@/lib/toast";
import type { DiaSemana } from "@/types";
import type { Programacao, ProgramacaoListResponse } from "@/types/programacao";
import type { TreinoListResponse } from "@/types/treino";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalClose } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

/**
 * Rotina semanal do aluno: qual treino cai em cada dia, dentro de um período.
 */
export function ProgramacaoSemana({
  aluno,
  onMudou,
}: {
  aluno: { id: string; nome: string };
  onMudou?: () => void;
}) {
  const { data, loading, error, refetch } = useApi<ProgramacaoListResponse>(
    `/api/personal/programacoes?alunoId=${aluno.id}`
  );
  const { data: treinosData } = useApi<TreinoListResponse>(
    `/api/personal/treinos?alunoId=${aluno.id}&status=ATIVOS`
  );

  const [criando, setCriando] = React.useState(false);
  const [editandoPeriodo, setEditandoPeriodo] = React.useState(false);
  const [diaEmEdicao, setDiaEmEdicao] = React.useState<DiaSemana | null>(null);
  const [processando, setProcessando] = React.useState(false);

  const vigente = data?.vigente ?? null;
  const treinos = treinosData?.treinos ?? [];

  function atualizou() {
    refetch();
    onMudou?.();
  }

  async function definirTreinoDoDia(dia: DiaSemana, treinoId: string) {
    if (!vigente) return;
    setProcessando(true);
    try {
      const res = await fetch(`/api/personal/programacoes/${vigente.id}/dias/${dia}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treinoId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível salvar o dia.");
        return;
      }
      toast.success(`${diaSemanaLabel(dia)} atualizada`);
      setDiaEmEdicao(null);
      atualizou();
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setProcessando(false);
    }
  }

  async function removerTreinoDoDia(dia: DiaSemana) {
    if (!vigente) return;
    setProcessando(true);
    try {
      const res = await fetch(`/api/personal/programacoes/${vigente.id}/dias/${dia}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Não foi possível remover o treino do dia.");
        return;
      }
      toast.success(`${diaSemanaLabel(dia)} virou descanso`);
      setDiaEmEdicao(null);
      atualizou();
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setProcessando(false);
    }
  }

  if (loading) return <Skeleton className="h-72 rounded-2xl" />;

  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar a programação"
        description="Houve um problema ao buscar a rotina deste aluno."
        detail={error}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="border-b max-md:grid-cols-1!">
          <CardTitle>Programação semanal</CardTitle>
          <CardDescription>
            {vigente
              ? `${vigente.nome ?? "Rotina atual"} · de ${formatarData(vigente.dataInicio)}${
                  vigente.dataFim ? ` até ${formatarData(vigente.dataFim)}` : " (sem data de término)"
                }`
              : "Defina o que o aluno treina em cada dia da semana."}
          </CardDescription>
          <CardAction className="max-md:col-start-1 max-md:row-span-1 max-md:row-start-3 max-md:justify-self-start">
            <div className="flex flex-wrap gap-2">
              {vigente ? (
                <Button variant="outline" size="sm" onClick={() => setEditandoPeriodo(true)}>
                  <CalendarRangeIcon />
                  Período
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setCriando(true)}>
                <PlusIcon />
                {vigente ? "Nova programação" : "Criar programação"}
              </Button>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent>
          {!vigente ? (
            <EmptyState
              size="sm"
              icon={CalendarRangeIcon}
              title="Sem programação vigente"
              description="Crie uma programação para definir o treino de cada dia da semana e habilitar o 'treino de hoje' do aluno."
              action={
                <Button size="sm" onClick={() => setCriando(true)}>
                  <PlusIcon />
                  Criar programação
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {vigente.dias.map((dia) => (
                <li key={dia.diaSemana}>
                  <button
                    type="button"
                    onClick={() => setDiaEmEdicao(dia.diaSemana)}
                    disabled={processando}
                    className={cn(
                      "flex h-full w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition-all",
                      "hover:-translate-y-0.5 hover:shadow-soft focus-visible:ring-[3px] focus-visible:ring-ring/40",
                      dia.treino
                        ? "border-border bg-card"
                        : "border-dashed border-border bg-muted/30"
                    )}
                  >
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {diaSemanaLabel(dia.diaSemana)}
                    </span>

                    {dia.treino ? (
                      <>
                        <span className="flex items-center gap-1.5 font-medium">
                          <DumbbellIcon className="size-4 shrink-0 text-primary" />
                          <span className="truncate">{dia.treino.nome}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dia.treino.totalExercicios} exercício(s)
                          {dia.treino.grupos.length ? ` · ${dia.treino.grupos.join(", ")}` : ""}
                        </span>
                        {!dia.treino.ativo ? (
                          <Badge variant="warning" className="w-fit">
                            <TriangleAlertIcon />
                            Treino inativo
                          </Badge>
                        ) : null}
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MoonIcon className="size-4" />
                        Descanso
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Histórico de programações */}
      {data && data.programacoes.length > 1 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Histórico de programações</CardTitle>
            <CardDescription>Rotinas anteriores deste aluno.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {data.programacoes
                .filter((programacao) => !programacao.vigente)
                .map((programacao) => (
                  <li
                    key={programacao.id}
                    className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Badge variant={programacao.encerrada ? "secondary" : "info"}>
                      {programacao.encerrada ? "Encerrada" : "Futura"}
                    </Badge>
                    <span className="font-medium text-foreground">
                      {programacao.nome ?? "Sem nome"}
                    </span>
                    <span>
                      {formatarData(programacao.dataInicio)}
                      {programacao.dataFim ? ` — ${formatarData(programacao.dataFim)}` : " — sem fim"}
                    </span>
                    <span>
                      · {plural(programacao.dias.filter((dia) => dia.treino).length, "dia")} com treino
                    </span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ProgramacaoFormModal
        open={criando}
        onOpenChange={setCriando}
        alunoId={aluno.id}
        onSalvo={atualizou}
      />

      {vigente ? (
        <ProgramacaoFormModal
          key={`periodo-${vigente.id}`}
          open={editandoPeriodo}
          onOpenChange={setEditandoPeriodo}
          alunoId={aluno.id}
          programacao={vigente}
          onSalvo={atualizou}
        />
      ) : null}

      <Modal
        open={!!diaEmEdicao}
        onOpenChange={(aberto) => !aberto && setDiaEmEdicao(null)}
        title={diaEmEdicao ? `${diaSemanaLabel(diaEmEdicao)}` : ""}
        description="Escolha o treino deste dia ou deixe como descanso."
        footer={
          <>
            <ModalClose render={<Button variant="outline" />}>Fechar</ModalClose>
            {diaEmEdicao && vigente?.dias.find((dia) => dia.diaSemana === diaEmEdicao)?.treino ? (
              <Button
                variant="destructive-soft"
                disabled={processando}
                onClick={() => removerTreinoDoDia(diaEmEdicao)}
              >
                <Trash2Icon />
                Deixar em descanso
              </Button>
            ) : null}
          </>
        }
      >
        {treinos.length === 0 ? (
          <EmptyState
            size="sm"
            className="border-none bg-transparent"
            icon={DumbbellIcon}
            title="Nenhum treino ativo"
            description="Monte um treino para este aluno antes de programar os dias."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {treinos.map((treino) => {
              const atual =
                diaEmEdicao &&
                vigente?.dias.find((dia) => dia.diaSemana === diaEmEdicao)?.treino?.id === treino.id;

              return (
                <li key={treino.id}>
                  <button
                    type="button"
                    disabled={processando}
                    onClick={() => diaEmEdicao && definirTreinoDoDia(diaEmEdicao, treino.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      atual ? "border-primary bg-primary/8 dark:bg-primary/12" : "border-border hover:bg-muted/60"
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{treino.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {treino.totalExercicios} exercício(s)
                        {treino.grupos.length ? ` · ${treino.grupos.join(", ")}` : ""}
                      </span>
                    </span>
                    {atual ? <Badge>Atual</Badge> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Precisa de outra ficha?{" "}
          <Link
            href="/personal/treinos"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Criar treino
          </Link>
          .
        </p>
      </Modal>
    </div>
  );
}

/** Criação de programação e edição do período da vigente. */
function ProgramacaoFormModal({
  open,
  onOpenChange,
  alunoId,
  programacao,
  onSalvo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alunoId: string;
  programacao?: Programacao;
  onSalvo: () => void;
}) {
  const editando = !!programacao;
  const [nome, setNome] = React.useState(programacao?.nome ?? "");
  const [dataInicio, setDataInicio] = React.useState(programacao?.dataInicio ?? hojeISO());
  const [dataFim, setDataFim] = React.useState(programacao?.dataFim ?? "");
  const [salvando, setSalvando] = React.useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      const url = editando
        ? `/api/personal/programacoes/${programacao!.id}`
        : "/api/personal/programacoes";

      const res = await fetch(url, {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editando ? {} : { alunoId }),
          nome: nome.trim() || null,
          dataInicio,
          dataFim: dataFim || null,
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível salvar a programação.");
        return;
      }

      toast.success(editando ? "Período atualizado!" : "Programação criada!");
      onSalvo();
      onOpenChange(false);
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editando ? "Período da programação" : "Nova programação"}
      description={
        editando
          ? "Ajuste o intervalo em que esta rotina vale."
          : "Ao criar uma nova rotina, a anterior é encerrada na véspera do início desta."
      }
      footer={
        <>
          <ModalClose render={<Button variant="outline" />}>Cancelar</ModalClose>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Spinner size="sm" /> : null}
            {editando ? "Salvar período" : "Criar programação"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="prog-nome">Nome (opcional)</Label>
          <Input
            id="prog-nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Bloco de hipertrofia"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="prog-inicio">Início</Label>
            <Input
              id="prog-inicio"
              type="date"
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prog-fim">Término (opcional)</Label>
            <Input
              id="prog-fim"
              type="date"
              value={dataFim}
              onChange={(event) => setDataFim(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Em branco = sem data para terminar.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
