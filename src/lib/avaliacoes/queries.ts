import "server-only";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { notificar } from "@/lib/notificacoes/enviar";
import type { Avaliacao, AvaliacaoListResponse } from "@/types/avaliacao";
import type {
  CriarAvaliacaoInput,
  EditarAvaliacaoInput,
  ListarAvaliacoesQuery,
} from "@/lib/validations/avaliacao";

/**
 * Avaliações de bioimpedância. Tudo é filtrado pelo `personalId` do Personal
 * autenticado, e o aluno precisa ser dele - avaliação de aluno alheio nunca é
 * criada nem encontrada.
 */

export class AlunoNaoEncontradoError extends Error {
  constructor() {
    super("Aluno não encontrado.");
    this.name = "AlunoNaoEncontradoError";
  }
}

const incluirAluno = {
  aluno: { include: { user: { select: { name: true, avatarUrl: true } } } },
} satisfies Prisma.AvaliacaoInclude;

type AvaliacaoRaw = Prisma.AvaliacaoGetPayload<{ include: typeof incluirAluno }>;

function toMedidas(valor: Prisma.JsonValue | null): Record<string, number> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;

  const medidas: Record<string, number> = {};
  for (const [chave, item] of Object.entries(valor)) {
    if (typeof item === "number") medidas[chave] = item;
  }
  return Object.keys(medidas).length ? medidas : null;
}

function diferenca(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null) return null;
  return Number((atual - anterior).toFixed(1));
}

function toAvaliacao(avaliacao: AvaliacaoRaw, anterior?: AvaliacaoRaw | null): Avaliacao {
  return {
    id: avaliacao.id,
    data: avaliacao.data.toISOString(),
    aluno: {
      id: avaliacao.alunoId,
      nome: avaliacao.aluno.user.name,
      avatarUrl: avaliacao.aluno.user.avatarUrl,
    },
    peso: avaliacao.peso,
    imc: avaliacao.imc,
    percentualGordura: avaliacao.percentualGordura,
    massaGorda: avaliacao.massaGorda,
    massaMagra: avaliacao.massaMagra,
    massaMuscular: avaliacao.massaMuscular,
    massaOssea: avaliacao.massaOssea,
    aguaPercentual: avaliacao.aguaPercentual,
    aguaLitros: avaliacao.aguaLitros,
    gorduraVisceral: avaliacao.gorduraVisceral,
    metabolismoBasal: avaliacao.metabolismoBasal,
    idadeMetabolica: avaliacao.idadeMetabolica,
    observacoes: avaliacao.observacoes,
    medidas: toMedidas(avaliacao.medidas),
    variacao: anterior
      ? {
          peso: diferenca(avaliacao.peso, anterior.peso),
          percentualGordura: diferenca(avaliacao.percentualGordura, anterior.percentualGordura),
          massaMuscular: diferenca(avaliacao.massaMuscular, anterior.massaMuscular),
        }
      : null,
  };
}

async function garantirAlunoDoPersonal(personalId: string, alunoId: string) {
  const aluno = await prisma.alunoProfile.findFirst({
    where: { id: alunoId, personalId },
    select: { id: true },
  });
  if (!aluno) throw new AlunoNaoEncontradoError();
  return aluno;
}

