import { NextResponse } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { getDashboardData } from "@/lib/dashboard/queries";

/**
 * Dados do dashboard do Personal autenticado.
 * Endpoint administrativo: exige sessão + role PERSONAL, e todo o conteúdo é
 * filtrado pelo perfil do próprio Personal.
 */
export async function GET() {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  try {
    const data = await getDashboardData(auth.ctx.personalProfileId!);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Falha ao montar o dashboard do Personal:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o dashboard." },
      { status: 500 }
    );
  }
}
