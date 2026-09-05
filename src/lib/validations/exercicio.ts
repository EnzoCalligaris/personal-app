import { z } from "zod";

/**
 * Grupos musculares aceitos. O banco guarda texto livre, mas padronizar aqui
 * mantém o filtro da biblioteca consistente.
 */
export const GRUPOS_MUSCULARES = [
  "Peito",
  "Costas",
  "Pernas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Abdômen",
  "Glúteos",
  "Panturrilha",
  "Cardio",
  "Mobilidade",
  "Outro",
] as const;

export type GrupoMuscular = (typeof GRUPOS_MUSCULARES)[number];

const urlOpcional = z
  .string()
  .trim()
  .max(500, "URL muito longa.")
  .refine(
    (valor) => valor === "" || /^https?:\/\/.+/.test(valor),
    "Informe uma URL começando com http:// ou https://"
  )
  .optional()
  .nullable();

export const criarExercicioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do exercício."),
  grupoMuscular: z.enum(GRUPOS_MUSCULARES, { message: "Selecione o grupo muscular." }),
  descricao: z.string().trim().max(1000, "Descrição muito longa.").optional().nullable(),
  videoUrl: urlOpcional,
});
export type CriarExercicioInput = z.infer<typeof criarExercicioSchema>;

export const editarExercicioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do exercício.").optional(),
  grupoMuscular: z.enum(GRUPOS_MUSCULARES).optional(),
  descricao: z.string().trim().max(1000, "Descrição muito longa.").optional().nullable(),
  videoUrl: urlOpcional,
  ativo: z.boolean().optional(),
});
export type EditarExercicioInput = z.infer<typeof editarExercicioSchema>;

export const listarExerciciosQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  grupo: z.string().trim().max(40).optional(),
  status: z.enum(["ATIVOS", "ARQUIVADOS", "TODOS"]).default("ATIVOS"),
  ordenar: z.enum(["recentes", "nome", "grupo"]).default("nome"),
});
export type ListarExerciciosQuery = z.infer<typeof listarExerciciosQuerySchema>;
