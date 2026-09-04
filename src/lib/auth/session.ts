import "server-only";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/types";

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  personalProfileId: string | null;
  alunoProfileId: string | null;
};

/**
 * Resolve o usuário autenticado (via cookies de sessão do Supabase) e o seu
 * perfil de aplicação (role + ids de PersonalProfile/AlunoProfile). Retorna
 * `null` se não houver sessão válida.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const appUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      personalProfile: { select: { id: true } },
      alunoProfile: { select: { id: true } },
    },
  });

  if (!appUser) return null;

  return {
    userId: appUser.id,
    email: appUser.email,
    name: appUser.name,
    role: appUser.role,
    personalProfileId: appUser.personalProfile?.id ?? null,
    alunoProfileId: appUser.alunoProfile?.id ?? null,
  };
}
