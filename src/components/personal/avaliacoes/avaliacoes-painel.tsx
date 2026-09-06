"use client";

import * as React from "react";
import {
  ActivityIcon,
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  RulerIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatarDataCalendario, formatarDataRelativa, formatarVariacao, iniciais } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { Avaliacao, AvaliacaoListResponse } from "@/types/avaliacao";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Modal, ModalClose } from "@/components/ui/modal";
import { SkeletonList } from "@/components/ui/loading";
import { AvaliacaoFormModal } from "@/components/personal/avaliacoes/avaliacao-form-modal";

/** Ordem em que as medidas aparecem no detalhe. */
const MEDIDAS: { chave: keyof Avaliacao; rotulo: string; unidade: string }[] = [
  { chave: "peso", rotulo: "Peso", unidade: "kg" },
  { chave: "imc", rotulo: "IMC", unidade: "" },
  { chave: "percentualGordura", rotulo: "Gordura", unidade: "%" },
  { chave: "massaGorda", rotulo: "Massa de gordura", unidade: "kg" },
  { chave: "massaMuscular", rotulo: "Massa muscular", unidade: "kg" },
  { chave: "massaMagra", rotulo: "Massa magra", unidade: "kg" },
  { chave: "massaOssea", rotulo: "Massa óssea", unidade: "kg" },
  { chave: "aguaPercentual", rotulo: "Água", unidade: "%" },
  { chave: "aguaLitros", rotulo: "Água", unidade: "L" },
  { chave: "gorduraVisceral", rotulo: "Gordura visceral", unidade: "" },
  { chave: "metabolismoBasal", rotulo: "Metabolismo basal", unidade: "kcal" },
  { chave: "idadeMetabolica", rotulo: "Idade metabólica", unidade: "anos" },
];

const ROTULO_MEDIDA: Record<string, string> = {
  peito: "Peito",
  cintura: "Cintura",
  quadril: "Quadril",
  braco: "Braço",
  coxa: "Coxa",
  panturrilha: "Panturrilha",
};

function valorFormatado(avaliacao: Avaliacao, chave: keyof Avaliacao, unidade: string) {
  const valor = avaliacao[chave];
  if (typeof valor !== "number") return null;
  return `${valor.toLocaleString("pt-BR")}${unidade ? ` ${unidade}` : ""}`;
}

/**
 * Lista de avaliações com criar, corrigir, ver e excluir. Serve à página de
 * avaliações e à aba de bioimpedância da ficha do aluno - a diferença é o
 * `alunoFixo`, que trava o filtro e o formulário em um aluno só.
 */
