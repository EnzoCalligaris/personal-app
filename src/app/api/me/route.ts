import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";

// Qualquer usuário autenticado pode ver os próprios dados (regra 1).
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { userId, email, name, role, personalProfileId, alunoProfileId } = auth.ctx;
  return NextResponse.json({
    id: userId,
    email,
    name,
    role,
    personalProfileId,
    alunoProfileId,
  });
}
