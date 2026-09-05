import { AlunoDetalhe } from "@/components/personal/alunos/aluno-detalhe";

export const metadata = { title: "Aluno" };

export default async function AlunoDetalhePage({ params }: PageProps<"/personal/alunos/[id]">) {
  const { id } = await params;
  return <AlunoDetalhe alunoId={id} />;
}
