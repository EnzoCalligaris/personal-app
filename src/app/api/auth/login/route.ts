import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import {
  chaveDeConta,
  chaveDeIp,
  esquecer,
  ipDaRequisicao,
  LIMITES,
  registrarFalha,
  respostaDeLimite,
  verificar,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  /**
   * Só as falhas contam, e o acerto zera o contador da conta: quem sabe a
   * senha nunca esbarra no limite. O teto por IP segura uma varredura de
   * muitas contas a partir do mesmo lugar; o teto por conta segura a força
   * bruta dirigida, que trocar de IP não contorna.
   */
  const chaveDaConta = chaveDeConta("login", email);
  const alvos = [
    { chave: chaveDeIp("login", ipDaRequisicao(request)), limite: LIMITES.LOGIN_IP },
    { chave: chaveDaConta, limite: LIMITES.LOGIN_CONTA },
  ];

  // Antes de falar com o Auth: passado o limite, ninguém autentica nada.
  const limite = await verificar(alvos);
  if (!limite.permitido) return respostaDeLimite(limite.esperarSeg);

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await registrarFalha(alvos);
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const appUser = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!appUser) {
    await supabase.auth.signOut();
    await registrarFalha(alvos);
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  await esquecer([chaveDaConta]);

  return NextResponse.json({
    id: appUser.id,
    email: appUser.email,
    name: appUser.name,
    role: appUser.role,
  });
}
