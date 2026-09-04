"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/lib/toast";
import { esqueciSenhaSchema, type EsqueciSenhaInput } from "@/lib/validations/auth";

export function EsqueciSenhaForm() {
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EsqueciSenhaInput>({ resolver: zodResolver(esqueciSenhaSchema) });

  async function onSubmit(values: EsqueciSenhaInput) {
    setLoading(true);
    try {
      await fetch("/api/auth/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setEnviado(true);
    } catch {
      toast.error("Falha de conexão", { description: "Verifique sua internet e tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <div className="flex animate-fade-up flex-col items-center gap-3 rounded-2xl border border-success/25 bg-success/[0.06] px-6 py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-success/12 text-success">
          <MailCheckIcon className="size-6" />
        </span>
        <h2 className="font-heading text-base font-semibold">Verifique seu e-mail</h2>
        <p className="text-sm leading-relaxed text-balance text-muted-foreground">
          Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em
          instantes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Spinner size="sm" />
            Enviando...
          </>
        ) : (
          "Enviar link de recuperação"
        )}
      </Button>
    </form>
  );
}
