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

/**
 * O que o aluno fez em um exercício da sessão. Séries, repetições e carga são
 * opcionais: sem eles vale o que estava prescrito na ficha.
 */
const itemExecutadoSchema = z.object({
  treinoExercicioId: z.uuid("Exercício inválido."),
  concluido: z.boolean().optional(),
  /** Séries efetivamente concluídas. */
  series: z.coerce.number().int().min(0).max(50).optional(),
  repeticoes: z.string().trim().max(20).optional(),
  carga: z.string().trim().max(30).optional().nullable(),
  observacoes: z.string().trim().max(300).optional().nullable(),
});

/** Registro de execução de um treino pelo aluno. */
export const registrarExecucaoSchema = z.object({
  concluido: z.boolean().optional(),
  observacoes: z.string().trim().max(500).optional().nullable(),
  /** Tempo cronometrado pela tela de execução (máx. 8h). */
  duracaoSeg: z.coerce.number().int().min(0).max(28800).optional().nullable(),
  /** Ausente = registra a ficha inteira como feita, do jeito que foi prescrita. */
  itens: z.array(itemExecutadoSchema).max(50).optional(),
});
export type RegistrarExecucaoInput = z.infer<typeof registrarExecucaoSchema>;
