import "server-only";

import { prisma } from "@/lib/prisma";
import type { EditarMeuPerfilPersonalInput } from "@/lib/validations/perfil";

export type MeuPerfilPersonal = {
  nome: string;
  email: string;
  telefone: string | null;
  avatarUrl: string | null;
  cref: string | null;
  bio: string | null;
  membroDesde: string;
  /** Números que dão contexto ao perfil. */
  resumo: { alunos: number; alunosAtivos: number; treinos: number };
};

export async function meuPerfilPersonal(personalId: string): Promise<MeuPerfilPersonal | null> {
  const perfil = await prisma.personalProfile.findUnique({
    where: { id: personalId },
    include: {
      user: { select: { name: true, email: true, phone: true, avatarUrl: true, createdAt: true } },
      _count: { select: { alunos: true, treinos: true } },
    },
  });

  if (!perfil) return null;

  const alunosAtivos = await prisma.alunoProfile.count({
    where: { personalId, status: "ATIVO" },
  });

  return {
    nome: perfil.user.name,
    email: perfil.user.email,
    telefone: perfil.user.phone,
    avatarUrl: perfil.user.avatarUrl,
    cref: perfil.cref,
    bio: perfil.bio,
    membroDesde: perfil.user.createdAt.toISOString(),
    resumo: {
      alunos: perfil._count.alunos,
      alunosAtivos,
      treinos: perfil._count.treinos,
    },
  };
}

/** Nome e telefone ficam no usuário; CREF e bio, no perfil profissional. */
export async function atualizarMeuPerfilPersonal(
  personalId: string,
  input: EditarMeuPerfilPersonalInput
): Promise<MeuPerfilPersonal | null> {
  const perfil = await prisma.personalProfile.findUnique({
    where: { id: personalId },
    select: { id: true, userId: true },
  });
  if (!perfil) return null;

  await prisma.$transaction(async (tx) => {
    if (input.nome !== undefined || input.telefone !== undefined) {
      await tx.user.update({
        where: { id: perfil.userId },
        data: {
          ...(input.nome !== undefined ? { name: input.nome } : {}),
          ...(input.telefone !== undefined ? { phone: input.telefone || null } : {}),
        },
      });
    }

    if (input.cref !== undefined || input.bio !== undefined) {
      await tx.personalProfile.update({
        where: { id: perfil.id },
        data: {
          ...(input.cref !== undefined ? { cref: input.cref || null } : {}),
          ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
        },
      });
    }
  });

  return meuPerfilPersonal(personalId);
}
