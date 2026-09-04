import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Página de seção ainda sem funcionalidade: mantém a casca, a hierarquia
 * visual e o estado vazio padrão até a fase correspondente ser implementada.
 */
export function PlaceholderPage({
  eyebrow,
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
    </div>
  );
}
