import { z } from "zod";

export const criarFeedbackSchema = z.object({
  alunoId: z.uuid("Selecione o aluno."),
  texto: z
    .string()
    .trim()
    .min(3, "Escreva o comentário.")
    .max(2000, "Comentário muito longo."),
  /** Opcional: prende o comentário a uma avaliação do aluno. */
  avaliacaoId: z.uuid().optional().nullable(),
});
export type CriarFeedbackInput = z.infer<typeof criarFeedbackSchema>;

export const editarFeedbackSchema = z.object({
  texto: z.string().trim().min(3, "Escreva o comentário.").max(2000, "Comentário muito longo."),
});
export type EditarFeedbackInput = z.infer<typeof editarFeedbackSchema>;

export const listarFeedbacksQuerySchema = z.object({
  alunoId: z.uuid().optional(),
  q: z.string().trim().max(120).optional(),
});
export type ListarFeedbacksQuery = z.infer<typeof listarFeedbacksQuerySchema>;
