import { ExecucaoTreino } from "@/components/aluno/execucao-treino";

export const metadata = { title: "Treino" };

export default async function TreinoDoAlunoPage({ params }: PageProps<"/aluno/treinos/[id]">) {
  const { id } = await params;
  return <ExecucaoTreino treinoId={id} />;
}
