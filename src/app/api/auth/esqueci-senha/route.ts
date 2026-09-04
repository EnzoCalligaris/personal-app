import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { esqueciSenhaSchema } from "@/lib/validations/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = esqueciSenhaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const redirectTo = `${request.nextUrl.origin}/auth/callback?next=/redefinir-senha`;

  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });

  // Sempre 200: não revelamos se o e-mail existe ou não na base.
  return NextResponse.json({ ok: true });
}
