import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import {
  chaveDeConta,
  chaveDeIp,
  consumir,
  devolver,
  esquecer,
  ipDaRequisicao,
  LIMITES,
  respostaDeLimite,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  /**
   * A tentativa é cobrada **antes** de falar com o Auth, e devolvida se a senha
   * conferir. O contrário - perguntar se ainda cabe, autenticar, e só então
   * contar a falha - deixava um vão entre a pergunta e a resposta: dez
   * requisições simultâneas perguntavam antes de qualquer uma contar, e as dez
   * passavam. Cobrar primeiro fecha o vão, porque o incremento é atômico e cada
   * requisição enxerga o número já com as outras dentro.
   *
   * O teto por IP segura uma varredura de muitas contas a partir do mesmo
   * lugar; o teto por conta segura a força bruta dirigida, que trocar de IP não
   * contorna.
   */
  const chaveDoIp = chaveDeIp("login", ipDaRequisicao(request));
  const chaveDaConta = chaveDeConta("login", email);
  const alvos = [
    { chave: chaveDoIp, limite: LIMITES.LOGIN_IP },
    { chave: chaveDaConta, limite: LIMITES.LOGIN_CONTA },
  ];

  const limite = await consumir(alvos);
  if (!limite.permitido) return respostaDeLimite(limite.esperarSeg);

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // Daqui em diante a tentativa fica cobrada: só o acerto a devolve. Um erro
  // inesperado do Auth também cobra - não dá para distinguir "a senha estava
  // errada" de "o serviço tropeçou" sem confiar no formato do erro, e um
  // controle de força bruta erra melhor cobrando a mais do que a menos.
  if (error || !data.user) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const appUser = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!appUser) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  // Acertou a senha: o histórico daquela conta é zerado, porque quem entrou
  // provou ser o dono. Do IP volta só a tentativa desta requisição - as falhas
  // que vieram de lá contra outras contas continuam contando.
  await esquecer([chaveDaConta]);
  await devolver([chaveDoIp]);

  return NextResponse.json({
    id: appUser.id,
    email: appUser.email,
    name: appUser.name,
    role: appUser.role,
  });
}
