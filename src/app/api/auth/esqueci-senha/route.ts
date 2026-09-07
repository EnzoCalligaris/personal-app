import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { urlPublica } from "@/lib/env";
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

  /**
   * O destino do link sai da configuração, nunca da requisição: montá-lo com o
   * `Host` recebido deixaria um atacante mandar para a caixa da vítima um link
   * de recuperação apontando para o domínio dele, com um token válido dentro.
   */
  let redirectTo: string;
  try {
    redirectTo = urlPublica("/auth/callback?next=/redefinir-senha");
  } catch (erro) {
    // O detalhe fica no log do servidor; para quem pediu, é só uma falha.
    console.error("Recuperação de senha sem NEXT_PUBLIC_SITE_URL utilizável:", erro);
    return NextResponse.json(
      { error: "Não foi possível processar o pedido agora." },
      { status: 500 }
    );
  }

  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });

  // Sempre 200: não revelamos se o e-mail existe ou não na base.
  return NextResponse.json({ ok: true });
}
