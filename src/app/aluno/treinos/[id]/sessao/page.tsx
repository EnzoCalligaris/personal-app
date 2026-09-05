import { SessaoTreino } from "@/components/aluno/sessao-treino";

export const metadata = { title: "Treinando" };

export default async function SessaoDeTreinoPage({
  params,
}: PageProps<"/aluno/treinos/[id]/sessao">) {
  const { id } = await params;
  return <SessaoTreino treinoId={id} />;
}
