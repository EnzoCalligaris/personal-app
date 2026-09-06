import { AvaliacoesPainel } from "@/components/personal/avaliacoes/avaliacoes-painel";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Avaliações" };

export default function AvaliacoesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Bioimpedância"
        title="Avaliações"
        description="Registre as medidas de cada aluno e acompanhe a evolução da composição corporal."
      />
      <AvaliacoesPainel />
    </div>
  );
}
