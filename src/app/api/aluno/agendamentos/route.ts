import { NextResponse, type NextRequest } from "next/server";

import { requireAluno } from "@/lib/auth/guards";
import {
  agendarComoAluno,
  AgendamentoRecusadoError,
  SemPersonalError,
} from "@/lib/aluno/agendamento";
import { agendarComoAlunoSchema } from "@/lib/validations/agenda";

/**
 * O aluno marca o próprio horário. Tudo o que a tela filtrou é revalidado
 * aqui: passado, antecedência, janela, limite, bloqueio e conflito.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAluno();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = agendarComoAlunoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const agendamento = await agendarComoAluno(auth.ctx.alunoProfileId!, parsed.data);
    return NextResponse.json(agendamento, { status: 201 });
  } catch (error) {
    if (error instanceof AgendamentoRecusadoError || error instanceof SemPersonalError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Falha ao agendar:", error);
    return NextResponse.json({ error: "Não foi possível agendar." }, { status: 500 });
  }
}
