import { z } from "zod";

/** O que o próprio aluno pode alterar no seu cadastro. */
export const editarMeuPerfilSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome.").max(120).optional(),
  telefone: z.string().trim().max(20, "Telefone muito longo.").optional().nullable(),
  dataNascimento: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data no formato AAAA-MM-DD.")
    .optional()
    .nullable(),
  altura: z.coerce
    .number()
    .min(80, "Informe a altura em centímetros (ex.: 168).")
    .max(260, "Informe a altura em centímetros (ex.: 168).")
    .optional()
    .nullable(),
  objetivo: z.string().trim().max(200).optional().nullable(),
});
export type EditarMeuPerfilInput = z.infer<typeof editarMeuPerfilSchema>;

/** Registro de execução de um treino pelo aluno. */
export const registrarExecucaoSchema = z.object({
  concluido: z.boolean().optional(),
  observacoes: z.string().trim().max(500).optional().nullable(),
});
export type RegistrarExecucaoInput = z.infer<typeof registrarExecucaoSchema>;