/** Data de calendário -> meio-dia local, para o dia não escorregar no fuso. */
function instanteDaData(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

/**
 * Cada avaliação sai com a variação em relação à anterior **do mesmo aluno** -
 * por isso a lista é agrupada antes de mapear.
 */
function comVariacao(avaliacoes: AvaliacaoRaw[]): Avaliacao[] {
  const porAluno = new Map<string, AvaliacaoRaw[]>();
  for (const item of avaliacoes) {
    porAluno.set(item.alunoId, [...(porAluno.get(item.alunoId) ?? []), item]);
  }

  // Dentro de cada aluno, a anterior é a próxima da lista (ordenada desc).
  const anteriorPorId = new Map<string, AvaliacaoRaw | null>();
  for (const doAluno of porAluno.values()) {
    doAluno.forEach((item, indice) => {
      anteriorPorId.set(item.id, doAluno[indice + 1] ?? null);
    });
  }

  return avaliacoes.map((item) => toAvaliacao(item, anteriorPorId.get(item.id)));
}

export async function listarAvaliacoes(
  personalId: string,
  query: ListarAvaliacoesQuery = {}
): Promise<AvaliacaoListResponse> {
  const busca = query.q?.trim();

  const where: Prisma.AvaliacaoWhereInput = {
    personalId,
    ...(query.alunoId ? { alunoId: query.alunoId } : {}),
    ...(busca
      ? { aluno: { user: { name: { contains: busca, mode: "insensitive" } } } }
      : {}),
  };

  const [avaliacoes, total, porAluno] = await Promise.all([
    prisma.avaliacao.findMany({
      where,
      include: incluirAluno,
      orderBy: [{ data: "desc" }, { id: "desc" }],
      take: 100,
    }),
    prisma.avaliacao.count({ where }),
    prisma.avaliacao.groupBy({
      by: ["alunoId"],
      where: { personalId },
      _count: { _all: true },
    }),
  ]);

  const nomes = await prisma.alunoProfile.findMany({
    where: { id: { in: porAluno.map((item) => item.alunoId) } },
    select: { id: true, user: { select: { name: true } } },
  });

  return {
    avaliacoes: comVariacao(avaliacoes),
    total,
    alunos: porAluno
      .map((item) => ({
        id: item.alunoId,
        nome: nomes.find((aluno) => aluno.id === item.alunoId)?.user.name ?? "Aluno",
        total: item._count._all,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

/** Histórico completo de um aluno, da mais recente para a mais antiga. */
export async function avaliacoesDoAluno(
  personalId: string,
  alunoId: string
): Promise<Avaliacao[]> {
  await garantirAlunoDoPersonal(personalId, alunoId);

  const avaliacoes = await prisma.avaliacao.findMany({
    where: { personalId, alunoId },
    include: incluirAluno,
    orderBy: [{ data: "desc" }, { id: "desc" }],
  });

  return comVariacao(avaliacoes);
}

export async function obterAvaliacao(
  personalId: string,
  avaliacaoId: string
): Promise<Avaliacao | null> {
  const avaliacao = await prisma.avaliacao.findFirst({
    where: { id: avaliacaoId, personalId },
    include: incluirAluno,
  });
  if (!avaliacao) return null;

  const anterior = await prisma.avaliacao.findFirst({
    where: { personalId, alunoId: avaliacao.alunoId, data: { lt: avaliacao.data } },
    include: incluirAluno,
    orderBy: { data: "desc" },
  });

  return toAvaliacao(avaliacao, anterior);
}

export async function criarAvaliacao(
  personalId: string,
  input: CriarAvaliacaoInput
): Promise<Avaliacao> {
  await garantirAlunoDoPersonal(personalId, input.alunoId);

  const { alunoId, data, observacoes, medidas, ...medidasDaBalanca } = input;

  const avaliacao = await prisma.avaliacao.create({
    data: {
      personalId,
      alunoId,
      ...(data ? { data: instanteDaData(data) } : {}),
      ...medidasDaBalanca,
      observacoes: observacoes?.trim() || null,
      medidas: medidas ?? undefined,
    },
    include: incluirAluno,
  });

  await notificar({
    tipo: "NOVA_AVALIACAO",
    alunoId,
    data: avaliacao.data.toISOString(),
  });

  return (await obterAvaliacao(personalId, avaliacao.id))!;
}

/** Corrigir uma avaliação é editá-la: nada é recriado. */
export async function atualizarAvaliacao(
  personalId: string,
  avaliacaoId: string,
  input: EditarAvaliacaoInput
): Promise<Avaliacao | null> {
  const atual = await prisma.avaliacao.findFirst({
    where: { id: avaliacaoId, personalId },
    select: { id: true },
  });
  if (!atual) return null;

  const { data, observacoes, medidas, ...medidasDaBalanca } = input;

  await prisma.avaliacao.update({
    where: { id: atual.id },
    data: {
      ...medidasDaBalanca,
      ...(data !== undefined ? { data: instanteDaData(data) } : {}),
      ...(observacoes !== undefined ? { observacoes: observacoes?.trim() || null } : {}),
      ...(medidas !== undefined ? { medidas: medidas ?? Prisma.DbNull } : {}),
    },
  });

  return obterAvaliacao(personalId, atual.id);
}

export async function excluirAvaliacao(
  personalId: string,
  avaliacaoId: string
): Promise<"excluida" | "nao_encontrada"> {
  const avaliacao = await prisma.avaliacao.findFirst({
    where: { id: avaliacaoId, personalId },
    select: { id: true },
  });
  if (!avaliacao) return "nao_encontrada";

  await prisma.avaliacao.delete({ where: { id: avaliacao.id } });
  return "excluida";
}
