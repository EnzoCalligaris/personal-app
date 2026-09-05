import { z } from "zod";

import { DIAS_SEMANA_VALORES } from "@/lib/validations/treino";

/** Data de calendário no formato AAAA-MM-DD. */
const dataCalendario = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data no formato AAAA-MM-DD.")
  .refine((valor) => !Number.isNaN(Date.parse(valor)), "Data inválida.");

/** Hora no formato HH:MM (24h). */
const hora = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use um horário no formato HH:MM.");

export const vistaAgendaSchema = z.enum(["dia", "semana", "mes"]).default("semana");

export const agendaQuerySchema = z.object({
  vista: vistaAgendaSchema,
  data: dataCalendario.optional(),
});

export const faixaDeTrabalhoSchema = z
  .object({
    diaSemana: z.enum(DIAS_SEMANA_VALORES),
    horaInicio: hora,
    horaFim: hora,
    /** Duração de cada atendimento gerado dentro da faixa. */
    duracaoMin: z.coerce.number().int().min(15).max(240).default(60),
  })
  .refine((valores) => valores.horaFim > valores.horaInicio, {
    message: "O término precisa ser depois do início.",
    path: ["horaFim"],
  });
export type FaixaDeTrabalhoInput = z.infer<typeof faixaDeTrabalhoSchema>;

export const criarBloqueioSchema = z
  .object({
    data: dataCalendario,
    /** Sem início e fim, o dia inteiro fica bloqueado. */
    horaInicio: hora.optional().nullable(),
    horaFim: hora.optional().nullable(),
    motivo: z.string().trim().max(120).optional().nullable(),
  })
  .refine(
    (valores) =>
      (!valores.horaInicio && !valores.horaFim) ||
      (!!valores.horaInicio && !!valores.horaFim && valores.horaFim > valores.horaInicio),
    { message: "Informe início e fim, com o término depois do início.", path: ["horaFim"] }
  );
export type CriarBloqueioInput = z.infer<typeof criarBloqueioSchema>;

export const criarAgendamentoSchema = z
  .object({
    alunoId: z.uuid("Selecione o aluno."),
    data: dataCalendario,
    horaInicio: hora,
    horaFim: hora,
    status: z.enum(["AGENDADO", "CONFIRMADO"]).optional(),
    observacoes: z.string().trim().max(500).optional().nullable(),
  })
  .refine((valores) => valores.horaFim > valores.horaInicio, {
    message: "O término precisa ser depois do início.",
    path: ["horaFim"],
  });
export type CriarAgendamentoInput = z.infer<typeof criarAgendamentoSchema>;

/** Confirmar, cancelar, marcar como realizado ou reagendar. */
export const editarAgendamentoSchema = z
  .object({
    status: z.enum(["AGENDADO", "CONFIRMADO", "CANCELADO", "REALIZADO", "REAGENDADO"]).optional(),
    data: dataCalendario.optional(),
    horaInicio: hora.optional(),
    horaFim: hora.optional(),
    observacoes: z.string().trim().max(500).optional().nullable(),
  })
  .refine(
    (valores) =>
      !valores.horaInicio || !valores.horaFim || valores.horaFim > valores.horaInicio,
    { message: "O término precisa ser depois do início.", path: ["horaFim"] }
  );
export type EditarAgendamentoInput = z.infer<typeof editarAgendamentoSchema>;

export const horariosLivresQuerySchema = z.object({ data: dataCalendario });
