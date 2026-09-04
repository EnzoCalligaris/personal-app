"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/lib/toast";
import { redefinirSenhaSchema, type RedefinirSenhaInput } from "@/lib/validations/auth";

export function RedefinirSenhaForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RedefinirSenhaInput>({ resolver: zodResolver(redefinirSenhaSchema) });

  async function onSubmit(values: RedefinirSenhaInput) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível redefinir a senha.");
        return;
      }

      toast.success("Senha redefinida com sucesso!");
      router.push("/login");
    } catch {
      toast.error("Falha de conexão", { description: "Verifique sua internet e tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p role="alert" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Spinner size="sm" />
            Salvando...
          </>
        ) : (
          "Redefinir senha"
        )}
      </Button>
    </form>
  );
}
