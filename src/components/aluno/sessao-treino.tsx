"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DumbbellIcon,
  FlagIcon,
  PlusIcon,
  TimerIcon,
  TrophyIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatarCronometro } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { ExecucaoRegistrada, MeuTreinoDetalhe } from "@/types/aluno-area";
import type { TreinoItemExercicio } from "@/types/treino";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalClose } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

/** Descanso assumido quando o Personal não definiu um para o exercício. */
const DESCANSO_PADRAO_SEG = 60;

type RegistroExercicio = {
  seriesFeitas: number;
  carga: string;
  repeticoes: string;
  concluido: boolean;
};

type EstadoSalvo = {
  iniciadoEm: number;
  indice: number;
  registro: Record<string, RegistroExercicio>;
};

function chaveDaSessao(treinoId: string) {
  return `pulse:sessao:${treinoId}`;
}

/**
 * Sessão de treino: uma tela por exercício, pensada para ser usada com o
 * celular na mão entre as séries - alvos grandes, cronômetro de descanso e o
 * progresso sempre visível.
 *
 * O andamento é guardado no `localStorage`: recarregar a página no meio do
 * treino (ou o navegador descartar a aba) não perde as séries já feitas.
 */
export function SessaoTreino({ treinoId }: { treinoId: string }) {
  const router = useRouter();
  const { data, loading, error, refetch } = useApi<MeuTreinoDetalhe>(
    `/api/aluno/treinos/${treinoId}`
  );

  // A sessão anterior (se houver) é lida uma única vez, na montagem: assim o
  // estado já nasce restaurado, sem um efeito que dispara re-render.
  const [salvo] = React.useState(() => lerEstado(treinoId));
  const [iniciadoEm] = React.useState(() => salvo?.iniciadoEm ?? Date.now());
  const [indiceEscolhido, setIndice] = React.useState(() => salvo?.indice ?? 0);
  const [ajustes, setAjustes] = React.useState<Record<string, RegistroExercicio>>(
    () => salvo?.registro ?? {}
  );

  const [descansoAte, setDescansoAte] = React.useState<number | null>(null);
  const [descansoTotal, setDescansoTotal] = React.useState(0);

  const [etapa, setEtapa] = React.useState<"treinando" | "resumo">("treinando");
  const [observacoes, setObservacoes] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);
  const [concluida, setConcluida] = React.useState<ExecucaoRegistrada | null>(null);
  const [confirmandoSaida, setConfirmandoSaida] = React.useState(false);

  const exercicios = React.useMemo(() => data?.exercicios ?? [], [data]);

  // O que a ficha prescreve é a base; o que o aluno marcou fica por cima.
  // Exercícios que o Personal adicionou depois entram com os valores da ficha.
  const registro = React.useMemo(
    () => ({ ...estadoInicial(exercicios), ...ajustes }),
    [exercicios, ajustes]
  );
  const indice = Math.min(indiceEscolhido, Math.max(exercicios.length - 1, 0));

  // Persiste o andamento a cada mudança relevante.
  React.useEffect(() => {
    if (!data || concluida) return;
    salvarEstado(treinoId, { iniciadoEm, indice, registro });
  }, [data, iniciadoEm, indice, registro, treinoId, concluida]);

  const decorridoSeg = useCronometro(concluida ? null : iniciadoEm);
  const descansoRestante = useContagemRegressiva(descansoAte, () => {
    setDescansoAte(null);
    // Vibração curta: o aluno pode estar com o celular no bolso.
    navigator.vibrate?.([120, 60, 120]);
  });

  const atual = exercicios[indice];
  const registroAtual = atual ? registro[atual.id] : undefined;
  const feitos = exercicios.filter((item) => registro[item.id]?.concluido).length;
  const total = exercicios.length;

  function atualizarRegistro(id: string, mudanca: Partial<RegistroExercicio>) {
    setAjustes((atual) => ({ ...atual, [id]: { ...registro[id], ...mudanca } }));
  }

  function iniciarDescanso(segundos: number) {
    if (segundos <= 0) return;
    setDescansoTotal(segundos);
    setDescansoAte(Date.now() + segundos * 1000);
  }

  /** Marca (ou desmarca) uma série e dispara o descanso quando faz sentido. */
  function alternarSerie(item: TreinoItemExercicio, numero: number) {
    const feitasAgora = registro[item.id]?.seriesFeitas ?? 0;
    const novas = feitasAgora >= numero ? numero - 1 : numero;
    atualizarRegistro(item.id, { seriesFeitas: novas });

    // Descansa entre séries, não depois da última (aí vem o próximo exercício).
    if (novas > feitasAgora && novas < item.series) {
      iniciarDescanso(item.descansoSeg ?? DESCANSO_PADRAO_SEG);
    }
  }

  function concluirExercicio() {
    if (!atual) return;

    atualizarRegistro(atual.id, {
      concluido: true,
      seriesFeitas: Math.max(registro[atual.id]?.seriesFeitas ?? 0, atual.series),
    });

    const ehUltimo = indice >= total - 1;
    if (ehUltimo) {
      setDescansoAte(null);
      setEtapa("resumo");
      return;
    }

    setIndice(indice + 1);
    iniciarDescanso(atual.descansoSeg ?? DESCANSO_PADRAO_SEG);
  }

  async function finalizar() {
    if (!data) return;
    setSalvando(true);

    try {
      const res = await fetch(`/api/aluno/treinos/${treinoId}/execucoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observacoes: observacoes || null,
          duracaoSeg: decorridoSeg,
          itens: exercicios.map((item) => {
            const dados = registro[item.id];
            return {
              treinoExercicioId: item.id,
              concluido: dados?.concluido ?? false,
              series: dados?.concluido
                ? Math.max(dados.seriesFeitas, 1)
                : (dados?.seriesFeitas ?? 0),
              repeticoes: dados?.repeticoes || item.repeticoes,
              carga: dados?.carga || item.carga,
            };
          }),
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível registrar o treino.");
        return;
      }

      limparEstado(treinoId);
      setConcluida(body as ExecucaoRegistrada);
      navigator.vibrate?.([200, 80, 200]);
    } finally {
      setSalvando(false);
    }
  }

  function sair() {
    limparEstado(treinoId);
    router.push("/aluno");
  }

  if (error) {
    return (
      <ErrorState
        title="Não foi possível abrir este treino"
        description="A ficha pode ter sido alterada pelo seu Personal."
        detail={error}
        onRetry={refetch}
        action={
          <Button variant="outline" render={<Link href="/aluno/treinos" />}>
            Voltar para minhas fichas
          </Button>
        }
      />
    );
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (concluida) {
    return <TreinoConcluido execucao={concluida} />;
  }

  if (total === 0) {
    return (
      <EmptyState
        icon={DumbbellIcon}
        title="Esta ficha ainda não tem exercícios"
        description="Seu Personal ainda está montando este treino."
        action={
          <Button variant="outline" render={<Link href="/aluno/treinos" />}>
            Voltar
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-32 md:pb-6">
      <BarraDeProgresso
        nome={data.nome}
        feitos={feitos}
        total={total}
        decorridoSeg={decorridoSeg}
        onSair={() => setConfirmandoSaida(true)}
      />

      {etapa === "resumo" ? (
        <Resumo
          treino={data}
          registro={registro}
          decorridoSeg={decorridoSeg}
          observacoes={observacoes}
          onObservacoes={setObservacoes}
          onVoltar={() => setEtapa("treinando")}
          onFinalizar={finalizar}
          salvando={salvando}
        />
      ) : (
        <>
          <TrilhaExercicios
            exercicios={exercicios}
            registro={registro}
            indice={indice}
            onIr={setIndice}
          />

          {atual ? (
            <ExercicioAtual
              item={atual}
              posicao={indice + 1}
              total={total}
              registro={registroAtual}
              onSerie={(numero) => alternarSerie(atual, numero)}
              onCarga={(carga) => atualizarRegistro(atual.id, { carga })}
              onRepeticoes={(repeticoes) => atualizarRegistro(atual.id, { repeticoes })}
            />
          ) : null}

          <AcoesDaSessao
            temAnterior={indice > 0}
            ehUltimo={indice >= total - 1}
            concluido={registroAtual?.concluido ?? false}
            descansoRestante={descansoAte ? descansoRestante : null}
            descansoTotal={descansoTotal}
            onAnterior={() => setIndice(Math.max(indice - 1, 0))}
            onProximo={() => setIndice(Math.min(indice + 1, total - 1))}
            onConcluir={concluirExercicio}
            onFinalizar={() => setEtapa("resumo")}
            onMaisDescanso={() => setDescansoAte((atual) => (atual ?? Date.now()) + 15000)}
            onPularDescanso={() => setDescansoAte(null)}
          />
        </>
      )}

      <Modal
        open={confirmandoSaida}
        onOpenChange={setConfirmandoSaida}
        title="Sair do treino?"
        description="O que você marcou até aqui será descartado - nada será registrado no seu histórico."
        footer={
          <>
            <ModalClose render={<Button variant="ghost">Continuar treinando</Button>} />
            <Button variant="destructive" onClick={sair}>
              Sair sem registrar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Se você já fez parte do treino, prefira finalizar: os exercícios não marcados ficam
          registrados como não concluídos.
        </p>
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Topo: nome, progresso e cronômetro
   ------------------------------------------------------------------------- */

function BarraDeProgresso({
  nome,
  feitos,
  total,
  decorridoSeg,
  onSair,
}: {
  nome: string;
  feitos: number;
  total: number;
  decorridoSeg: number;
  onSair: () => void;
}) {
  const percentual = total === 0 ? 0 : Math.round((feitos / total) * 100);

  return (
    <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:px-6 md:top-0 md:mx-0 md:rounded-2xl md:border md:px-4 md:shadow-soft">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" aria-label="Sair do treino" onClick={onSair}>
          <XIcon />
        </Button>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{nome}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {feitos} / {total} exercícios
          </span>
        </div>

        <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 font-heading text-sm font-semibold tabular-nums">
          <ClockIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {formatarCronometro(decorridoSeg)}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percentual}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do treino"
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}

/** Trilha numerada: onde estou, o que já fiz e o que falta. */
function TrilhaExercicios({
  exercicios,
  registro,
  indice,
  onIr,
}: {
  exercicios: TreinoItemExercicio[];
  registro: Record<string, RegistroExercicio>;
  indice: number;
  onIr: (indice: number) => void;
}) {
  return (
    <nav aria-label="Exercícios do treino" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max gap-1.5">
        {exercicios.map((item, posicao) => {
          const feito = registro[item.id]?.concluido;
          const atual = posicao === indice;

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onIr(posicao)}
                aria-current={atual ? "step" : undefined}
                aria-label={`Exercício ${posicao + 1}: ${item.exercicio.nome}`}
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl text-sm font-semibold tabular-nums transition-all outline-none",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  atual
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : feito
                      ? "bg-success/15 text-success dark:bg-success/20"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {feito && !atual ? <CheckIcon className="size-4" /> : posicao + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* -------------------------------------------------------------------------
   Exercício atual
   ------------------------------------------------------------------------- */

function ExercicioAtual({
  item,
  posicao,
  total,
  registro,
  onSerie,
  onCarga,
  onRepeticoes,
}: {
  item: TreinoItemExercicio;
  posicao: number;
  total: number;
  registro: RegistroExercicio | undefined;
  onSerie: (numero: number) => void;
  onCarga: (carga: string) => void;
  onRepeticoes: (repeticoes: string) => void;
}) {
  const feitas = registro?.seriesFeitas ?? 0;

  return (
    <article className="flex animate-fade-up flex-col gap-4 overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-border">
      <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-primary/15 to-muted">
        {item.exercicio.imagemUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.exercicio.imagemUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-primary/40">
            <DumbbellIcon className="size-14" aria-hidden="true" />
          </span>
        )}

        <span className="absolute top-3 left-3 rounded-lg bg-background/85 px-2 py-1 text-xs font-semibold tabular-nums backdrop-blur-sm">
          {posicao} de {total}
        </span>

        {item.exercicio.videoUrl ? (
          <Button
            size="sm"
            variant="secondary"
            className="absolute right-3 bottom-3 shadow-soft"
            render={
              <a href={item.exercicio.videoUrl} target="_blank" rel="noreferrer">
                <VideoIcon />
                Ver vídeo
              </a>
            }
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="flex flex-col gap-1">
          <Badge variant="secondary" className="w-fit">
            {item.exercicio.grupoMuscular}
          </Badge>
          <h2 className="font-heading text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
            {item.exercicio.nome}
          </h2>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Prescricao rotulo="Séries" valor={String(item.series)} />
          <Prescricao rotulo="Repetições" valor={item.repeticoes} />
          <Prescricao rotulo="Carga" valor={item.carga ?? "livre"} />
          <Prescricao
            rotulo="Descanso"
            valor={item.descansoSeg ? `${item.descansoSeg}s` : `${DESCANSO_PADRAO_SEG}s`}
          />
        </dl>

        {item.observacoes ? (
          <p className="rounded-xl border-l-4 border-primary/50 bg-primary/[0.06] p-3 text-sm leading-relaxed dark:bg-primary/10">
            <span className="font-medium">Do seu Personal: </span>
            {item.observacoes}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Séries feitas · toque para marcar
          </span>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: item.series }).map((_, indice) => {
              const numero = indice + 1;
              const feita = numero <= feitas;

              return (
                <button
                  key={numero}
                  type="button"
                  onClick={() => onSerie(numero)}
                  aria-pressed={feita}
                  aria-label={`Série ${numero}`}
                  className={cn(
                    "flex h-12 min-w-12 flex-1 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold tabular-nums transition-all outline-none",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-95",
                    feita
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/20"
                  )}
                >
                  {feita ? <CheckIcon className="size-4" /> : null}
                  {numero}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carga-usada" className="text-xs">
              Carga usada
            </Label>
            <Input
              id="carga-usada"
              inputMode="text"
              placeholder={item.carga ?? "ex.: 40kg"}
              value={registro?.carga ?? ""}
              onChange={(evento) => onCarga(evento.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reps-feitas" className="text-xs">
              Repetições feitas
            </Label>
            <Input
              id="reps-feitas"
              inputMode="text"
              placeholder={item.repeticoes}
              value={registro?.repeticoes ?? ""}
              onChange={(evento) => onRepeticoes(evento.target.value)}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function Prescricao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-muted/60 px-3 py-2">
      <dt className="text-[0.7rem] text-muted-foreground">{rotulo}</dt>
      <dd className="font-heading text-sm font-semibold">{valor}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Barra de ações (fixa no mobile) + descanso
   ------------------------------------------------------------------------- */

function AcoesDaSessao({
  temAnterior,
  ehUltimo,
  concluido,
  descansoRestante,
  descansoTotal,
  onAnterior,
  onProximo,
  onConcluir,
  onFinalizar,
  onMaisDescanso,
  onPularDescanso,
}: {
  temAnterior: boolean;
  ehUltimo: boolean;
  concluido: boolean;
  descansoRestante: number | null;
  descansoTotal: number;
  onAnterior: () => void;
  onProximo: () => void;
  onConcluir: () => void;
  onFinalizar: () => void;
  onMaisDescanso: () => void;
  onPularDescanso: () => void;
}) {
  return (
    <div className="pb-safe fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-lg md:static md:rounded-2xl md:border md:px-4 md:shadow-soft">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2">
        {descansoRestante !== null ? (
          <Descanso
            restante={descansoRestante}
            total={descansoTotal}
            onMais={onMaisDescanso}
            onPular={onPularDescanso}
          />
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Exercício anterior"
            disabled={!temAnterior}
            onClick={onAnterior}
          >
            <ChevronLeftIcon />
          </Button>

          <Button size="lg" className="flex-1" onClick={onConcluir}>
            <CheckIcon />
            {ehUltimo ? "Concluir e finalizar" : "Concluir exercício"}
          </Button>

          {ehUltimo ? (
            <Button variant="outline" size="icon-lg" aria-label="Ir para o resumo" onClick={onFinalizar}>
              <FlagIcon />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Próximo exercício"
              onClick={onProximo}
            >
              <ChevronRightIcon />
            </Button>
          )}
        </div>

        {concluido ? (
          <span className="flex items-center justify-center gap-1.5 text-xs font-medium text-success">
            <CheckIcon className="size-3.5" />
            Exercício concluído
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Descanso({
  restante,
  total,
  onMais,
  onPular,
}: {
  restante: number;
  total: number;
  onMais: () => void;
  onPular: () => void;
}) {
  const percentual = total === 0 ? 0 : Math.max(0, Math.round((restante / total) * 100));

  return (
    <div className="flex animate-fade-up items-center gap-3 rounded-2xl bg-primary/12 px-3 py-2.5 ring-1 ring-primary/25 dark:bg-primary/16">
      <TimerIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium">Descanso</span>
          <span
            aria-live="polite"
            className="font-heading text-lg leading-none font-semibold tabular-nums text-primary"
          >
            {formatarCronometro(restante)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-primary/20">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${percentual}%` }}
          />
        </div>
      </div>

      <Button variant="ghost" size="sm" onClick={onMais} aria-label="Somar 15 segundos">
        <PlusIcon />
        15s
      </Button>
      <Button variant="ghost" size="sm" onClick={onPular}>
        Pular
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Resumo antes de registrar
   ------------------------------------------------------------------------- */

function Resumo({
  treino,
  registro,
  decorridoSeg,
  observacoes,
  onObservacoes,
  onVoltar,
  onFinalizar,
  salvando,
}: {
  treino: MeuTreinoDetalhe;
  registro: Record<string, RegistroExercicio>;
  decorridoSeg: number;
  observacoes: string;
  onObservacoes: (valor: string) => void;
  onVoltar: () => void;
  onFinalizar: () => void;
  salvando: boolean;
}) {
  const feitos = treino.exercicios.filter((item) => registro[item.id]?.concluido);
  const series = feitos.reduce(
    (total, item) => total + Math.max(registro[item.id]?.seriesFeitas ?? 0, 1),
    0
  );

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Fechar o treino</CardTitle>
          <CardDescription>Confira o que será registrado no seu histórico.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-3 gap-2">
            <Prescricao rotulo="Tempo" valor={formatarCronometro(decorridoSeg)} />
            <Prescricao
              rotulo="Exercícios"
              valor={`${feitos.length}/${treino.exercicios.length}`}
            />
            <Prescricao rotulo="Séries" valor={String(series)} />
          </dl>

          <ul className="flex flex-col divide-y divide-border">
            {treino.exercicios.map((item) => {
              const dados = registro[item.id];
              const feito = dados?.concluido ?? false;

              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs",
                      feito
                        ? "bg-success/15 text-success dark:bg-success/20"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {feito ? <CheckIcon className="size-3.5" /> : item.ordem}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("truncate text-sm", !feito && "text-muted-foreground")}>
                      {item.exercicio.nome}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {dados?.seriesFeitas ?? 0} de {item.series} séries ·{" "}
                      {dados?.repeticoes || item.repeticoes}
                      {dados?.carga || item.carga ? ` · ${dados?.carga || item.carga}` : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observacoes-treino">Como foi o treino? (opcional)</Label>
            <Textarea
              id="observacoes-treino"
              placeholder="Alguma dor, carga nova, algo que o Personal precisa saber?"
              value={observacoes}
              onChange={(evento) => onObservacoes(evento.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={onVoltar} disabled={salvando}>
              <ArrowLeftIcon />
              Voltar ao treino
            </Button>
            <Button size="lg" className="flex-1" onClick={onFinalizar} disabled={salvando}>
              <FlagIcon />
              {salvando ? "Registrando..." : "Finalizar treino"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Tela final
   ------------------------------------------------------------------------- */

function TreinoConcluido({ execucao }: { execucao: ExecucaoRegistrada }) {
  return (
    <div className="flex animate-fade-up flex-col items-center gap-6 py-6 text-center">
      <span
        aria-hidden="true"
        className="flex size-24 items-center justify-center rounded-full bg-primary/15 text-primary dark:bg-primary/20"
      >
        <TrophyIcon className="size-12" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight">
          Treino concluído! 🎉
        </h1>
        <p className="text-sm text-muted-foreground">
          {execucao.treino.nome} está registrado no seu histórico.
        </p>
      </div>

      <dl className="grid w-full max-w-md grid-cols-3 gap-2">
        <Prescricao
          rotulo="Tempo"
          valor={execucao.duracaoSeg ? formatarCronometro(execucao.duracaoSeg) : "--"}
        />
        <Prescricao
          rotulo="Exercícios"
          valor={`${execucao.exerciciosConcluidos}/${execucao.totalExercicios}`}
        />
        <Prescricao rotulo="Séries" valor={String(execucao.totalSeries)} />
      </dl>

      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <Button size="lg" className="flex-1" render={<Link href="/aluno" />}>
          Voltar ao início
        </Button>
        <Button size="lg" variant="outline" className="flex-1" render={<Link href="/aluno/historico" />}>
          Ver histórico
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Cronômetros e persistência
   ------------------------------------------------------------------------- */

/** Segundos decorridos desde `inicio` (null = parado). */
function useCronometro(inicio: number | null) {
  const [agora, setAgora] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (inicio === null) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inicio]);

  if (inicio === null) return 0;
  return Math.max(0, Math.floor((agora - inicio) / 1000));
}

/**
 * Contagem regressiva até um instante. Trabalhar com o alvo (e não com um
 * contador) mantém o tempo correto mesmo se o navegador engasgar o intervalo
 * com a tela bloqueada.
 */
function useContagemRegressiva(alvo: number | null, aoTerminar: () => void) {
  const [agora, setAgora] = React.useState(() => Date.now());
  const terminarRef = React.useRef(aoTerminar);

  React.useEffect(() => {
    terminarRef.current = aoTerminar;
  });

  React.useEffect(() => {
    if (alvo === null) return;

    const tique = setInterval(() => setAgora(Date.now()), 250);
    // O fim vem de um timeout, não da contagem: se o navegador engasgar o
    // intervalo com a tela bloqueada, o aviso ainda sai na hora certa.
    const fim = setTimeout(() => terminarRef.current(), Math.max(0, alvo - Date.now()));

    return () => {
      clearInterval(tique);
      clearTimeout(fim);
    };
  }, [alvo]);

  if (alvo === null) return 0;
  return Math.max(0, Math.ceil((alvo - agora) / 1000));
}

function estadoInicial(exercicios: TreinoItemExercicio[]): Record<string, RegistroExercicio> {
  return Object.fromEntries(
    exercicios.map((item) => [
      item.id,
      { seriesFeitas: 0, carga: item.carga ?? "", repeticoes: item.repeticoes, concluido: false },
    ])
  );
}

function lerEstado(treinoId: string): EstadoSalvo | null {
  try {
    const bruto = localStorage.getItem(chaveDaSessao(treinoId));
    if (!bruto) return null;

    const salvo = JSON.parse(bruto) as EstadoSalvo;
    // Sessão de mais de 6 horas é resto de um treino esquecido, não retomada.
    if (!salvo.iniciadoEm || Date.now() - salvo.iniciadoEm > 6 * 60 * 60 * 1000) {
      localStorage.removeItem(chaveDaSessao(treinoId));
      return null;
    }
    return salvo;
  } catch {
    return null;
  }
}

function salvarEstado(treinoId: string, estado: EstadoSalvo) {
  try {
    localStorage.setItem(chaveDaSessao(treinoId), JSON.stringify(estado));
  } catch {
    // Sem localStorage (aba anônima, cota cheia) a sessão segue só em memória.
  }
}

function limparEstado(treinoId: string) {
  try {
    localStorage.removeItem(chaveDaSessao(treinoId));
  } catch {
    // Nada a fazer.
  }
}
