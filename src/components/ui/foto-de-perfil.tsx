"use client";

import * as React from "react";
import { CameraIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { iniciais } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";

const TIPOS = "image/jpeg,image/png,image/webp";

/**
 * Foto do próprio usuário: mostra o avatar e troca a imagem no clique. O envio
 * vai para `/api/perfil/foto`, que resolve o dono pela sessão.
 */
export function FotoDePerfil({
  nome,
  avatarUrl,
  onEnviada,
  className,
}: {
  nome: string;
  avatarUrl: string | null;
  onEnviada: (avatarUrl: string) => void;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = React.useState(false);

  async function enviar(arquivo: File) {
    setEnviando(true);
    try {
      const form = new FormData();
      form.append("file", arquivo);

      const res = await fetch("/api/perfil/foto", { method: "POST", body: form });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível enviar a foto.");
        return;
      }

      onEnviada(body.avatarUrl as string);
      toast.success("Foto atualizada.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        aria-label={avatarUrl ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
        className="group relative rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        <Avatar size="lg" className="size-20">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-primary/15 text-lg font-medium text-primary dark:bg-primary/20">
            {iniciais(nome)}
          </AvatarFallback>
        </Avatar>

        <span
          aria-hidden="true"
          className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground shadow-soft ring-1 ring-border transition-colors group-hover:text-foreground"
        >
          {enviando ? <Spinner size="sm" /> : <CameraIcon className="size-3.5" />}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={TIPOS}
        className="hidden"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          if (arquivo) void enviar(arquivo);
          evento.target.value = "";
        }}
      />
    </div>
  );
}
