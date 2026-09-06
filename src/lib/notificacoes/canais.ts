import "server-only";

import { prisma } from "@/lib/prisma";
import type { MensagemNotificacao } from "@/lib/notificacoes/eventos";

/**
 * Canais de entrega de uma notificação.
 *
 * Hoje existe um só: o **interno**, que grava a notificação no banco para
 * aparecer na campainha do app. E-mail, WhatsApp e push entram como novos
 * canais - implementar `entregar` e ligar `habilitado`, sem tocar em quem
 * dispara o evento.
 */
export type NomeDoCanal = "INTERNO" | "EMAIL" | "WHATSAPP" | "PUSH";

export type CanalDeEntrega = {
  nome: NomeDoCanal;
  /** Canal desligado é ignorado pelo despachante. */
  habilitado: boolean;
  entregar: (mensagem: MensagemNotificacao) => Promise<void>;
};

/** O único canal implementado: a notificação que aparece dentro do app. */
export const canalInterno: CanalDeEntrega = {
  nome: "INTERNO",
  habilitado: true,
  async entregar(mensagem) {
    await prisma.notificacao.create({
      data: {
        userId: mensagem.userId,
        tipo: mensagem.tipo,
        titulo: mensagem.titulo,
        mensagem: mensagem.mensagem,
        link: mensagem.link,
      },
    });
  },
};

/**
 * Canais externos ainda não implementados. Ficam declarados para deixar claro
 * onde a integração entra: basta trocar o corpo de `entregar` (e a origem de
 * `habilitado`, provavelmente uma variável de ambiente ou uma preferência do
 * usuário). Enquanto `habilitado` for falso, o despachante nem os chama.
 */
export const canalEmail: CanalDeEntrega = {
  nome: "EMAIL",
  habilitado: false,
  async entregar() {
    throw new Error("Canal de e-mail ainda não implementado.");
  },
};

export const canalWhatsApp: CanalDeEntrega = {
  nome: "WHATSAPP",
  habilitado: false,
  async entregar() {
    throw new Error("Canal de WhatsApp ainda não implementado.");
  },
};

export const canalPush: CanalDeEntrega = {
  nome: "PUSH",
  habilitado: false,
  async entregar() {
    throw new Error("Canal de push ainda não implementado.");
  },
};

/** Ordem em que os canais são acionados. */
export const CANAIS: CanalDeEntrega[] = [canalInterno, canalEmail, canalWhatsApp, canalPush];

export function canaisHabilitados(): CanalDeEntrega[] {
  return CANAIS.filter((canal) => canal.habilitado);
}
