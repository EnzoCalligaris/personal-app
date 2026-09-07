import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { registroSchema } from "@/lib/validations/auth";
import {
  chaveDeIp,
  consumir,
  ipDaRequisicao,
  LIMITES,
  respostaDeLimite,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registroSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, password, role } = parsed.data;

  // Contra criação automatizada de contas. Corpo inválido nem chega aqui, então
  // gastar uma tentativa custa ao menos um cadastro bem formado.
  const limite = await consumir([
    { chave: chaveDeIp("registro", ipDaRequisicao(request)), limite: LIMITES.REGISTRO_IP },
  ]);
  if (!limite.permitido) return respostaDeLimite(limite.esperarSeg);

  const admin = createAdminClient();

  // E-mail já cadastrado? Supabase Auth também valida isso, mas checar antes
  // evita criar (e ter que reverter) um usuário do Auth desnecessariamente.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { name },
  });

  if (createError || !created.user) {
    const status = createError?.status ?? 500;
    return NextResponse.json(
      { error: createError?.message ?? "Não foi possível criar o usuário." },
      { status }
    );
  }

  const authUserId = created.user.id;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { id: authUserId, email, name, role } });

      if (role === "PERSONAL") {
        await tx.personalProfile.create({ data: { userId: authUserId } });
      } else {
        await tx.alunoProfile.create({ data: { userId: authUserId } });
      }
    });
  } catch (err) {
    // Reverte o usuário do Auth para não deixar conta órfã sem perfil de app.
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    console.error("Falha ao criar perfil de aplicação após criar usuário no Auth:", err);
    return NextResponse.json(
      { error: "Não foi possível concluir o cadastro." },
      { status: 500 }
    );
  }

  // Loga o usuário imediatamente após o cadastro (define os cookies de sessão).
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    // Cadastro concluído, mas sem sessão automática - o cliente deve ir para o login.
    return NextResponse.json({ id: authUserId, email, name, role, autoLogin: false }, { status: 201 });
  }

  return NextResponse.json({ id: authUserId, email, name, role, autoLogin: true }, { status: 201 });
}
