"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCapIcon, UserRoundCogIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/lib/toast";
import { registroSchema, type RegistroInput } from "@/lib/validations/auth";

const roleOptions = [
  {
    value: "PERSONAL" as const,
    label: "Sou Personal",
    description: "Gerencio alunos",
    icon: UserRoundCogIcon,
  },
  {
    value: "ALUNO" as const,
    label: "Sou Aluno",
    description: "Sigo meus treinos",
    icon: GraduationCapIcon,
  },
];

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
    } catch {
      toast.error("Falha de conexão", { description: "Verifique sua internet e tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Tipo de conta</legend>
        <div className="grid grid-cols-2 gap-3">
          {roleOptions.map((option) => {
            const selected = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setRole(option.value);
                  setValue("role", option.value);
                }}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition-all duration-200 outline-none",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.98]",
                  selected
                    ? "border-primary bg-primary/8 shadow-soft dark:bg-primary/12"
                    : "border-border bg-card hover:border-foreground/15 hover:bg-muted/60"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl transition-colors",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  <option.icon className="size-4.5" />
                </span>
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nome completo</Label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Seu nome"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>

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

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Senha</Label>
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
            Criando conta...
          </>
        ) : (
          "Criar conta"
        )}
      </Button>
    </form>
  );
}
