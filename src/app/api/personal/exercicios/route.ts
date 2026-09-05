import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { criarExercicio, listarExercicios, NomeDuplicadoError } from "@/lib/exercicios/queries";
import { criarExercicioSchema, listarExerciciosQuerySchema } from "@/lib/validations/exercicio";

/** Biblioteca de exercícios do Personal autenticado. */
export async function GET(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const parsed = listarExerciciosQuerySchema.safeParse({
    q: params.get("q") ?? undefined,
    grupo: params.get("grupo") ?? undefined,
    status: params.get("status") ?? undefined,
    ordenar: params.get("ordenar") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const data = await listarExercicios(auth.ctx.personalProfileId!, parsed.data);
  return NextResponse.json(data);
}

/** Cadastra um exercício na biblioteca do Personal. */
export async function POST(request: NextRequest) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = criarExercicioSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const exercicio = await criarExercicio(auth.ctx.personalProfileId!, parsed.data);
    return NextResponse.json(exercicio, { status: 201 });
  } catch (error) {
    if (error instanceof NomeDuplicadoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Falha ao criar exercício:", error);
    return NextResponse.json({ error: "Não foi possível criar o exercício." }, { status: 500 });
  }
}
