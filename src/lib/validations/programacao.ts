import { z } from "zod";

import { DIAS_SEMANA_VALORES } from "@/lib/validations/treino";

/** Data de calendário no formato YYYY-MM-DD. */
const dataCalendario = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data no formato AAAA-MM-DD.")
  .refine((valor) => !Number.isNaN(Date.parse(valor)), "Data inválida.");

const diaDaProgramacao = z.object({
  diaSemana: z.enum(DIAS_SEMANA_VALORES),
  treinoId: z.uuid("Selecione um treino válido."),
});

export const criarProgramacaoSchema = z.object({
  alunoId: z.uuid("Selecione o aluno."),
  nome: z.string().trim().max(120).optional().nullable(),
  dataInicio: dataCalendario,
  dataFim: dataCalendario.optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
  /** Opcional: dá para criar vazia e montar os dias depois. */
  dias: z.array(diaDaProgramacao).max(7).optional(),
});
export type CriarProgramacaoInput = z.infer<typeof criarProgramacaoSchema>;

export const editarProgramacaoSchema = z.object({
  nome: z.string().trim().max(120).optional().nullable(),
  dataInicio: dataCalendario.optional(),
  dataFim: dataCalendario.optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});
export type EditarProgramacaoInput = z.infer<typeof editarProgramacaoSchema>;

export const definirDiaSchema = z.object({
  treinoId: z.uuid("Selecione um treino válido."),
});

export const calendarioQuerySchema = z
  .object({
    de: dataCalendario,
    ate: dataCalendario,
  })
  .refine((valores) => valores.de <= valores.ate, {
    message: "O início do período não pode ser depois do fim.",
    path: ["ate"],
  });

export const diaSemanaParamSchema = z.enum(DIAS_SEMANA_VALORES);
