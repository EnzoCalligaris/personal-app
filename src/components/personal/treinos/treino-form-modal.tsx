"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useApi } from "@/hooks/use-api";
import { diaSemanaLabel } from "@/lib/format";
import { toast } from "@/lib/toast";
import { DIAS_SEMANA_VALORES } from "@/lib/validations/treino";
import type { DiaSemana } from "@/types";
import type { AlunoListResponse } from "@/types/aluno";
import type { TreinoDetalhe } from "@/types/treino";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalClose } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do treino."),
  observacoes: z.string(),
});

type Valores = z.infer<typeof formSchema>;

export function TreinoFormModal({
  open,
  onOpenChange,
  treino,
  alunoFixo,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente = criação. */
  treino?: TreinoDetalhe | null;
  /** Fixa o aluno (ex.: criando a partir da ficha do aluno). */
  alunoFixo?: { id: string; nome: string };
  onSaved: (treino: TreinoDetalhe) => void;
}) {
  const modo = treino ? "editar" : "criar";
  const [salvando, setSalvando] = React.useState(false);
  const [alunoId, setAlunoId] = React.useState<string>(
    treino?.aluno.id ?? alunoFixo?.id ?? ""
  );
  const [diaSemana, setDiaSemana] = React.useState<DiaSemana>(treino?.diaSemana ?? "SEGUNDA");

  // Só busca a lista de alunos quando ela é realmente necessária.
  const precisaEscolherAluno = !alunoFixo;
  const { data: alunosData, loading: carregandoAlunos } = useApi<AlunoListResponse>(
    precisaEscolherAluno ? "/api/personal/alunos?status=ATIVO&ordenar=nome" : null
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(formSchema),
    values: {
      nome: treino?.nome ?? "",
      observacoes: treino?.observacoes ?? "",
    },
  });

  async function onSubmit(valores: Valores) {
    if (modo === "criar" && !alunoId) {
      toast.error("Selecione o aluno do treino.");
      return;
    }

    setSalvando(true);
    try {
      const url = modo === "criar" ? "/api/personal/treinos" : `/api/personal/treinos/${treino!.id}`;
      const res = await fetch(url, {
        method: modo === "criar" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(modo === "criar" ? { alunoId } : { alunoId }),
          nome: valores.nome.trim(),
          diaSemana,
          observacoes: valores.observacoes.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível salvar o treino.");
        return;
      }

      toast.success(modo === "criar" ? "Treino criado!" : "Treino atualizado!");
      onSaved(data as TreinoDetalhe);
      onOpenChange(false);
    } catch {
      toast.error("Falha de conexão", { description: "Tente novamente." });
    } finally {
      setSalvando(false);
    }
  }

  const alunos = alunosData?.alunos ?? [];
  const nomeDoAluno =
    alunoFixo?.nome ?? alunos.find((aluno) => aluno.id === alunoId)?.nome ?? treino?.aluno.nome;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={modo === "criar" ? "Novo treino" : "Editar treino"}
      description="O treino fica vinculado a um aluno e a um dia da semana."
      footer={
        <>
          <ModalClose render={<Button variant="outline" />}>Cancelar</ModalClose>
          <Button type="submit" form="form-treino" disabled={salvando}>
            {salvando ? <Spinner size="sm" /> : null}
            {modo === "criar" ? "Criar treino" : "Salvar alterações"}
          </Button>
        </>
      }
    >
      <form
        id="form-treino"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="treino-aluno">Aluno</Label>
          {alunoFixo ? (
            <Input id="treino-aluno" value={alunoFixo.nome} disabled />
          ) : (
            <Select value={alunoId} onValueChange={(valor) => setAlunoId(valor ?? "")}>
              <SelectTrigger id="treino-aluno" className="w-full">
                <SelectValue placeholder={carregandoAlunos ? "Carregando..." : "Selecione o aluno"}>
                  {() => nomeDoAluno ?? "Selecione o aluno"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {alunos.map((aluno) => (
                  <SelectItem key={aluno.id} value={aluno.id}>
                    {aluno.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!carregandoAlunos && precisaEscolherAluno && alunos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Você ainda não tem alunos ativos. Cadastre um aluno antes de montar o treino.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="treino-nome">Nome do treino</Label>
            <Input
              id="treino-nome"
              placeholder="Treino A · Superior"
              aria-invalid={!!errors.nome}
              {...register("nome")}
            />
            {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="treino-dia">Dia da semana</Label>
            <Select
              value={diaSemana}
              onValueChange={(valor) => setDiaSemana((valor ?? "SEGUNDA") as DiaSemana)}
            >
              <SelectTrigger id="treino-dia" className="w-full">
                <SelectValue>{(valor) => diaSemanaLabel(valor as DiaSemana)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIAS_SEMANA_VALORES.map((dia) => (
                  <SelectItem key={dia} value={dia}>
                    {diaSemanaLabel(dia)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="treino-observacoes">Observações</Label>
          <Textarea
            id="treino-observacoes"
            rows={3}
            placeholder="Aquecimento, foco da sessão, cuidados..."
            {...register("observacoes")}
          />
        </div>
      </form>
    </Modal>
  );
}
