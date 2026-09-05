import { TreinoEditor } from "@/components/personal/treinos/treino-editor";

export const metadata = { title: "Treino" };

export default async function TreinoPage({ params }: PageProps<"/personal/treinos/[id]">) {
  const { id } = await params;
  return <TreinoEditor treinoId={id} />;
}
