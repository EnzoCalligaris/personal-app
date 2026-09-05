import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { treinoPrevistoEm } from "@/lib/programacoes/queries";
import { dataUTC, hojeUTC, paraISO } from "@/lib/date-utils";

/**
 * O que o aluno deve treinar em uma data (padrão: hoje). É a mesma resolução
 * que o app do aluno usará para o "Treino de hoje".
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const aluno = await prisma.alunoProfile.findFirst({
    where: { id, personalId: auth.ctx.personalProfileId! },
    select: { id: true },
  });
  if (!aluno) {
    return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });
  }

  const dataParam = request.nextUrl.searchParams.get("data");
  if (dataParam && !/^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
    return NextResponse.json({ error: "Use uma data no formato AAAA-MM-DD." }, { status: 400 });
  }

  const data = dataParam ? dataUTC(dataParam) : hojeUTC();
  if (Number.isNaN(data.getTime())) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  const previsto = await treinoPrevistoEm(aluno.id, data);
  return NextResponse.json({ ...previsto, data: paraISO(data) });
}
