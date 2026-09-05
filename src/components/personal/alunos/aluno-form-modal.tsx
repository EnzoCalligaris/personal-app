"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalClose } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/lib/toast";
import type { AlunoDetalhe, AlunoListItem } from "@/types/aluno";

// Schema do formulário: todos os campos são string (é o que o input entrega).
// A conversão para o payload da API acontece em `paraPayload`, e a API valida
// de novo com os schemas de `@/lib/validations/aluno`.
const formSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo."),
  email: z.string().trim(),
  phone: z.string(),
  dataNascimento: z.string(),
  altura: z.string(),
  objetivo: z.string(),
  observacoes: z.string(),
});

const criarFormSchema = formSchema.extend({ email: z.email("E-mail inválido.") });

type Valores = z.infer<typeof formSchema>;

const VAZIO: Valores = {
  name: "",
  email: "",
  phone: "",
  dataNascimento: "",
  altura: "",
  objetivo: "",
  observacoes: "",
};

function paraFormulario(aluno?: AlunoDetalhe | null): Valores {
  if (!aluno) return VAZIO;
  return {
    name: aluno.nome,
    email: aluno.email,
    phone: aluno.telefone ?? "",
    dataNascimento: aluno.dataNascimento ? aluno.dataNascimento.slice(0, 10) : "",
    altura: aluno.altura ? String(aluno.altura) : "",
    objetivo: aluno.objetivo ?? "",
    observacoes: aluno.observacoes ?? "",
  };
}

/** Converte os campos do formulário para o payload da API. */
function paraPayload(valores: Valores, modo: "criar" | "editar") {
  const base = {
    name: valores.name.trim(),
    phone: valores.phone.trim() || null,
    dataNascimento: valores.dataNascimento || null,
    altura: valores.altura ? Number(valores.altura) : null,
    objetivo: valores.objetivo.trim() || null,
    observacoes: valores.observacoes.trim() || null,
  };
  return modo === "criar" ? { ...base, email: valores.email.trim() } : base;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente = criação. */
  aluno?: AlunoDetalhe | null;
  onSaved: (aluno: AlunoListItem | AlunoDetalhe) => void;
  /** Chamado ao criar, com a senha temporária gerada. */
  onCreated?: (senha: string, aluno: AlunoListItem) => void;
};

export function AlunoFormModal({ open, onOpenChange, aluno, onSaved, onCreated }: Props) {
  const modo = aluno ? "editar" : "criar";
  const [salvando, setSalvando] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Valores>({
    // Só a criação exige e-mail (na edição o campo é somente leitura).
    resolver: zodResolver(modo === "criar" ? criarFormSchema : formSchema),
    values: paraFormulario(aluno),
  });

  async function onSubmit(valores: Valores) {
    setSalvando(true);
    try {
      const url = modo === "criar" ? "/api/personal/alunos" : `/api/personal/alunos/${aluno!.id}`;
      const res = await fetch(url, {
        method: modo === "criar" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paraPayload(valores, modo)),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível salvar.");
        return;
      }

      if (modo === "criar") {
        toast.success("Aluno cadastrado!");
        onSaved(data.aluno);
        onCreated?.(data.senhaTemporaria, data.aluno);
        reset(VAZIO);
      } else {
        toast.success("Dados atualizados!");
        onSaved(data);
      }

      onOpenChange(false);
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={modo === "criar" ? "Novo aluno" : "Editar aluno"}
      description={
        modo === "criar"
          ? "A conta é criada com uma senha temporária que você repassa ao aluno."
          : "O e-mail não pode ser alterado por aqui - ele identifica a conta."
      }
      footer={
        <>
          <ModalClose render={<Button variant="outline" />}>Cancelar</ModalClose>
          <Button type="submit" form="form-aluno" disabled={salvando}>
            {salvando ? <Spinner size="sm" /> : null}
            {modo === "criar" ? "Cadastrar aluno" : "Salvar alterações"}
          </Button>
        </>
      }
    >
      <form
        id="form-aluno"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="aluno-nome">Nome completo</Label>
          <Input id="aluno-nome" placeholder="Ana Silva" aria-invalid={!!errors.name} {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="aluno-email">E-mail</Label>
            <Input
              id="aluno-email"
              type="email"
              placeholder="ana@exemplo.com"
              disabled={modo === "editar"}
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="aluno-telefone">Telefone</Label>
            <Input id="aluno-telefone" placeholder="(11) 90000-0000" {...register("phone")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="aluno-nascimento">Data de nascimento</Label>
            <Input id="aluno-nascimento" type="date" {...register("dataNascimento")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="aluno-altura">Altura (cm)</Label>
            <Input id="aluno-altura" type="number" inputMode="numeric" placeholder="170" {...register("altura")} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="aluno-objetivo">Objetivo</Label>
          <Input id="aluno-objetivo" placeholder="Hipertrofia, emagrecimento..." {...register("objetivo")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="aluno-observacoes">Observações</Label>
          <Input id="aluno-observacoes" placeholder="Lesões, restrições, preferências..." {...register("observacoes")} />
        </div>
      </form>
    </Modal>
  );
}
