import "server-only";

import { prisma } from "@/lib/prisma";
import { dataUTC } from "@/lib/date-utils";
import { sobrepoe } from "@/lib/agenda/horarios";
import { STATUS_ATIVOS } from "@/lib/agenda/status";

/**
 * A regra de ocupação da agenda, num lugar só.
 *
 * Um horário está indisponível por dois motivos independentes: já existe um
 * atendimento ativo em cima dele, ou o Personal bloqueou aquele pedaço do dia.
 * Quem pergunta são dois fluxos com vocabulários diferentes - o Personal
 * marcando na própria agenda e o aluno marcando na agenda do Personal - e cada
 * um traduz a resposta para os próprios erros e mensagens.
 *
 * Por isso nada aqui lança exceção nem conhece HTTP: a função devolve *o que*
 * impede o horário e quem chamou decide o que dizer, em que ordem. Enquanto as
 * duas cópias desta regra existiram lado a lado, elas divergiram sem ninguém
 * notar - a consulta do lado do aluno chegou a varrer o dia vizinho.
 */

export type Intervalo = { horaInicio: string; horaFim: string };

/** Bloqueio sem horário vale o dia inteiro. */
export type IntervaloDeBloqueio = { horaInicio: string | null; horaFim: string | null };

export type OcupacaoDoDia = {
  agendamentos: Intervalo[];
  bloqueios: IntervaloDeBloqueio[];
};

/** O bloqueio cobre o dia todo (foi criado sem horário de início e fim). */
export function bloqueiaDiaInteiro(bloqueio: IntervaloDeBloqueio): boolean {
  return !bloqueio.horaInicio || !bloqueio.horaFim;
}

/**
 * O que já ocupa um dia da agenda do Personal: atendimentos que ainda seguram
 * o horário (`STATUS_ATIVOS`) e os bloqueios do dia.
 *
 * `ignorarId` deixa de fora o próprio atendimento quando ele está sendo
 * remarcado - senão ele conflitaria consigo mesmo.
 */
export async function ocupacaoDoDia(
  personalId: string,
  dataISO: string,
  ignorarId?: string
): Promise<OcupacaoDoDia> {
  const data = dataUTC(dataISO);

  const [agendamentos, bloqueios] = await Promise.all([
    prisma.agendamento.findMany({
      where: {
        personalId,
        data,
        status: { in: [...STATUS_ATIVOS] },
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
      },
      select: { horaInicio: true, horaFim: true },
    }),
    prisma.bloqueio.findMany({
      where: { personalId, data },
      select: { horaInicio: true, horaFim: true },
    }),
  ]);

  return { agendamentos, bloqueios };
}

/** Os dois motivos são independentes: um horário pode ter os dois ao mesmo tempo. */
export type Conflito = {
  /** Já existe atendimento ativo cruzando este horário. */
  ocupado: boolean;
  /** O Personal bloqueou este horário (ou o dia inteiro). */
  bloqueado: boolean;
};

/** A checagem em si, sobre uma ocupação já carregada. */
export function conflitoEm(
  ocupacao: OcupacaoDoDia,
  horaInicio: string,
  horaFim: string
): Conflito {
  return {
    ocupado: ocupacao.agendamentos.some((item) =>
      sobrepoe(horaInicio, horaFim, item.horaInicio, item.horaFim)
    ),
    bloqueado: ocupacao.bloqueios.some((bloqueio) =>
      bloqueiaDiaInteiro(bloqueio)
        ? true
        : sobrepoe(horaInicio, horaFim, bloqueio.horaInicio!, bloqueio.horaFim!)
    ),
  };
}

/** Busca a ocupação do dia e diz o que impede aquele horário. */
export async function verificarConflito(
  personalId: string,
  dataISO: string,
  horaInicio: string,
  horaFim: string,
  ignorarId?: string
): Promise<Conflito> {
  const ocupacao = await ocupacaoDoDia(personalId, dataISO, ignorarId);
  return conflitoEm(ocupacao, horaInicio, horaFim);
}
