import Link from "next/link";
import { CompassIcon } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex h-16 items-center px-4 sm:px-6">
        <Brand />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <EmptyState
          className="max-w-md border-none bg-transparent"
          icon={CompassIcon}
          title="Página não encontrada"
          description="O endereço que você tentou acessar não existe ou foi movido."
          action={
            <Button render={<Link href="/">Voltar para o início</Link>} />
          }
        />
      </div>
    </div>
  );
}
