import { TreinoDetalhe } from "@/components/aluno/treino-detalhe";

export const metadata = { title: "Treino" };

export default async function TreinoDoAlunoPage({ params }: PageProps<"/aluno/treinos/[id]">) {
  const { id } = await params;
  return <TreinoDetalhe treinoId={id} />;
}
