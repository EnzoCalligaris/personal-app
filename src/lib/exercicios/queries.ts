import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  CriarExercicioInput,
  EditarExercicioInput,
  ListarExerciciosQuery,
} from "@/lib/validations/exercicio";
import type { ExercicioItem, ExercicioListResponse } from "@/types/exercicio";

type ExercicioRaw = {
  id: string;
  nome: string;
  grupoMuscular: string;
  descricao: string | null;
  videoUrl: string | null;
  imagemUrl: string | null;
  ativo: boolean;
  createdAt: Date;
  _count: { treinoExercicios: number };
};

const incluirContagem = { _count: { select: { treinoExercicios: true } } } as const;

function toItem(exercicio: ExercicioRaw): ExercicioItem {
  return {
    id: exercicio.id,
    nome: exercicio.nome,
    grupoMuscular: exercicio.grupoMuscular,
    descricao: exercicio.descricao,
    videoUrl: exercicio.videoUrl,
    imagemUrl: exercicio.imagemUrl,
    ativo: exercicio.ativo,
    criadoEm: exercicio.createdAt.toISOString(),
    usadoEmTreinos: exercicio._count.treinoExercicios,
  };
}

/** Biblioteca de exercícios do Personal, com busca, filtro e ordenação. */
export async function listarExercicios(
  personalId: string,
  query: ListarExerciciosQuery
): Promise<ExercicioListResponse> {
  const busca = query.q?.trim();

  const where = {
    personalId,
    ...(query.status === "ATIVOS" ? { ativo: true } : {}),
    ...(query.status === "ARQUIVADOS" ? { ativo: false } : {}),
    ...(query.grupo ? { grupoMuscular: query.grupo } : {}),
    ...(busca
      ? {
          OR: [
            { nome: { contains: busca, mode: "insensitive" as const } },
            { descricao: { contains: busca, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    query.ordenar === "recentes"
      ? ({ createdAt: "desc" } as const)
      : query.ordenar === "grupo"
        ? ([{ grupoMuscular: "asc" }, { nome: "asc" }] as const)
        : ({ nome: "asc" } as const);

  const [exercicios, total, todos, ativos, gruposRaw] = await Promise.all([
    prisma.exercicio.findMany({ where, include: incluirContagem, orderBy: [...[orderBy].flat()] }),
    prisma.exercicio.count({ where }),
    prisma.exercicio.count({ where: { personalId } }),
    prisma.exercicio.count({ where: { personalId, ativo: true } }),
    // Grupos existentes na biblioteca (respeitando o filtro de status).
    prisma.exercicio.groupBy({
      by: ["grupoMuscular"],
      where: {
        personalId,
        ...(query.status === "ATIVOS" ? { ativo: true } : {}),
        ...(query.status === "ARQUIVADOS" ? { ativo: false } : {}),
      },
      _count: { _all: true },
      orderBy: { grupoMuscular: "asc" },
    }),
  ]);

  return {
    exercicios: exercicios.map(toItem),
    total,
    contagens: { todos, ativos, arquivados: todos - ativos },
    grupos: gruposRaw.map((grupo) => ({
      nome: grupo.grupoMuscular,
      total: grupo._count._all,
    })),
  };
}

/** Busca um exercício garantindo que ele pertence a este Personal. */
export async function obterExercicio(
  personalId: string,
  exercicioId: string
): Promise<ExercicioItem | null> {
  const exercicio = await prisma.exercicio.findFirst({
    where: { id: exercicioId, personalId },
    include: incluirContagem,
  });

  return exercicio ? toItem(exercicio) : null;
}

export class NomeDuplicadoError extends Error {
  constructor() {
    super("Você já tem um exercício com esse nome.");
    this.name = "NomeDuplicadoError";
  }
}

async function nomeJaUsado(personalId: string, nome: string, ignorarId?: string) {
  const existente = await prisma.exercicio.findFirst({
    where: {
      personalId,
      nome: { equals: nome, mode: "insensitive" },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
    select: { id: true },
  });
  return !!existente;
}

export async function criarExercicio(
  personalId: string,
  input: CriarExercicioInput
): Promise<ExercicioItem> {
  if (await nomeJaUsado(personalId, input.nome)) throw new NomeDuplicadoError();

  const exercicio = await prisma.exercicio.create({
    data: {
      personalId,
      nome: input.nome,
      grupoMuscular: input.grupoMuscular,
      descricao: input.descricao || null,
      videoUrl: input.videoUrl || null,
    },
    include: incluirContagem,
  });

  return toItem(exercicio);
}

export async function atualizarExercicio(
  personalId: string,
  exercicioId: string,
  input: EditarExercicioInput
): Promise<ExercicioItem | null> {
  const atual = await prisma.exercicio.findFirst({
    where: { id: exercicioId, personalId },
    select: { id: true },
  });

  if (!atual) return null;

  if (input.nome && (await nomeJaUsado(personalId, input.nome, exercicioId))) {
    throw new NomeDuplicadoError();
  }

  const exercicio = await prisma.exercicio.update({
    where: { id: atual.id },
    data: {
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.grupoMuscular !== undefined ? { grupoMuscular: input.grupoMuscular } : {}),
      ...(input.descricao !== undefined ? { descricao: input.descricao || null } : {}),
      ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl || null } : {}),
      ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
    },
    include: incluirContagem,
  });

  return toItem(exercicio);
}

export class ExercicioEmUsoError extends Error {
  constructor(public readonly usos: number) {
    super(
      `Este exercício está em ${usos} treino(s). Arquive-o em vez de excluir para não alterar as fichas já montadas.`
    );
    this.name = "ExercicioEmUsoError";
  }
}

/**
 * Exclui um exercício - apenas se ele não estiver em nenhum treino. A FK de
 * `treino_exercicios` é em cascata: apagar um exercício em uso o removeria
 * silenciosamente das fichas dos alunos.
 */
export async function excluirExercicio(
  personalId: string,
  exercicioId: string
): Promise<"excluido" | "nao_encontrado"> {
  const exercicio = await prisma.exercicio.findFirst({
    where: { id: exercicioId, personalId },
    include: incluirContagem,
  });

  if (!exercicio) return "nao_encontrado";

  if (exercicio._count.treinoExercicios > 0) {
    throw new ExercicioEmUsoError(exercicio._count.treinoExercicios);
  }

  await prisma.exercicio.delete({ where: { id: exercicio.id } });
  return "excluido";
}
