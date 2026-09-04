import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const appUser = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!appUser) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  return NextResponse.json({
    id: appUser.id,
    email: appUser.email,
    name: appUser.name,
    role: appUser.role,
  });
}
