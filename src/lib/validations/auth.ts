import { z } from "zod";

export const registroSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo."),
  email: z.email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  role: z.enum(["PERSONAL", "ALUNO"], { message: "Selecione o tipo de conta." }),
});
export type RegistroInput = z.infer<typeof registroSchema>;

export const loginSchema = z.object({
  email: z.email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const esqueciSenhaSchema = z.object({
  email: z.email("E-mail inválido."),
});
export type EsqueciSenhaInput = z.infer<typeof esqueciSenhaSchema>;

export const redefinirSenhaSchema = z.object({
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>;
