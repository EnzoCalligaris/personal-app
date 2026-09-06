import "server-only";
import { prisma } from "@/lib/prisma";
import { notificar } from "@/lib/notificacoes/enviar";
import { DIAS_SEMANA, hojeUTC } from "@/lib/date-utils";
import type { DiaSemana } from "@/types";
import type { Prisma } from "@prisma/client";
import type {
  AdicionarExercicioInput,
  CriarTreinoInput,
  DuplicarTreinoInput,
  EditarItemTreinoInput,
  EditarTreinoInput,
  ListarTreinosQuery,
} from "@/lib/validations/treino";
import type {
  TreinoDetalhe,
  TreinoItemExercicio,
  TreinoListItem,
  TreinoListResponse,
} from "@/types/treino";

export class AlunoNaoEncontradoError extends Error {
  constructor() {
    super("Aluno não encontrado.");
    this.name = "AlunoNaoEncontradoError";
  }
}

export class ExercicioNaoEncontradoError extends Error {
  constructor() {
    super("Exercício não encontrado na sua biblioteca.");
    this.name = "ExercicioNaoEncontradoError";
  }
}

export class ItemNaoEncontradoError extends Error {
  constructor() {
    super("Exercício não encontrado neste treino.");
    this.name = "ItemNaoEncontradoError";
  }
}

/**
 * Garante que o aluno é deste Personal. É o que impede associar um treino a
 * aluno de outro profissional.
 */
async function garantirAlunoDoPersonal(personalId: string, alunoId: string) {
  const aluno = await prisma.alunoProfile.findFirst({
    where: { id: alunoId, personalId },
    select: { id: true },
  });
  if (!aluno) throw new AlunoNaoEncontradoError();
  return aluno;
}

/** Garante que o exercício pertence à biblioteca deste Personal. */
async function garantirExercicioDoPersonal(personalId: string, exercicioId: string) {
  const exercicio = await prisma.exercicio.findFirst({
    where: { id: exercicioId, personalId },
    select: { id: true },
  });
  if (!exercicio) throw new ExercicioNaoEncontradoError();
  return exercicio;
}

/**
 * Dias em que o treino está prescrito na programação que vale hoje. O dia da
 * semana não é mais um campo do treino: quem define isso é a programação.
 */
export function incluirDiasProgramados(hoje: Date) {
  return {
    where: {
      programacao: {
        dataInicio: { lte: hoje },
        OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
      },
    },
    select: { diaSemana: true },
  } satisfies Prisma.Treino$diasProgramadosArgs;
}

function includeResumoCom(hoje: Date) {
  return {
    aluno: { include: { user: { select: { name: true, avatarUrl: true } } } },
    exercicios: {
      select: { exercicio: { select: { grupoMuscular: true } } },
      orderBy: { ordem: "asc" },
    },
    historico: { select: { dataExecucao: true }, orderBy: { dataExecucao: "desc" }, take: 1 },
    diasProgramados: incluirDiasProgramados(hoje),
    _count: { select: { exercicios: true } },
  } satisfies Prisma.TreinoInclude;
}

type TreinoResumoRaw = Prisma.TreinoGetPayload<{
  include: ReturnType<typeof includeResumoCom>;
}>;

/** Ordena os dias na sequência da semana (domingo -> sábado). */
export function ordenarDias(dias: { diaSemana: DiaSemana }[]): DiaSemana[] {
  return DIAS_SEMANA.filter((dia) => dias.some((item) => item.diaSemana === dia));
}

function toListItem(treino: TreinoResumoRaw): TreinoListItem {
  return {
    id: treino.id,
    nome: treino.nome,
    diasProgramados: ordenarDias(treino.diasProgramados),
    observacoes: treino.observacoes,
    ativo: treino.ativo,
    criadoEm: treino.createdAt.toISOString(),
    aluno: {
      id: treino.alunoId,
      nome: treino.aluno.user.name,
      avatarUrl: treino.aluno.user.avatarUrl,
    },
    totalExercicios: treino._count.exercicios,
    grupos: [...new Set(treino.exercicios.map((item) => item.exercicio.grupoMuscular))],
    ultimaExecucao: treino.historico[0]?.dataExecucao.toISOString() ?? null,
  };
}

