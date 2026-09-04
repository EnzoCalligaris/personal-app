"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { registroSchema, type RegistroInput } from "@/lib/validations/auth";

export function RegistroForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [role, setRole] = useState<RegistroInput["role"]>("PERSONAL");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegistroInput>({
    resolver: zodResolver(registroSchema),
    defaultValues: { role: "PERSONAL" },
  });

  async function onSubmit(values: RegistroInput) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível criar a conta.");
        return;
      }

      toast.success("Conta criada com sucesso!");
      router.push(data.role === "PERSONAL" ? "/personal" : "/aluno");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Tipo de conta</Label>
        <Tabs
          value={role}
          onValueChange={(v) => {
            const next = v as RegistroInput["role"];
            setRole(next);
            setValue("role", next);
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="PERSONAL" className="flex-1">
              Sou Personal Trainer
            </TabsTrigger>
            <TabsTrigger value="ALUNO" className="flex-1">
              Sou Aluno
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nome completo</Label>
        <Input id="name" autoComplete="name" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" disabled={loading} className="mt-2">
        {loading ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}
