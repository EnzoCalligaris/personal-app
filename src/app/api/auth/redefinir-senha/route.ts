import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redefinirSenhaSchema } from "@/lib/validations/auth";
import { requireAuth } from "@/lib/auth/guards";

export async function POST(request: NextRequest) {
  // Exige uma sessão ativa - estabelecida pelo link de recuperação de senha
  // (e-mail -> /auth/callback -> troca o code por sessão -> chega aqui).
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = redefinirSenhaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return NextResponse.json({ error: "Não foi possível redefinir a senha." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
