import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import {
  ConflitoDeHorarioError,
  criarFaixaDeTrabalho,
  horariosDeTrabalho,
  PeriodoInvalidoError,
} from "@/lib/agenda/queries";
import { faixaDeTrabalhoSchema } from "@/lib/validations/agenda";

/** Configuração dos horários de trabalho (uma ou mais faixas por dia). */
export async function GET() {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const faixas = await horariosDeTrabalho(auth.ctx.personalProfileId!);
  return NextResponse.json({ faixas });
}

export async function POST(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = faixaDeTrabalhoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const faixas = await criarFaixaDeTrabalho(auth.ctx.personalProfileId!, parsed.data);
    return NextResponse.json({ faixas }, { status: 201 });
  } catch (error) {
    if (error instanceof ConflitoDeHorarioError || error instanceof PeriodoInvalidoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Falha ao criar faixa de trabalho:", error);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
