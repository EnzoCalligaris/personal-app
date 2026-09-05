"use client";

import * as React from "react";
import Link from "next/link";
import {
  ActivityIcon,
  ArrowLeftIcon,
  CalendarDaysIcon,
  CameraIcon,
  DumbbellIcon,
  MessageSquareIcon,
  PencilIcon,
  PowerIcon,
  TrendingUpIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import {
  diaSemanaLabel,
  formatarData,
  formatarDataCompleta,
  formatarDataRelativa,
  formatarPeso,
  iniciais,
} from "@/lib/format";
import { toast } from "@/lib/toast";
import type { AlunoDetalhe as AlunoDetalheType } from "@/types/aluno";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading";
import { Modal, ModalClose } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlunoFormModal } from "@/components/personal/alunos/aluno-form-modal";

function idade(dataNascimento: string | null) {
  if (!dataNascimento) return null;
  const nascimento = new Date(dataNascimento);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) anos--;
  return anos;
}

function Campo({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{valor ?? "—"}</span>
    </div>
  );
}

export function AlunoDetalhe({ alunoId }: { alunoId: string }) {
  const { data: aluno, loading, error, refetch } = useApi<AlunoDetalheType>(
    `/api/personal/alunos/${alunoId}`
  );
  const [editando, setEditando] = React.useState(false);
  const [confirmandoStatus, setConfirmandoStatus] = React.useState(false);
  const [salvandoStatus, setSalvandoStatus] = React.useState(false);
  const [enviandoFoto, setEnviandoFoto] = React.useState(false);
  const inputFoto = React.useRef<HTMLInputElement>(null);

  async function alternarStatus() {
    if (!aluno) return;
    const novoStatus = aluno.status === "ATIVO" ? "INATIVO" : "ATIVO";
    setSalvandoStatus(true);
    try {
      const res = await fetch(`/api/personal/alunos/${aluno.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Não foi possível alterar o status.");
        return;
      }
      toast.success(novoStatus === "ATIVO" ? "Aluno reativado" : "Aluno desativado");
      setConfirmandoStatus(false);
      refetch();
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setSalvandoStatus(false);
    }
  }

  async function enviarFoto(arquivo: File) {
    if (!aluno) return;
    setEnviandoFoto(true);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      const res = await fetch(`/api/personal/alunos/${aluno.id}/avatar`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível enviar a foto.");
        return;
      }
      toast.success("Foto atualizada!");
      refetch();
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setEnviandoFoto(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-10 w-full max-w-xl rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" render={<Link href="/personal/alunos" />}>
          <ArrowLeftIcon />
          Voltar para alunos
        </Button>
        <ErrorState
          title="Não foi possível carregar o aluno"
          description="Ele pode ter sido removido ou houve uma falha de conexão."
          detail={error}
          onRetry={refetch}
          action={
            <Button variant="outline" render={<Link href="/personal/alunos" />}>
              Ver todos os alunos
            </Button>
          }
        />
      </div>
    );
  }

  if (!aluno) return <LoadingState />;

  const inativo = aluno.status === "INATIVO";
  const anos = idade(aluno.dataNascimento);

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit -ml-2 text-muted-foreground"
        render={<Link href="/personal/alunos" />}
      >
        <ArrowLeftIcon />
        Alunos
      </Button>

      {/* Cabeçalho do aluno */}
      <Card>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <Avatar className="size-20">
              {aluno.avatarUrl ? <AvatarImage src={aluno.avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-primary/15 text-xl font-medium text-primary dark:bg-primary/20">
                {iniciais(aluno.nome)}
              </AvatarFallback>
            </Avatar>

            <input
              ref={inputFoto}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const arquivo = event.target.files?.[0];
                if (arquivo) enviarFoto(arquivo);
                event.target.value = "";
              }}
            />
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Alterar foto do aluno"
              disabled={enviandoFoto}
              className="absolute -right-1 -bottom-1 rounded-full"
              onClick={() => inputFoto.current?.click()}
            >
              {enviandoFoto ? <Spinner size="xs" /> : <CameraIcon />}
            </Button>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight">
                {aluno.nome}
              </h1>
              <Badge variant={inativo ? "secondary" : "success"}>
                {inativo ? "Inativo" : "Ativo"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{aluno.email}</p>
            <p className="text-xs text-muted-foreground">
              Aluno desde {formatarData(aluno.criadoEm)}
              {aluno.telefone ? ` · ${aluno.telefone}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditando(true)}>
              <PencilIcon />
              Editar
            </Button>
            <Button
              variant={inativo ? "outline" : "destructive-soft"}
              onClick={() => setConfirmandoStatus(true)}
            >
              <PowerIcon />
              {inativo ? "Reativar" : "Desativar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="visao-geral">
        <TabsList className="w-full overflow-x-auto sm:w-fit">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="treinos">Treinos</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="bioimpedancia">Bioimpedância</TabsTrigger>
          <TabsTrigger value="feedbacks">Feedbacks</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="flex flex-col gap-4 pt-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Treinos ativos"
              value={aluno.metricas.treinosAtivos}
              icon={DumbbellIcon}
            />
            <StatCard
              label="Agendamentos"
              value={aluno.metricas.totalAgendamentos}
              icon={CalendarDaysIcon}
              tone="cyan"
            />
            <StatCard
              label="Avaliações"
              value={aluno.metricas.totalAvaliacoes}
              icon={ActivityIcon}
              tone="violet"
            />
            <StatCard
              label="Último treino"
              value={
                aluno.metricas.ultimaExecucao
                  ? formatarDataRelativa(aluno.metricas.ultimaExecucao)
                  : "—"
              }
              icon={TrendingUpIcon}
              tone="amber"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Dados pessoais</CardTitle>
                <CardDescription>Informações de cadastro do aluno.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Campo label="E-mail" valor={aluno.email} />
                <Campo label="Telefone" valor={aluno.telefone} />
                <Campo
                  label="Data de nascimento"
                  valor={
                    aluno.dataNascimento
                      ? `${formatarData(aluno.dataNascimento)}${anos !== null ? ` · ${anos} anos` : ""}`
                      : null
                  }
                />
                <Campo label="Altura" valor={aluno.altura ? `${aluno.altura} cm` : null} />
                <Campo label="Objetivo" valor={aluno.objetivo} />
                <Campo label="Cadastrado em" valor={formatarDataCompleta(aluno.criadoEm)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Acompanhamento</CardTitle>
                <CardDescription>Observações e próximos passos.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Campo label="Observações" valor={aluno.observacoes} />
                <Campo
                  label="Próximo treino programado"
                  valor={
                    aluno.proximoTreino
                      ? `${aluno.proximoTreino.nome} · ${diaSemanaLabel(aluno.proximoTreino.diaSemana)}`
                      : null
                  }
                />
                <Campo
                  label="Próximo agendamento"
                  valor={
                    aluno.metricas.proximoAgendamento
                      ? formatarDataCompleta(aluno.metricas.proximoAgendamento)
                      : null
                  }
                />
                <Campo
                  label="Última avaliação"
                  valor={
                    aluno.ultimaAvaliacao
                      ? `${formatarData(aluno.ultimaAvaliacao.data)}${
                          aluno.ultimaAvaliacao.peso
                            ? ` · ${formatarPeso(aluno.ultimaAvaliacao.peso)}`
                            : ""
                        }`
                      : null
                  }
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="treinos" className="pt-4">
          <EmptyState
            icon={DumbbellIcon}
            title="Treinos deste aluno"
            description="A montagem de treinos por dia da semana entra na próxima fase. Aqui ficarão as fichas, os exercícios e o histórico de execução."
          />
        </TabsContent>

        <TabsContent value="agenda" className="pt-4">
          <EmptyState
            icon={CalendarDaysIcon}
            title="Agenda deste aluno"
            description="Os agendamentos, cancelamentos e reagendamentos deste aluno aparecerão aqui quando a agenda for implementada."
          />
        </TabsContent>

        <TabsContent value="bioimpedancia" className="pt-4">
          <EmptyState
            icon={ActivityIcon}
            title="Avaliações de bioimpedância"
            description="O histórico de medidas e os gráficos de evolução deste aluno ficarão nesta aba."
          />
        </TabsContent>

        <TabsContent value="feedbacks" className="pt-4">
          <EmptyState
            icon={MessageSquareIcon}
            title="Feedbacks do Personal"
            description="Os comentários que você registrar para este aluno - por avaliação ou avulsos - aparecerão aqui."
          />
        </TabsContent>
      </Tabs>

      <AlunoFormModal
        open={editando}
        onOpenChange={setEditando}
        aluno={aluno}
        onSaved={() => refetch()}
      />

      <Modal
        open={confirmandoStatus}
        onOpenChange={setConfirmandoStatus}
        title={inativo ? "Reativar aluno" : "Desativar aluno"}
        description={
          inativo
            ? `${aluno.nome} voltará a contar como aluno ativo e a aparecer nos filtros padrão.`
            : `${aluno.nome} deixará de contar como aluno ativo. Nenhum dado é apagado - treinos, agenda e avaliações continuam disponíveis, e você pode reativar quando quiser.`
        }
        footer={
          <>
            <ModalClose render={<Button variant="outline" />}>Cancelar</ModalClose>
            <Button
              variant={inativo ? "default" : "destructive"}
              onClick={alternarStatus}
              disabled={salvandoStatus}
            >
              {salvandoStatus ? <Spinner size="sm" /> : <PowerIcon />}
              {inativo ? "Reativar aluno" : "Desativar aluno"}
            </Button>
          </>
        }
      />
    </div>
  );
}
