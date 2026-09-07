import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { esqueciSenhaSchema } from "@/lib/validations/auth";
import {
  chaveDeConta,
  chaveDeIp,
  consumir,
  ipDaRequisicao,
  LIMITES,
  respostaDeLimite,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = esqueciSenhaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  /**
   * O limite é cobrado antes de qualquer coisa e vale para todo endereço,
   * exista ou não - senão a diferença entre ser barrado e não ser contaria se a
   * conta existe. A resposta de sucesso continua sendo a mesma para todos.
   */
  const limite = await consumir([
    { chave: chaveDeIp("recuperacao", ipDaRequisicao(request)), limite: LIMITES.RECUPERACAO_IP },
    {
      chave: chaveDeConta("recuperacao", parsed.data.email),
      limite: LIMITES.RECUPERACAO_CONTA,
    },
  ]);
  if (!limite.permitido) return respostaDeLimite(limite.esperarSeg);

  const supabase = await createClient();
  const redirectTo = `${request.nextUrl.origin}/auth/callback?next=/redefinir-senha`;

  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });

  // Sempre 200: não revelamos se o e-mail existe ou não na base.
  return NextResponse.json({ ok: true });
}
