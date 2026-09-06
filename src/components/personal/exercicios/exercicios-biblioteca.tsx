"use client";

import * as React from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ImageIcon,
  ListChecksIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { ExercicioItem, ExercicioListResponse } from "@/types/exercicio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Modal, ModalClose } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExercicioFormModal } from "@/components/personal/exercicios/exercicio-form-modal";

type StatusFiltro = "ATIVOS" | "ARQUIVADOS" | "TODOS";

const TODOS_OS_GRUPOS = "__todos__";

export function ExerciciosBiblioteca() {
  const [busca, setBusca] = React.useState("");
  const [buscaAplicada, setBuscaAplicada] = React.useState("");
  const [status, setStatus] = React.useState<StatusFiltro>("ATIVOS");
  const [grupo, setGrupo] = React.useState<string>(TODOS_OS_GRUPOS);
  const [formAberto, setFormAberto] = React.useState(false);
  const [editando, setEditando] = React.useState<ExercicioItem | null>(null);
  const [excluindo, setExcluindo] = React.useState<ExercicioItem | null>(null);
  const [processando, setProcessando] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(timer);
  }, [busca]);

  const url = React.useMemo(() => {
    const params = new URLSearchParams({ status });
    if (buscaAplicada) params.set("q", buscaAplicada);
    if (grupo !== TODOS_OS_GRUPOS) params.set("grupo", grupo);
    return `/api/personal/exercicios?${params.toString()}`;
  }, [buscaAplicada, status, grupo]);

  const { data, loading, error, refetch } = useApi<ExercicioListResponse>(url);
  const buscando = busca !== buscaAplicada;
  const contagens = data?.contagens;

  async function alternarArquivo(exercicio: ExercicioItem) {
    setProcessando(true);
    try {
      const res = await fetch(`/api/personal/exercicios/${exercicio.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !exercicio.ativo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Não foi possível alterar o exercício.");
        return;
      }
      toast.success(exercicio.ativo ? "Exercício arquivado" : "Exercício restaurado");
      refetch();
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setProcessando(true);
    try {
      const res = await fetch(`/api/personal/exercicios/${excluindo.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error ?? "Não foi possível excluir o exercício.");
        return;
      }

      toast.success("Exercício excluído");
      setExcluindo(null);
      refetch();
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Exercícios"
        description="Cadastre uma vez e reutilize na montagem dos treinos dos seus alunos."
        actions={
          <Button
            onClick={() => {
              setEditando(null);
              setFormAberto(true);
            }}
          >
            <PlusIcon />
            Novo exercício
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome ou descrição"
            aria-label="Buscar exercícios"
            className="pl-10"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={grupo} onValueChange={(valor) => setGrupo(valor ?? TODOS_OS_GRUPOS)}>
            <SelectTrigger size="sm" aria-label="Filtrar por grupo muscular" className="w-[190px]">
              <SelectValue>
                {(valor) =>
                  valor === TODOS_OS_GRUPOS ? "Todos os grupos" : (valor as string)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS_OS_GRUPOS}>Todos os grupos</SelectItem>
              {(data?.grupos ?? []).map((item) => (
                <SelectItem key={item.nome} value={item.nome}>
                  {item.nome} ({item.total})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={status} onValueChange={(valor) => setStatus(valor as StatusFiltro)}>
            <TabsList>
              <TabsTrigger value="ATIVOS">
                Ativos{contagens ? ` (${contagens.ativos})` : ""}
              </TabsTrigger>
              <TabsTrigger value="ARQUIVADOS">
                Arquivados{contagens ? ` (${contagens.arquivados})` : ""}
              </TabsTrigger>
              <TabsTrigger value="TODOS">Todos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {loading || buscando ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {error && !loading ? (
        <ErrorState
          title="Não foi possível carregar os exercícios"
          description="Houve um problema ao buscar a biblioteca. Tente novamente."
          detail={error}
          onRetry={refetch}
        />
      ) : null}

      {data && !loading && !buscando ? (
        data.exercicios.length === 0 ? (
          buscaAplicada || grupo !== TODOS_OS_GRUPOS || status !== "ATIVOS" ? (
            <EmptyState
              icon={SearchIcon}
              title="Nenhum exercício encontrado"
              description="Nenhum exercício corresponde à busca ou aos filtros selecionados."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setBusca("");
                    setGrupo(TODOS_OS_GRUPOS);
                    setStatus("ATIVOS");
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ListChecksIcon}
              title="Sua biblioteca está vazia"
              description="Cadastre os exercícios que você usa com frequência para montar treinos mais rápido."
              action={
                <Button
                  onClick={() => {
                    setEditando(null);
                    setFormAberto(true);
                  }}
                >
                  <PlusIcon />
                  Cadastrar exercício
                </Button>
              }
            />
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.exercicios.map((exercicio) => (
              <CardExercicio
                key={exercicio.id}
                exercicio={exercicio}
                onEditar={() => {
                  setEditando(exercicio);
                  setFormAberto(true);
                }}
                onArquivar={() => alternarArquivo(exercicio)}
                onExcluir={() => setExcluindo(exercicio)}
                onImagemEnviada={refetch}
              />
            ))}
          </div>
        )
      ) : null}

      {/* `key` remonta o formulário ao alternar entre criar e editar outro
          exercício, reiniciando os campos sem sincronizar estado na mão. */}
      <ExercicioFormModal
        key={editando?.id ?? "novo"}
        open={formAberto}
        onOpenChange={setFormAberto}
        exercicio={editando}
        onSaved={refetch}
      />

      <Modal
        open={!!excluindo}
        onOpenChange={(aberto) => !aberto && setExcluindo(null)}
        title="Excluir exercício"
        description={
          excluindo?.usadoEmTreinos
            ? `"${excluindo.nome}" está em ${plural(excluindo.usadoEmTreinos, "treino")}. Excluir removeria o exercício dessas fichas - arquive-o para tirá-lo da biblioteca sem alterar os treinos.`
            : `"${excluindo?.nome}" será removido permanentemente da sua biblioteca.`
        }
        footer={
          <>
            <ModalClose render={<Button variant="outline" />}>Cancelar</ModalClose>
            {excluindo?.usadoEmTreinos ? (
              <Button
                onClick={async () => {
                  const alvo = excluindo;
                  setExcluindo(null);
                  if (alvo) await alternarArquivo(alvo);
                }}
                disabled={processando}
              >
                <ArchiveIcon />
                Arquivar
              </Button>
            ) : (
              <Button variant="destructive" onClick={confirmarExclusao} disabled={processando}>
                {processando ? <Spinner size="sm" /> : <Trash2Icon />}
                Excluir
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}

function CardExercicio({
  exercicio,
  onEditar,
  onArquivar,
  onExcluir,
  onImagemEnviada,
}: {
  exercicio: ExercicioItem;
  onEditar: () => void;
  onArquivar: () => void;
  onExcluir: () => void;
  onImagemEnviada: () => void;
}) {
  const [enviando, setEnviando] = React.useState(false);
  const inputImagem = React.useRef<HTMLInputElement>(null);

  async function enviarImagem(arquivo: File) {
    setEnviando(true);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      const res = await fetch(`/api/personal/exercicios/${exercicio.id}/imagem`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível enviar a imagem.");
        return;
      }
      toast.success("Imagem atualizada!");
      onImagemEnviada();
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card size="sm" className={cn("h-full", !exercicio.ativo && "opacity-70")}>
      <CardContent className="flex h-full flex-col gap-3">
        {/* Imagem de demonstração */}
        <button
          type="button"
          onClick={() => inputImagem.current?.click()}
          disabled={enviando}
          className="group relative flex h-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 transition-colors hover:border-foreground/20 hover:bg-muted"
          aria-label={exercicio.imagemUrl ? "Trocar imagem" : "Adicionar imagem"}
        >
          {exercicio.imagemUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={exercicio.imagemUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              {enviando ? <Spinner size="sm" /> : <ImageIcon className="size-5" />}
              {enviando ? "Enviando..." : "Adicionar imagem"}
            </span>
          )}
        </button>
        <input
          ref={inputImagem}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const arquivo = event.target.files?.[0];
            if (arquivo) enviarImagem(arquivo);
            event.target.value = "";
          }}
        />

        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="truncate font-heading font-semibold tracking-tight">{exercicio.nome}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{exercicio.grupoMuscular}</Badge>
              {!exercicio.ativo ? <Badge variant="secondary">Arquivado</Badge> : null}
              {exercicio.usadoEmTreinos > 0 ? (
                <Badge variant="info">{plural(exercicio.usadoEmTreinos, "treino")}</Badge>
              ) : null}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${exercicio.nome}`} />
              }
            >
              <MoreVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditar}>
                <PencilIcon />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArquivar}>
                {exercicio.ativo ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
                {exercicio.ativo ? "Arquivar" : "Restaurar"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onExcluir}>
                <Trash2Icon />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {exercicio.descricao ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">{exercicio.descricao}</p>
        ) : null}

        {exercicio.videoUrl ? (
          <a
            href={exercicio.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <PlayIcon className="size-3.5" />
            Ver vídeo
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}
