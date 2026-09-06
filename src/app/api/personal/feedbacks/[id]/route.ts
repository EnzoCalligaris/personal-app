import { NextResponse, type NextRequest } from "next/server";

import { requirePersonal } from "@/lib/auth/guards";
import { atualizarFeedback, excluirFeedback } from "@/lib/feedbacks/queries";
import { editarFeedbackSchema } from "@/lib/validations/feedback";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = editarFeedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await params;
  const feedback = await atualizarFeedback(auth.ctx.personalProfileId!, id, parsed.data);

  if (!feedback) {
    return NextResponse.json({ error: "Feedback não encontrado." }, { status: 404 });
  }

  return NextResponse.json(feedback);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePersonal();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const resultado = await excluirFeedback(auth.ctx.personalProfileId!, id);

  if (resultado === "nao_encontrado") {
    return NextResponse.json({ error: "Feedback não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
