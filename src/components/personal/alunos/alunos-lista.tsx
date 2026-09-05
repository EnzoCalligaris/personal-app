"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CopyIcon,
  DumbbellIcon,
  SearchIcon,
  UserPlusIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import {
  diaSemanaLabel,
  formatarData,
  formatarDataRelativa,
  formatarPeso,
  iniciais,
} from "@/lib/format";
import { toast } from "@/lib/toast";
import type { AlunoListItem, AlunoListResponse } from "@/types/aluno";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { SkeletonList } from "@/components/ui/loading";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlunoFormModal } from "@/components/personal/alunos/aluno-form-modal";

type Filtro = "TODOS" | "ATIVO" | "INATIVO";
type OrdenarPor = "recentes" | "nome";

const ORDENACAO_LABEL: Record<OrdenarPor, string> = {
  recentes: "Mais recentes",
  nome: "Nome (A-Z)",
};

export function AlunosLista() {
  const [busca, setBusca] = React.useState("");
  const [buscaAplicada, setBuscaAplicada] = React.useState("");
  const [filtro, setFiltro] = React.useState<Filtro>("TODOS");
  const [ordenar, setOrdenar] = React.useState<OrdenarPor>("recentes");
  const [modalAberto, setModalAberto] = React.useState(false);
  const [senhaGerada, setSenhaGerada] = React.useState<{ senha: string; nome: string } | null>(null);

  // Debounce da busca: evita uma requisição por tecla digitada.
  React.useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => clearTimeout(timer);
  }, [busca]);

  const url = React.useMemo(() => {
    const params = new URLSearchParams({ status: filtro, ordenar });
    if (buscaAplicada) params.set("q", buscaAplicada);
    return `/api/personal/alunos?${params.toString()}`;
  }, [buscaAplicada, filtro, ordenar]);

  const { data, loading, error, refetch } = useApi<AlunoListResponse>(url);

  const contagens = data?.contagens;
  const buscando = busca !== buscaAplicada;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Gestão"
        title="Alunos"
        description="Cadastre, acompanhe e mantenha os dados dos seus alunos em dia."
        actions={
          <Button onClick={() => setModalAberto(true)}>
            <UserPlusIcon />
            Novo aluno
          </Button>
        }
      />

      {/* Busca e filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar alunos"
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
          <Tabs value={filtro} onValueChange={(valor) => setFiltro(valor as Filtro)}>
            <TabsList>
              <TabsTrigger value="TODOS">
                Todos{contagens ? ` (${contagens.todos})` : ""}
              </TabsTrigger>
              <TabsTrigger value="ATIVO">
                Ativos{contagens ? ` (${contagens.ativos})` : ""}
              </TabsTrigger>
              <TabsTrigger value="INATIVO">
                Inativos{contagens ? ` (${contagens.inativos})` : ""}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={ordenar} onValueChange={(valor) => setOrdenar(valor as OrdenarPor)}>
            <SelectTrigger size="sm" aria-label="Ordenar alunos" className="w-[160px]">
              {/* O Base UI mostra o valor cru por padrão - mapeamos para o rótulo. */}
              <SelectValue>{(valor) => ORDENACAO_LABEL[valor as OrdenarPor]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Mais recentes</SelectItem>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading || buscando ? <SkeletonList items={4} /> : null}

      {error && !loading ? (
        <ErrorState
          title="Não foi possível carregar os alunos"
          description="Houve um problema ao buscar a lista. Tente novamente."
          detail={error}
          onRetry={refetch}
        />
      ) : null}

      {data && !loading && !buscando ? (
        data.alunos.length === 0 ? (
          buscaAplicada || filtro !== "TODOS" ? (
            <EmptyState
              icon={SearchIcon}
              title="Nenhum aluno encontrado"
              description="Nenhum aluno corresponde à busca ou ao filtro selecionado."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setBusca("");
                    setFiltro("TODOS");
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={UsersRoundIcon}
              title="Nenhum aluno cadastrado"
              description="Cadastre seu primeiro aluno para montar treinos e acompanhar a evolução dele."
              action={
                <Button onClick={() => setModalAberto(true)}>
                  <UserPlusIcon />
                  Cadastrar aluno
                </Button>
              }
            />
          )
        ) : (
          <ul className="flex flex-col gap-3">
            {data.alunos.map((aluno) => (
              <li key={aluno.id}>
                <LinhaAluno aluno={aluno} />
              </li>
            ))}
          </ul>
        )
      ) : null}

      <AlunoFormModal
        open={modalAberto}
        onOpenChange={setModalAberto}
        onSaved={() => refetch()}
        onCreated={(senha, aluno) => setSenhaGerada({ senha, nome: aluno.nome })}
      />

      <Modal
        open={!!senhaGerada}
        onOpenChange={(aberto) => !aberto && setSenhaGerada(null)}
        title="Aluno cadastrado"
        description={`Repasse estes dados para ${senhaGerada?.nome ?? ""} fazer o primeiro acesso. A senha não será exibida novamente.`}
        footer={
          <Button onClick={() => setSenhaGerada(null)}>Entendi</Button>
        }
      >
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
          <code className="font-mono text-sm">{senhaGerada?.senha}</code>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(senhaGerada?.senha ?? "");
              toast.success("Senha copiada");
            }}
          >
            <CopyIcon />
            Copiar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function LinhaAluno({ aluno }: { aluno: AlunoListItem }) {
  const inativo = aluno.status === "INATIVO";

  return (
    <Card size="sm" interactive className={cn("transition-opacity", inativo && "opacity-70")}>
      <CardContent>
        <Link
          href={`/personal/alunos/${aluno.id}`}
          className="flex items-center gap-3 outline-none sm:gap-4"
        >
          <Avatar size="lg">
            {aluno.avatarUrl ? <AvatarImage src={aluno.avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary/15 font-medium text-primary dark:bg-primary/20">
              {iniciais(aluno.nome)}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{aluno.nome}</span>
              <Badge variant={inativo ? "secondary" : "success"} className="shrink-0">
                {inativo ? "Inativo" : "Ativo"}
              </Badge>
            </div>
            <span className="truncate text-xs text-muted-foreground">{aluno.email}</span>

            {/* Detalhes empilhados no mobile */}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground lg:hidden">
              <span className="inline-flex items-center gap-1">
                <DumbbellIcon className="size-3" />
                {aluno.proximoTreino
                  ? `${aluno.proximoTreino.nome} · ${diaSemanaLabel(aluno.proximoTreino.diaSemana)}`
                  : "Sem treino"}
              </span>
              <span>
                {aluno.ultimaAvaliacao
                  ? `Avaliação ${formatarDataRelativa(aluno.ultimaAvaliacao.data)}`
                  : "Sem avaliação"}
              </span>
            </div>
          </div>

          {/* Colunas no desktop */}
          <div className="hidden w-44 shrink-0 flex-col lg:flex">
            <span className="text-xs text-muted-foreground">Próximo treino</span>
            <span className="truncate text-sm">
              {aluno.proximoTreino
                ? `${aluno.proximoTreino.nome} · ${diaSemanaLabel(aluno.proximoTreino.diaSemana)}`
                : "—"}
            </span>
          </div>

          <div className="hidden w-36 shrink-0 flex-col lg:flex">
            <span className="text-xs text-muted-foreground">Última avaliação</span>
            <span className="truncate text-sm">
              {aluno.ultimaAvaliacao
                ? `${formatarData(aluno.ultimaAvaliacao.data)}${
                    aluno.ultimaAvaliacao.peso
                      ? ` · ${formatarPeso(aluno.ultimaAvaliacao.peso)}`
                      : ""
                  }`
                : "—"}
            </span>
          </div>

          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </CardContent>
    </Card>
  );
}
