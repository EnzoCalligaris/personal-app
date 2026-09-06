"use client";

import * as React from "react";
import {
  CheckCheckIcon,
  MessageSquareTextIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrendingUpIcon,
  Trash2Icon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatarDataCalendario, formatarDataRelativa, iniciais } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { FeedbackItem, FeedbackListResponse } from "@/types/feedback";
import type { AlunoListResponse } from "@/types/aluno";
import type { Avaliacao, AvaliacaoListResponse } from "@/types/avaliacao";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
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
import { SkeletonList } from "@/components/ui/loading";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

/**
 * Comentários do Personal para os alunos. Serve à aba de feedbacks da ficha
 * do aluno (com `alunoFixo`) e a qualquer listagem geral.
 */
export function FeedbacksPainel({
  alunoFixo,
  onMudou,
}: {
  alunoFixo?: { id: string; nome: string } | null;
  onMudou?: () => void;
}) {
  const [busca, setBusca] = React.useState("");
  const [versao, setVersao] = React.useState(0);

  const [escrevendo, setEscrevendo] = React.useState(false);
  const [editando, setEditando] = React.useState<FeedbackItem | null>(null);
  const [excluindo, setExcluindo] = React.useState<FeedbackItem | null>(null);

  const parametros = new URLSearchParams();
  if (alunoFixo) parametros.set("alunoId", alunoFixo.id);
  if (!alunoFixo && busca.trim()) parametros.set("q", busca.trim());
  parametros.set("v", String(versao));

  const { data, loading, error, refetch } = useApi<FeedbackListResponse>(
    `/api/personal/feedbacks?${parametros.toString()}`
  );

  function atualizar() {
    setVersao((valor) => valor + 1);
    onMudou?.();
  }

  async function excluir() {
    if (!excluindo) return;

    const res = await fetch(`/api/personal/feedbacks/${excluindo.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Não foi possível excluir o comentário.");
      return;
    }

    toast.success("Comentário excluído.");
    setExcluindo(null);
    atualizar();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!alunoFixo ? (
          <div className="relative min-w-48 flex-1">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Buscar por aluno ou texto"
              placeholder="Buscar por aluno ou texto"
              className="pl-9"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>
        ) : null}

        {data && data.naoLidos > 0 ? (
          <Badge variant="info" className="gap-1">
            {data.naoLidos} não {data.naoLidos === 1 ? "lido" : "lidos"}
          </Badge>
        ) : null}

        <Button onClick={() => setEscrevendo(true)}>
          <PlusIcon />
          Escrever feedback
        </Button>
      </div>

      {error ? (
        <ErrorState title="Não foi possível carregar os feedbacks" detail={error} onRetry={refetch} />
      ) : loading || !data ? (
        <SkeletonList items={3} />
      ) : data.feedbacks.length === 0 ? (
        <EmptyState
          icon={MessageSquareTextIcon}
          title="Nenhum comentário ainda"
          description={
            alunoFixo
              ? `Escreva o primeiro feedback para ${alunoFixo.nome} - ele aparece na área do aluno com um aviso.`
              : "Escreva comentários para os seus alunos: eles aparecem na área do aluno com um aviso."
          }
          action={
            <Button onClick={() => setEscrevendo(true)}>
              <PlusIcon />
              Escrever feedback
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.feedbacks.map((feedback) => (
            <li key={feedback.id}>
              <CartaoFeedback
                feedback={feedback}
                mostrarAluno={!alunoFixo}
                onEditar={() => setEditando(feedback)}
                onExcluir={() => setExcluindo(feedback)}
              />
            </li>
          ))}
        </ul>
      )}

      <FeedbackFormModal
        open={escrevendo || editando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setEscrevendo(false);
            setEditando(null);
          }
        }}
        feedback={editando}
        alunoFixo={alunoFixo}
        onSalvo={() => {
          setEscrevendo(false);
          setEditando(null);
          atualizar();
        }}
      />

      <Modal
        open={excluindo !== null}
        onOpenChange={(aberto) => !aberto && setExcluindo(null)}
        title="Excluir comentário?"
        description={excluindo ? `Para ${excluindo.aluno.nome}` : undefined}
        footer={
          <>
            <ModalClose render={<Button variant="ghost">Manter</Button>} />
            <Button variant="destructive" onClick={excluir}>
              <Trash2Icon />
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          O comentário some da área do aluno. Se foi só um erro de escrita, prefira editar.
        </p>
      </Modal>
    </div>
  );
}

function CartaoFeedback({
  feedback,
  mostrarAluno,
  onEditar,
  onExcluir,
}: {
  feedback: FeedbackItem;
  mostrarAluno: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1",
        feedback.lido ? "ring-border" : "ring-info/40"
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {mostrarAluno ? (
          <Avatar size="sm">
            {feedback.aluno.avatarUrl ? (
              <AvatarImage src={feedback.aluno.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary/15 text-[0.6rem] font-medium text-primary dark:bg-primary/20">
              {iniciais(feedback.aluno.nome)}
            </AvatarFallback>
          </Avatar>
        ) : null}

        <div className="flex min-w-32 flex-1 flex-col">
          {mostrarAluno ? (
            <span className="truncate text-sm font-medium">{feedback.aluno.nome}</span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {formatarDataRelativa(feedback.criadoEm)} · por {feedback.autor.nome}
          </span>
        </div>

        {feedback.lido ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCheckIcon className="size-3" />
            Lido
          </Badge>
        ) : (
          <Badge variant="info">Não lido</Badge>
        )}

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Editar comentário" onClick={onEditar}>
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Excluir comentário"
            onClick={onExcluir}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-pretty">{feedback.texto}</p>

      {feedback.avaliacao ? (
        <Badge variant="outline" className="w-fit gap-1">
          <TrendingUpIcon className="size-3" />
          Sobre a avaliação de {formatarDataCalendario(feedback.avaliacao.data)}
        </Badge>
      ) : null}
    </article>
  );
}

/* -------------------------------------------------------------------------
   Escrever e editar
   ------------------------------------------------------------------------- */

function FeedbackFormModal({
  open,
  onOpenChange,
  feedback,
  alunoFixo,
  onSalvo,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  feedback?: FeedbackItem | null;
  alunoFixo?: { id: string; nome: string } | null;
  onSalvo: () => void;
}) {
  const editando = !!feedback;

  const [alunoId, setAlunoId] = React.useState(alunoFixo?.id ?? "");
  const [texto, setTexto] = React.useState("");
  const [avaliacaoId, setAvaliacaoId] = React.useState<string>("");
  const [salvando, setSalvando] = React.useState(false);

  const [contexto, setContexto] = React.useState("");
  const contextoAtual = `${open}:${feedback?.id ?? "novo"}:${alunoFixo?.id ?? ""}`;
  if (open && contexto !== contextoAtual) {
    setContexto(contextoAtual);
    setAlunoId(feedback?.aluno.id ?? alunoFixo?.id ?? "");
    setTexto(feedback?.texto ?? "");
    setAvaliacaoId(feedback?.avaliacao?.id ?? "");
  }

  const { data: alunosData } = useApi<AlunoListResponse>(
    open && !editando && !alunoFixo ? "/api/personal/alunos?status=ATIVO" : null
  );
  const { data: avaliacoesData } = useApi<AvaliacaoListResponse>(
    open && !editando && alunoId ? `/api/personal/avaliacoes?alunoId=${alunoId}` : null
  );

  const alunos = alunosData?.alunos ?? [];
  const avaliacoes: Avaliacao[] = avaliacoesData?.avaliacoes ?? [];
  const nomeDoAluno =
    feedback?.aluno.nome ?? alunoFixo?.nome ?? alunos.find((aluno) => aluno.id === alunoId)?.nome;

  async function salvar() {
    if (!editando && !alunoId) {
      toast.error("Escolha o aluno.");
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch(
        editando ? `/api/personal/feedbacks/${feedback!.id}` : "/api/personal/feedbacks",
        {
          method: editando ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editando
              ? { texto }
              : { alunoId, texto, avaliacaoId: avaliacaoId || null }
          ),
        }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível salvar o comentário.");
        return;
      }

      toast.success(editando ? "Comentário atualizado." : "Feedback enviado ao aluno.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editando ? "Editar comentário" : "Escrever feedback"}
      description={
        editando
          ? "A correção aparece na área do aluno no lugar do texto anterior."
          : "O aluno recebe uma notificação interna assim que você enviar."
      }
      footer={
        <>
          <ModalClose render={<Button variant="ghost">Cancelar</Button>} />
          <Button onClick={salvar} disabled={salvando || texto.trim().length < 3}>
            {salvando ? <Spinner /> : <MessageSquareTextIcon />}
            {editando ? "Salvar" : "Enviar feedback"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-aluno">Aluno</Label>
          {editando || alunoFixo ? (
            <Input id="feedback-aluno" value={nomeDoAluno ?? ""} readOnly disabled />
          ) : (
            <Select value={alunoId} onValueChange={(valor) => setAlunoId(valor ?? "")}>
              <SelectTrigger id="feedback-aluno" className="w-full">
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
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-texto">Comentário</Label>
          <Textarea
            id="feedback-texto"
            rows={5}
            maxLength={2000}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Parabéns pela evolução neste mês. Continue mantendo a consistência."
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {texto.length}/2000
          </span>
        </div>

        {!editando && avaliacoes.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback-avaliacao">Vincular a uma avaliação (opcional)</Label>
            <Select
              value={avaliacaoId}
              onValueChange={(valor) => setAvaliacaoId(valor ?? "")}
            >
              <SelectTrigger id="feedback-avaliacao" className="w-full">
                <SelectValue placeholder="Nenhuma">
                  {() =>
                    avaliacaoId
                      ? `Avaliação de ${formatarDataCalendario(
                          avaliacoes.find((item) => item.id === avaliacaoId)?.data ?? ""
                        )}`
                      : "Nenhuma"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {avaliacoes.map((avaliacao) => (
                  <SelectItem key={avaliacao.id} value={avaliacao.id}>
                    Avaliação de {formatarDataCalendario(avaliacao.data)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
