"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, DumbbellIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { diaSemanaLabel, formatarDataRelativa, iniciais } from "@/lib/format";
import { DIAS_SEMANA_VALORES } from "@/lib/validations/treino";
import type { DiaSemana } from "@/types";
import type { TreinoListItem, TreinoListResponse } from "@/types/treino";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { SkeletonList } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TreinoFormModal } from "@/components/personal/treinos/treino-form-modal";

type StatusFiltro = "ATIVOS" | "INATIVOS" | "TODOS";
const TODOS_OS_DIAS = "__todos__";

export function TreinosLista() {
  const router = useRouter();
  const [busca, setBusca] = React.useState("");
  const [buscaAplicada, setBuscaAplicada] = React.useState("");
  const [status, setStatus] = React.useState<StatusFiltro>("ATIVOS");
  const [dia, setDia] = React.useState<string>(TODOS_OS_DIAS);
  const [criando, setCriando] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(timer);
  }, [busca]);

  const url = React.useMemo(() => {
    const params = new URLSearchParams({ status });
    if (buscaAplicada) params.set("q", buscaAplicada);
    if (dia !== TODOS_OS_DIAS) params.set("diaSemana", dia);
    return `/api/personal/treinos?${params.toString()}`;
  }, [buscaAplicada, status, dia]);

  const { data, loading, error, refetch } = useApi<TreinoListResponse>(url);
  const buscando = busca !== buscaAplicada;
  const contagens = data?.contagens;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Programação"
        title="Treinos"
        description="Monte as fichas dos seus alunos, organizadas por dia da semana."
        actions={
          <Button onClick={() => setCriando(true)}>
            <PlusIcon />
            Novo treino
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por treino ou aluno"
            aria-label="Buscar treinos"
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
          <Select value={dia} onValueChange={(valor) => setDia(valor ?? TODOS_OS_DIAS)}>
            <SelectTrigger size="sm" aria-label="Filtrar por dia" className="w-[170px]">
              <SelectValue>
                {(valor) =>
                  valor === TODOS_OS_DIAS
                    ? "Todos os dias"
                    : diaSemanaLabel(valor as DiaSemana)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS_OS_DIAS}>Todos os dias</SelectItem>
              {DIAS_SEMANA_VALORES.map((valor) => (
                <SelectItem key={valor} value={valor}>
                  {diaSemanaLabel(valor)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={status} onValueChange={(valor) => setStatus(valor as StatusFiltro)}>
            <TabsList>
              <TabsTrigger value="ATIVOS">
                Ativos{contagens ? ` (${contagens.ativos})` : ""}
              </TabsTrigger>
              <TabsTrigger value="INATIVOS">
                Inativos{contagens ? ` (${contagens.inativos})` : ""}
              </TabsTrigger>
              <TabsTrigger value="TODOS">Todos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {loading || buscando ? <SkeletonList items={4} /> : null}

      {error && !loading ? (
        <ErrorState
          title="Não foi possível carregar os treinos"
          description="Houve um problema ao buscar a lista. Tente novamente."
          detail={error}
          onRetry={refetch}
        />
      ) : null}

      {data && !loading && !buscando ? (
        data.treinos.length === 0 ? (
          buscaAplicada || dia !== TODOS_OS_DIAS || status !== "ATIVOS" ? (
            <EmptyState
              icon={SearchIcon}
              title="Nenhum treino encontrado"
              description="Nenhum treino corresponde à busca ou aos filtros selecionados."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setBusca("");
                    setDia(TODOS_OS_DIAS);
                    setStatus("ATIVOS");
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={DumbbellIcon}
              title="Nenhum treino montado"
              description="Crie o primeiro treino e vincule a um aluno para começar a programação."
              action={
                <Button onClick={() => setCriando(true)}>
                  <PlusIcon />
                  Criar treino
                </Button>
              }
            />
          )
        ) : (
          <ul className="flex flex-col gap-3">
            {data.treinos.map((treino) => (
              <li key={treino.id}>
                <LinhaTreino treino={treino} />
              </li>
            ))}
          </ul>
        )
      ) : null}

      <TreinoFormModal
        open={criando}
        onOpenChange={setCriando}
        onSaved={(treino) => {
          refetch();
          // Abre o treino recém-criado para já adicionar os exercícios.
          router.push(`/personal/treinos/${treino.id}`);
        }}
      />
    </div>
  );
}

function LinhaTreino({ treino }: { treino: TreinoListItem }) {
  return (
    <Card size="sm" interactive className={cn(!treino.ativo && "opacity-70")}>
      <CardContent>
        <Link
          href={`/personal/treinos/${treino.id}`}
          className="flex items-center gap-3 outline-none sm:gap-4"
        >
          <Avatar size="lg">
            {treino.aluno.avatarUrl ? <AvatarImage src={treino.aluno.avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary/15 font-medium text-primary dark:bg-primary/20">
              {iniciais(treino.aluno.nome)}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{treino.nome}</span>
              <Badge variant="outline">{diaSemanaLabel(treino.diaSemana)}</Badge>
              {!treino.ativo ? <Badge variant="secondary">Inativo</Badge> : null}
            </div>
            <span className="truncate text-xs text-muted-foreground">{treino.aluno.nome}</span>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground lg:hidden">
              <span>{treino.totalExercicios} exercício(s)</span>
              {treino.grupos.length ? <span>{treino.grupos.join(" · ")}</span> : null}
            </div>
          </div>

          <div className="hidden w-40 shrink-0 flex-col lg:flex">
            <span className="text-xs text-muted-foreground">Exercícios</span>
            <span className="truncate text-sm">
              {treino.totalExercicios > 0
                ? `${treino.totalExercicios} · ${treino.grupos.join(", ") || "—"}`
                : "Nenhum ainda"}
            </span>
          </div>

          <div className="hidden w-36 shrink-0 flex-col lg:flex">
            <span className="text-xs text-muted-foreground">Última execução</span>
            <span className="truncate text-sm">
              {treino.ultimaExecucao ? formatarDataRelativa(treino.ultimaExecucao) : "—"}
            </span>
          </div>

          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </CardContent>
    </Card>
  );
}
