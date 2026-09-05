"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import { toast } from "@/lib/toast";
import { GRUPOS_MUSCULARES } from "@/lib/validations/exercicio";
import type { ExercicioItem } from "@/types/exercicio";

const formSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do exercício."),
  grupoMuscular: z.enum(GRUPOS_MUSCULARES, { message: "Selecione o grupo muscular." }),
  descricao: z.string(),
  videoUrl: z
    .string()
    .trim()
    .refine(
      (valor) => valor === "" || /^https?:\/\/.+/.test(valor),
      "Informe uma URL começando com http:// ou https://"
    ),
});

type Valores = z.infer<typeof formSchema>;

const VAZIO: Valores = { nome: "", grupoMuscular: "Peito", descricao: "", videoUrl: "" };

function paraFormulario(exercicio?: ExercicioItem | null): Valores {
  if (!exercicio) return VAZIO;
  return {
    nome: exercicio.nome,
    grupoMuscular: (GRUPOS_MUSCULARES as readonly string[]).includes(exercicio.grupoMuscular)
      ? (exercicio.grupoMuscular as Valores["grupoMuscular"])
      : "Outro",
    descricao: exercicio.descricao ?? "",
    videoUrl: exercicio.videoUrl ?? "",
  };
}

export function ExercicioFormModal({
  open,
  onOpenChange,
  exercicio,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente = criação. */
  exercicio?: ExercicioItem | null;
  onSaved: () => void;
}) {
  const modo = exercicio ? "editar" : "criar";
  const [salvando, setSalvando] = React.useState(false);

  // O grupo é controlado por estado local (o Select não é um <input> nativo);
  // `watch()` do react-hook-form não é memoizável e o React Compiler alerta.
  // O estado inicial vem do exercício - quem abre o modal remonta o
  // componente com `key`, então não é preciso sincronizar depois.
  const [grupoSelecionado, setGrupoSelecionado] = React.useState<Valores["grupoMuscular"]>(
    paraFormulario(exercicio).grupoMuscular
  );

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(formSchema),
    values: paraFormulario(exercicio),
  });

  async function onSubmit(valores: Valores) {
    setSalvando(true);
    try {
      const url =
        modo === "criar"
          ? "/api/personal/exercicios"
          : `/api/personal/exercicios/${exercicio!.id}`;

      const res = await fetch(url, {
        method: modo === "criar" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: valores.nome.trim(),
          grupoMuscular: valores.grupoMuscular,
          descricao: valores.descricao.trim() || null,
          videoUrl: valores.videoUrl.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível salvar o exercício.");
        return;
      }

      toast.success(modo === "criar" ? "Exercício cadastrado!" : "Exercício atualizado!");
      if (modo === "criar") reset(VAZIO);
      onSaved();
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
      title={modo === "criar" ? "Novo exercício" : "Editar exercício"}
      description="Os exercícios da sua biblioteca são reutilizados na montagem dos treinos."
      footer={
        <>
          <ModalClose render={<Button variant="outline" />}>Cancelar</ModalClose>
          <Button type="submit" form="form-exercicio" disabled={salvando}>
            {salvando ? <Spinner size="sm" /> : null}
            {modo === "criar" ? "Cadastrar exercício" : "Salvar alterações"}
          </Button>
        </>
      }
    >
      <form
        id="form-exercicio"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="exercicio-nome">Nome</Label>
          <Input
            id="exercicio-nome"
            placeholder="Supino reto"
            aria-invalid={!!errors.nome}
            {...register("nome")}
          />
          {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="exercicio-grupo">Grupo muscular</Label>
          <Select
            value={grupoSelecionado}
            onValueChange={(valor) => {
              const grupo = (valor ?? "Outro") as Valores["grupoMuscular"];
              setGrupoSelecionado(grupo);
              setValue("grupoMuscular", grupo, { shouldValidate: true });
            }}
          >
            <SelectTrigger id="exercicio-grupo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRUPOS_MUSCULARES.map((grupo) => (
                <SelectItem key={grupo} value={grupo}>
                  {grupo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.grupoMuscular && (
            <p className="text-sm text-destructive">{errors.grupoMuscular.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="exercicio-descricao">Descrição / execução</Label>
          <Textarea
            id="exercicio-descricao"
            rows={3}
            placeholder="Como executar, cuidados, variações..."
            {...register("descricao")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="exercicio-video">Vídeo de referência (URL)</Label>
          <Input
            id="exercicio-video"
            placeholder="https://youtube.com/..."
            aria-invalid={!!errors.videoUrl}
            {...register("videoUrl")}
          />
          {errors.videoUrl && (
            <p className="text-sm text-destructive">{errors.videoUrl.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            A imagem de demonstração é enviada pelo card do exercício, depois de salvar.
          </p>
        </div>
      </form>
    </Modal>
  );
}