export async function listarTreinos(
  personalId: string,
  query: ListarTreinosQuery
): Promise<TreinoListResponse> {
  const busca = query.q?.trim();
  const hoje = hojeUTC();

  const where: Prisma.TreinoWhereInput = {
    personalId,
    ...(query.alunoId ? { alunoId: query.alunoId } : {}),
    ...(query.status === "ATIVOS" ? { ativo: true } : {}),
    ...(query.status === "INATIVOS" ? { ativo: false } : {}),
    ...(busca
      ? {
          OR: [
            { nome: { contains: busca, mode: "insensitive" } },
            { aluno: { user: { name: { contains: busca, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const escopoContagem: Prisma.TreinoWhereInput = {
    personalId,
    ...(query.alunoId ? { alunoId: query.alunoId } : {}),
  };

  const [treinos, total, todos, ativos] = await Promise.all([
    prisma.treino.findMany({
      where,
      include: includeResumoCom(hoje),
      orderBy: [{ ativo: "desc" }, { createdAt: "desc" }],
    }),
    prisma.treino.count({ where }),
    prisma.treino.count({ where: escopoContagem }),
    prisma.treino.count({ where: { ...escopoContagem, ativo: true } }),
  ]);

  return {
    treinos: treinos.map(toListItem),
    total,
    contagens: { todos, ativos, inativos: todos - ativos },
  };
}

export async function obterTreino(
  personalId: string,
  treinoId: string
): Promise<TreinoDetalhe | null> {
  const hoje = hojeUTC();

  const treino = await prisma.treino.findFirst({
    where: { id: treinoId, personalId },
    include: {
      ...includeResumoCom(hoje),
      exercicios: {
        include: {
          exercicio: {
            select: {
              id: true,
              nome: true,
              grupoMuscular: true,
              imagemUrl: true,
              videoUrl: true,
              ativo: true,
            },
          },
        },
        orderBy: { ordem: "asc" },
      },
    },
  });

  if (!treino) return null;

  const exercicios: TreinoItemExercicio[] = treino.exercicios.map((item) => ({
    id: item.id,
    ordem: item.ordem,
    series: item.series,
    repeticoes: item.repeticoes,
    carga: item.carga,
    descansoSeg: item.descansoSeg,
    observacoes: item.observacoes,
    exercicio: item.exercicio,
  }));

  return {
    id: treino.id,
    nome: treino.nome,
    diasProgramados: ordenarDias(treino.diasProgramados),
    observacoes: treino.observacoes,
    ativo: treino.ativo,
    criadoEm: treino.createdAt.toISOString(),
    aluno: {
      id: treino.alunoId,
      nome: treino.aluno.user.name,
      avatarUrl: treino.aluno.user.avatarUrl,
    },
    totalExercicios: treino._count.exercicios,
    grupos: [...new Set(exercicios.map((item) => item.exercicio.grupoMuscular))],
    ultimaExecucao: treino.historico[0]?.dataExecucao.toISOString() ?? null,
    exercicios,
  };
}

export async function criarTreino(
  personalId: string,
  input: CriarTreinoInput
): Promise<TreinoDetalhe> {
  await garantirAlunoDoPersonal(personalId, input.alunoId);

  const treino = await prisma.treino.create({
    data: {
      personalId,
      alunoId: input.alunoId,
      nome: input.nome,
      observacoes: input.observacoes || null,
    },
  });

  await notificar({
    tipo: "NOVO_TREINO",
    alunoId: input.alunoId,
    treino: { id: treino.id, nome: treino.nome },
  });

  return (await obterTreino(personalId, treino.id))!;
}

export async function atualizarTreino(
  personalId: string,
  treinoId: string,
  input: EditarTreinoInput
): Promise<TreinoDetalhe | null> {
  const treino = await prisma.treino.findFirst({
    where: { id: treinoId, personalId },
    select: { id: true, alunoId: true },
  });
  if (!treino) return null;

  // Transferir para outro aluno só vale se ele também for deste Personal.
  if (input.alunoId) await garantirAlunoDoPersonal(personalId, input.alunoId);

  const atualizado = await prisma.treino.update({
    where: { id: treino.id },
    data: {
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.observacoes !== undefined ? { observacoes: input.observacoes || null } : {}),
      ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
      ...(input.alunoId !== undefined ? { alunoId: input.alunoId } : {}),
    },
  });

  // O aviso vai para quem está com a ficha agora. Transferir o treino avisa o
  // novo dono - o antigo não precisa saber de um treino que não é mais dele.
  await notificar({
    tipo: "TREINO_ALTERADO",
    alunoId: atualizado.alunoId,
    treino: { id: atualizado.id, nome: atualizado.nome },
  });

  return obterTreino(personalId, treino.id);
}

export async function excluirTreino(
  personalId: string,
  treinoId: string
): Promise<"excluido" | "nao_encontrado"> {
  const treino = await prisma.treino.findFirst({
    where: { id: treinoId, personalId },
    select: { id: true },
  });
  if (!treino) return "nao_encontrado";

  // Os itens do treino e o histórico saem em cascata (definido no schema).
  await prisma.treino.delete({ where: { id: treino.id } });
  return "excluido";
}

export async function duplicarTreino(
  personalId: string,
  treinoId: string,
  input: DuplicarTreinoInput
): Promise<TreinoDetalhe | null> {
  const original = await prisma.treino.findFirst({
    where: { id: treinoId, personalId },
    include: { exercicios: { orderBy: { ordem: "asc" } } },
  });
  if (!original) return null;

  const alunoId = input.alunoId ?? original.alunoId;
  if (input.alunoId) await garantirAlunoDoPersonal(personalId, input.alunoId);

  const copia = await prisma.treino.create({
    data: {
      personalId,
      alunoId,
      nome: input.nome ?? `${original.nome} (cópia)`,
      observacoes: original.observacoes,
      exercicios: {
        create: original.exercicios.map((item) => ({
          exercicioId: item.exercicioId,
          ordem: item.ordem,
          series: item.series,
          repeticoes: item.repeticoes,
          carga: item.carga,
          descansoSeg: item.descansoSeg,
          observacoes: item.observacoes,
        })),
      },
    },
  });

  return obterTreino(personalId, copia.id);
}

export async function adicionarExercicio(
  personalId: string,
  treinoId: string,
  input: AdicionarExercicioInput
): Promise<TreinoDetalhe | null> {
  const treino = await prisma.treino.findFirst({
    where: { id: treinoId, personalId },
    select: { id: true },
  });
  if (!treino) return null;

  await garantirExercicioDoPersonal(personalId, input.exercicioId);

  const ultimo = await prisma.treinoExercicio.findFirst({
    where: { treinoId: treino.id },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  await prisma.treinoExercicio.create({
    data: {
      treinoId: treino.id,
      exercicioId: input.exercicioId,
      ordem: (ultimo?.ordem ?? 0) + 1,
      series: input.series,
      repeticoes: input.repeticoes,
      carga: input.carga || null,
      descansoSeg: input.descansoSeg ?? null,
      observacoes: input.observacoes || null,
    },
  });

  return obterTreino(personalId, treino.id);
}

export async function atualizarItem(
  personalId: string,
  treinoId: string,
  itemId: string,
  input: EditarItemTreinoInput
): Promise<TreinoDetalhe | null> {
  const item = await prisma.treinoExercicio.findFirst({
    where: { id: itemId, treinoId, treino: { personalId } },
    select: { id: true },
  });
  if (!item) throw new ItemNaoEncontradoError();

  await prisma.treinoExercicio.update({
    where: { id: item.id },
    data: {
      ...(input.series !== undefined ? { series: input.series } : {}),
      ...(input.repeticoes !== undefined ? { repeticoes: input.repeticoes } : {}),
      ...(input.carga !== undefined ? { carga: input.carga || null } : {}),
      ...(input.descansoSeg !== undefined ? { descansoSeg: input.descansoSeg ?? null } : {}),
      ...(input.observacoes !== undefined ? { observacoes: input.observacoes || null } : {}),
    },
  });

  return obterTreino(personalId, treinoId);
}

/**
 * Regrava as posições em duas fases. `treino_exercicios` tem UNIQUE
 * (treinoId, ordem) e o Postgres valida a cada linha atualizada: gravar as
 * posições finais direto colidiria no meio do caminho. Por isso passamos
 * primeiro por valores negativos, que nunca conflitam com os definitivos.
 */
async function regravarOrdem(tx: Prisma.TransactionClient, idsNaOrdem: string[]) {
  for (const [indice, id] of idsNaOrdem.entries()) {
    await tx.treinoExercicio.update({ where: { id }, data: { ordem: -(indice + 1) } });
  }
  for (const [indice, id] of idsNaOrdem.entries()) {
    await tx.treinoExercicio.update({ where: { id }, data: { ordem: indice + 1 } });
  }
}

export async function reordenarExercicios(
  personalId: string,
  treinoId: string,
  itens: string[]
): Promise<TreinoDetalhe | null> {
  const treino = await prisma.treino.findFirst({
    where: { id: treinoId, personalId },
    include: { exercicios: { select: { id: true } } },
  });
  if (!treino) return null;

  const idsAtuais = treino.exercicios.map((item) => item.id);
  const idsRecebidos = new Set(itens);

  // A nova ordem precisa conter exatamente os itens deste treino.
  if (
    itens.length !== idsAtuais.length ||
    idsRecebidos.size !== itens.length ||
    !idsAtuais.every((id) => idsRecebidos.has(id))
  ) {
    throw new ItemNaoEncontradoError();
  }

  await prisma.$transaction((tx) => regravarOrdem(tx, itens));

  return obterTreino(personalId, treinoId);
}

export async function removerItem(
  personalId: string,
  treinoId: string,
  itemId: string
): Promise<TreinoDetalhe | null> {
  const item = await prisma.treinoExercicio.findFirst({
    where: { id: itemId, treinoId, treino: { personalId } },
    select: { id: true },
  });
  if (!item) throw new ItemNaoEncontradoError();

  await prisma.$transaction(async (tx) => {
    await tx.treinoExercicio.delete({ where: { id: item.id } });

    // Renumera para as posições ficarem sempre 1..n, sem buracos.
    const restantes = await tx.treinoExercicio.findMany({
      where: { treinoId },
      orderBy: { ordem: "asc" },
      select: { id: true },
    });
    await regravarOrdem(
      tx,
      restantes.map((restante) => restante.id)
    );
  });

  return obterTreino(personalId, treinoId);
}
