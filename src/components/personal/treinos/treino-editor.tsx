"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  DumbbellIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  PowerIcon,
  Trash2Icon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { diasProgramadosLabel, formatarData, formatarDataRelativa } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { TreinoDetalhe, TreinoItemExercicio } from "@/types/treino";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalClose } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { AdicionarExercicioModal } from "@/components/personal/treinos/adicionar-exercicio-modal";
import { TreinoFormModal } from "@/components/personal/treinos/treino-form-modal";

export function TreinoEditor({ treinoId }: { treinoId: string }) {
  const router = useRouter();
  const { data, loading, error, refetch } = useApi<TreinoDetalhe>(
    `/api/personal/treinos/${treinoId}`
  );

  const [treino, setTreino] = React.useState<TreinoDetalhe | null>(null);
  const [editando, setEditando] = React.useState(false);
  const [adicionando, setAdicionando] = React.useState(false);
  const [itemEmEdicao, setItemEmEdicao] = React.useState<TreinoItemExercicio | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = React.useState(false);
  const [processando, setProcessando] = React.useState(false);

  // A API devolve o treino inteiro a cada mutação, então mantemos uma cópia
  // local para a lista responder na hora (inclusive na reordenação).
  const atual = treino ?? data;

  async function mutar(
    url: string,
    init: RequestInit,
    mensagemSucesso: string,
    aoFalhar = "Não foi possível salvar."
  ) {
    setProcessando(true);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? aoFalhar);
        return null;
      }

      toast.success(mensagemSucesso);
      if (body && typeof body === "object" && "id" in body) setTreino(body as TreinoDetalhe);
      return body;
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
      return null;
    } finally {
      setProcessando(false);
    }
  }

  async function mover(indice: number, direcao: -1 | 1) {
    if (!atual) return;
    const ordem = atual.exercicios.map((item) => item.id);
    const destino = indice + direcao;
    if (destino < 0 || destino >= ordem.length) return;

    [ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]];

    await mutar(
      `/api/personal/treinos/${treinoId}/exercicios/ordem`,
      { method: "PUT", body: JSON.stringify({ itens: ordem }) },
      "Ordem atualizada",
      "Não foi possível reordenar."
    );
  }

  async function duplicar() {
    const copia = (await mutar(
      `/api/personal/treinos/${treinoId}/duplicar`,
      { method: "POST", body: JSON.stringify({}) },
      "Treino duplicado!",
      "Não foi possível duplicar."
    )) as TreinoDetalhe | null;

    if (copia?.id) {
      // A cópia vira o treino aberto - senão o Personal ficaria editando o
      // original achando que está na cópia.
      setTreino(null);
      router.push(`/personal/treinos/${copia.id}`);
    }
  }

  async function excluir() {
    setProcessando(true);
    try {
      const res = await fetch(`/api/personal/treinos/${treinoId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Não foi possível excluir o treino.");
        return;
      }
      toast.success("Treino excluído");
      router.push("/personal/treinos");
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setProcessando(false);
    }
  }

  if (loading && !atual) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error && !atual) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" render={<Link href="/personal/treinos" />}>
          <ArrowLeftIcon />
          Voltar para treinos
        </Button>
        <ErrorState
          title="Não foi possível carregar o treino"
          description="Ele pode ter sido removido ou houve uma falha de conexão."
          detail={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!atual) return null;

  const inativo = !atual.ativo;

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        render={<Link href="/personal/treinos" />}
      >
        <ArrowLeftIcon />
        Treinos
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight">
                {atual.nome}
              </h1>
              <Badge variant={inativo ? "secondary" : "success"}>
                {inativo ? "Inativo" : "Ativo"}
              </Badge>
              <Badge variant="outline">{diasProgramadosLabel(atual.diasProgramados)}</Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Aluno:{" "}
              <Link
                href={`/personal/alunos/${atual.aluno.id}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {atual.aluno.nome}
              </Link>
              {" · "}
              {atual.totalExercicios} exercício(s)
              {atual.ultimaExecucao
                ? ` · executado ${formatarDataRelativa(atual.ultimaExecucao)}`
                : " · nunca executado"}
            </p>

            {atual.observacoes ? (
              <p className="max-w-2xl text-sm text-muted-foreground">{atual.observacoes}</p>
            ) : null}

            <p className="text-xs text-muted-foreground">Criado em {formatarData(atual.criadoEm)}</p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditando(true)}>
              <PencilIcon />
              Editar
            </Button>
            <Button variant="outline" onClick={duplicar} disabled={processando}>
              <CopyIcon />
              Duplicar
            </Button>
            <Button
              variant="outline"
              disabled={processando}
              onClick={() =>
                mutar(
                  `/api/personal/treinos/${treinoId}`,
                  { method: "PATCH", body: JSON.stringify({ ativo: inativo }) },
                  inativo ? "Treino reativado" : "Treino desativado"
                )
              }
            >
              <PowerIcon />
              {inativo ? "Reativar" : "Desativar"}
            </Button>
            <Button variant="destructive-soft" onClick={() => setConfirmandoExclusao(true)}>
              <Trash2Icon />
              Excluir
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Exercícios</CardTitle>
          <CardDescription>
            A ordem define a sequência da ficha do aluno. Use as setas para reordenar.
          </CardDescription>
          <CardAction>
            <Button size="sm" onClick={() => setAdicionando(true)}>
              <PlusIcon />
              Adicionar
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {atual.exercicios.length === 0 ? (
            <EmptyState
              size="sm"
              icon={DumbbellIcon}
              title="Nenhum exercício neste treino"
              description="Adicione exercícios da sua biblioteca para montar a ficha deste aluno."
              action={
                <Button size="sm" onClick={() => setAdicionando(true)}>
                  <PlusIcon />
                  Adicionar exercício
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {atual.exercicios.map((item, indice) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Mover ${item.exercicio.nome} para cima`}
                      disabled={indice === 0 || processando}
                      onClick={() => mover(indice, -1)}
                    >
                      <ChevronUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Mover ${item.exercicio.nome} para baixo`}
                      disabled={indice === atual.exercicios.length - 1 || processando}
                      onClick={() => mover(indice, 1)}
                    >
                      <ChevronDownIcon />
                    </Button>
                  </div>

                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted font-heading text-sm font-semibold tabular-nums">
                    {item.ordem}
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{item.exercicio.nome}</span>
                      <Badge variant="outline">{item.exercicio.grupoMuscular}</Badge>
                      {!item.exercicio.ativo ? (
                        <Badge variant="secondary">Arquivado</Badge>
                      ) : null}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {item.series} x {item.repeticoes}
                      {item.carga ? ` · ${item.carga}` : ""}
                      {item.descansoSeg !== null ? ` · ${item.descansoSeg}s descanso` : ""}
                    </span>
                    {item.observacoes ? (
                      <span className="text-xs text-muted-foreground">{item.observacoes}</span>
                    ) : null}
                  </div>

                  {item.exercicio.videoUrl ? (
                    <a
                      href={item.exercicio.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block"
                      aria-label={`Vídeo de ${item.exercicio.nome}`}
                    >
                      <PlayIcon className="size-4" />
                    </a>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${item.exercicio.nome}`}
                    onClick={() => setItemEmEdicao(item)}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover ${item.exercicio.nome}`}
                    disabled={processando}
                    onClick={() =>
                      mutar(
                        `/api/personal/treinos/${treinoId}/exercicios/${item.id}`,
                        { method: "DELETE" },
                        "Exercício removido"
                      )
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <TreinoFormModal
        open={editando}
        onOpenChange={setEditando}
        treino={atual}
        onSaved={(atualizado) => setTreino(atualizado)}
      />

      <AdicionarExercicioModal
        open={adicionando}
        onOpenChange={setAdicionando}
        treinoId={treinoId}
        onAdicionado={(atualizado) => setTreino(atualizado)}
      />

      <ItemTreinoModal
        key={itemEmEdicao?.id ?? "nenhum"}
        item={itemEmEdicao}
        treinoId={treinoId}
        onOpenChange={(aberto) => !aberto && setItemEmEdicao(null)}
        onSaved={(atualizado) => setTreino(atualizado)}
      />

      <Modal
        open={confirmandoExclusao}
        onOpenChange={setConfirmandoExclusao}
        title="Excluir treino"
        description={`"${atual.nome}" e todo o histórico de execução dele serão removidos. Para apenas tirá-lo de circulação, use "Desativar".`}
        footer={
          <>
            <ModalClose render={<Button variant="outline" />}>Cancelar</ModalClose>
            <Button variant="destructive" onClick={excluir} disabled={processando}>
              {processando ? <Spinner size="sm" /> : <Trash2Icon />}
              Excluir treino
            </Button>
          </>
        }
      />
    </div>
  );
}

/** Edição de séries, repetições, carga, descanso e observações de um item. */
function ItemTreinoModal({
  item,
  treinoId,
  onOpenChange,
  onSaved,
}: {
  item: TreinoItemExercicio | null;
  treinoId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (treino: TreinoDetalhe) => void;
}) {
  const [series, setSeries] = React.useState(String(item?.series ?? 3));
  const [repeticoes, setRepeticoes] = React.useState(item?.repeticoes ?? "");
  const [carga, setCarga] = React.useState(item?.carga ?? "");
  const [descanso, setDescanso] = React.useState(
    item?.descansoSeg !== null && item?.descansoSeg !== undefined ? String(item.descansoSeg) : ""
  );
  const [observacoes, setObservacoes] = React.useState(item?.observacoes ?? "");
  const [salvando, setSalvando] = React.useState(false);

  async function salvar() {
    if (!item) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/personal/treinos/${treinoId}/exercicios/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: Number(series),
          repeticoes: repeticoes.trim(),
          carga: carga.trim() || null,
          descansoSeg: descanso ? Number(descanso) : null,
          observacoes: observacoes.trim() || null,
        }),
      });
      const treino = await res.json();

      if (!res.ok) {
        toast.error(treino.error ?? "Não foi possível salvar o exercício.");
        return;
      }

      toast.success("Exercício atualizado!");
      onSaved(treino as TreinoDetalhe);
      onOpenChange(false);
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={!!item}
      onOpenChange={onOpenChange}
      title={item ? `Editar ${item.exercicio.nome}` : "Editar exercício"}
      description="Ajuste os parâmetros deste exercício dentro do treino."
      footer={
        <>
          <ModalClose render={<Button variant="outline" />}>Cancelar</ModalClose>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Spinner size="sm" /> : null}
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-series">Séries</Label>
            <Input
              id="edit-series"
              type="number"
              min={1}
              value={series}
              onChange={(event) => setSeries(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-reps">Repetições</Label>
            <Input
              id="edit-reps"
              value={repeticoes}
              onChange={(event) => setRepeticoes(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-carga">Carga</Label>
            <Input
              id="edit-carga"
              value={carga}
              onChange={(event) => setCarga(event.target.value)}
              placeholder="40kg"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-descanso">Descanso (s)</Label>
            <Input
              id="edit-descanso"
              type="number"
              min={0}
              value={descanso}
              onChange={(event) => setDescanso(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-obs">Observações</Label>
          <Input
            id="edit-obs"
            value={observacoes}
            onChange={(event) => setObservacoes(event.target.value)}
            placeholder="Cadência, amplitude, cuidados..."
          />
        </div>
      </div>
    </Modal>
  );
}
