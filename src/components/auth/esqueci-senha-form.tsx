"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <p className="text-sm text-muted-foreground">
        Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em
        instantes.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Enviar link de recuperação"}
      </Button>
    </form>
  );
}