export function AvaliacoesPainel({
  alunoFixo,
  onMudou,
}: {
  alunoFixo?: { id: string; nome: string } | null;
  onMudou?: () => void;
}) {
  const [busca, setBusca] = React.useState("");
  const [filtroAluno, setFiltroAluno] = React.useState<string | null>(null);
  const [versao, setVersao] = React.useState(0);

  const [criando, setCriando] = React.useState(false);
  const [editando, setEditando] = React.useState<Avaliacao | null>(null);
  const [excluindo, setExcluindo] = React.useState<Avaliacao | null>(null);

  const alunoId = alunoFixo?.id ?? filtroAluno;
  const parametros = new URLSearchParams();
  if (alunoId) parametros.set("alunoId", alunoId);
  if (!alunoFixo && busca.trim()) parametros.set("q", busca.trim());
  parametros.set("v", String(versao));

  const { data, loading, error, refetch } = useApi<AvaliacaoListResponse>(
    `/api/personal/avaliacoes?${parametros.toString()}`
  );

  function atualizar() {
    setVersao((valor) => valor + 1);
    onMudou?.();
  }

  async function excluir() {
    if (!excluindo) return;

    const res = await fetch(`/api/personal/avaliacoes/${excluindo.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Não foi possível excluir a avaliação.");
      return;
    }

    toast.success("Avaliação excluída.");
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
              aria-label="Buscar por aluno"
              placeholder="Buscar por aluno"
              className="pl-9"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>
        ) : null}

        <Button onClick={() => setCriando(true)}>
          <PlusIcon />
          Nova avaliação
        </Button>
      </div>

      {!alunoFixo && data && data.alunos.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          <BotaoFiltro
            ativo={filtroAluno === null}
            onClick={() => setFiltroAluno(null)}
            rotulo="Todos"
            total={data.alunos.reduce((soma, aluno) => soma + aluno.total, 0)}
          />
          {data.alunos.map((aluno) => (
            <BotaoFiltro
              key={aluno.id}
              ativo={filtroAluno === aluno.id}
              onClick={() => setFiltroAluno(aluno.id)}
              rotulo={aluno.nome}
              total={aluno.total}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <ErrorState title="Não foi possível carregar as avaliações" detail={error} onRetry={refetch} />
      ) : loading || !data ? (
        <SkeletonList items={3} />
      ) : data.avaliacoes.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="Nenhuma avaliação registrada"
          description={
            alunoFixo
              ? "Registre a primeira bioimpedância deste aluno para acompanhar a evolução dele."
              : "Registre a primeira avaliação para acompanhar a evolução dos seus alunos."
          }
          action={
            <Button onClick={() => setCriando(true)}>
              <PlusIcon />
              Nova avaliação
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.avaliacoes.map((avaliacao) => (
            <li key={avaliacao.id}>
              <CartaoAvaliacao
                avaliacao={avaliacao}
                mostrarAluno={!alunoFixo}
                onEditar={() => setEditando(avaliacao)}
                onExcluir={() => setExcluindo(avaliacao)}
              />
            </li>
          ))}
        </ul>
      )}

      <AvaliacaoFormModal
        open={criando || editando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setCriando(false);
            setEditando(null);
          }
        }}
        avaliacao={editando}
        alunoFixo={alunoFixo}
        onSalvo={() => {
          setCriando(false);
          setEditando(null);
          atualizar();
        }}
      />

      <Modal
        open={excluindo !== null}
        onOpenChange={(aberto) => !aberto && setExcluindo(null)}
        title="Excluir avaliação?"
        description={
          excluindo
            ? `${excluindo.aluno.nome} · ${formatarDataCalendario(excluindo.data)}`
            : undefined
        }
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
          A avaliação sai do histórico do aluno e dos gráficos de evolução. Se foi só um erro de
          digitação, prefira corrigir a avaliação.
        </p>
      </Modal>
    </div>
  );
}

function BotaoFiltro({
  ativo,
  onClick,
  rotulo,
  total,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  total: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40",
        ativo
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {rotulo}
      <span className={cn("tabular-nums", ativo ? "text-primary-foreground/80" : "")}>{total}</span>
    </button>
  );
}

function CartaoAvaliacao({
  avaliacao,
  mostrarAluno,
  onEditar,
  onExcluir,
}: {
  avaliacao: Avaliacao;
  mostrarAluno: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const [aberto, setAberto] = React.useState(false);

  const preenchidas = MEDIDAS.map((medida) => ({
    ...medida,
    valor: valorFormatado(avaliacao, medida.chave, medida.unidade),
  })).filter((medida) => medida.valor !== null);

  const medidas = avaliacao.medidas ? Object.entries(avaliacao.medidas) : [];
  const destaques = preenchidas.slice(0, 3);

  return (
    <article className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-border">
      <div className="flex flex-wrap items-center gap-3 p-4">
        {mostrarAluno ? (
          <Avatar>
            {avaliacao.aluno.avatarUrl ? (
              <AvatarImage src={avaliacao.aluno.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary dark:bg-primary/20">
              {iniciais(avaliacao.aluno.nome)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary dark:bg-primary/18"
          >
            <ActivityIcon className="size-5" />
          </span>
        )}

        <div className="flex min-w-40 flex-1 flex-col">
          {mostrarAluno ? (
            <span className="truncate font-medium">{avaliacao.aluno.nome}</span>
          ) : null}
          <span className={cn("text-sm", mostrarAluno && "text-muted-foreground")}>
            {formatarDataCalendario(avaliacao.data)} · {formatarDataRelativa(avaliacao.data)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {destaques.map((medida) => (
            <Badge key={`${medida.chave}-${medida.unidade}`} variant="outline">
              {medida.rotulo}: {medida.valor}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Corrigir avaliação" onClick={onEditar}>
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Excluir avaliação"
            onClick={onExcluir}
          >
            <Trash2Icon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={aberto ? "Fechar detalhes" : "Ver detalhes"}
            aria-expanded={aberto}
            onClick={() => setAberto((valor) => !valor)}
          >
            <ChevronDownIcon className={cn("transition-transform", aberto && "rotate-180")} />
          </Button>
        </div>
      </div>

      {avaliacao.variacao &&
      (avaliacao.variacao.peso !== null ||
        avaliacao.variacao.percentualGordura !== null ||
        avaliacao.variacao.massaMuscular !== null) ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border bg-muted/25 px-4 py-2">
          <span className="text-xs text-muted-foreground">Desde a anterior:</span>
          <Variacao rotulo="peso" valor={avaliacao.variacao.peso} unidade="kg" menorMelhor />
          <Variacao
            rotulo="gordura"
            valor={avaliacao.variacao.percentualGordura}
            unidade="%"
            menorMelhor
          />
          <Variacao
            rotulo="músculo"
            valor={avaliacao.variacao.massaMuscular}
            unidade="kg"
            menorMelhor={false}
          />
        </div>
      ) : null}

      {aberto ? (
        <div className="flex flex-col gap-3 border-t border-border bg-muted/25 p-4">
          {preenchidas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta avaliação foi registrada sem medidas da balança.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {preenchidas.map((medida) => (
                <div key={`${medida.chave}-${medida.unidade}`} className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">{medida.rotulo}</dt>
                  <dd className="font-heading text-sm font-semibold tabular-nums">
                    {medida.valor}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {medidas.length ? (
            <div className="flex flex-wrap gap-1.5">
              {medidas.map(([nome, valor]) => (
                <Badge key={nome} variant="secondary" className="gap-1">
                  <RulerIcon className="size-3" />
                  {ROTULO_MEDIDA[nome] ?? nome} {valor} cm
                </Badge>
              ))}
            </div>
          ) : null}

          {avaliacao.observacoes ? (
            <p className="rounded-xl bg-card p-3 text-sm leading-relaxed ring-1 ring-border">
              {avaliacao.observacoes}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Variacao({
  rotulo,
  valor,
  unidade,
  menorMelhor,
}: {
  rotulo: string;
  valor: number | null;
  unidade: string;
  menorMelhor: boolean;
}) {
  if (valor === null) return null;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        valor === 0
          ? "bg-muted text-muted-foreground"
          : valor < 0 === menorMelhor
            ? "bg-success/12 text-success dark:bg-success/18"
            : "bg-warning/15 text-warning dark:bg-warning/20"
      )}
    >
      {rotulo} {formatarVariacao(valor)} {unidade}
    </span>
  );
}
