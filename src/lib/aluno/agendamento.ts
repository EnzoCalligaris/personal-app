import "server-only";

import { prisma } from "@/lib/prisma";
import {
  dataDeCalendario,
  dataUTC,
  diaSemanaDeDataUTC,
  hojeUTC,
  intervaloDeDatas,
  paraISO,
  somarDiasUTC,
} from "@/lib/date-utils";
import { gerarSlots, removerOcupados, sobrepoe } from "@/lib/agenda/horarios";
import { STATUS_ATIVOS } from "@/lib/agenda/status";
import { hojeISO } from "@/lib/fuso";
import {
  instanteDoAtendimento,
  MENSAGEM_RECUSA,
  motivoParaNaoAgendar,
  podeDesmarcar,
} from "@/lib/agenda/regras";
import { regrasDoPersonal } from "@/lib/agenda/queries";
import { notificar } from "@/lib/notificacoes/enviar";
import type { RegrasAgendamento, SlotLivre } from "@/types/agenda";
import type {
  DiaParaAgendar,
  DiasParaAgendarResponse,
  HorariosParaAgendarResponse,
  MeuAgendamento,
} from "@/types/aluno-area";
import type {
  AgendarComoAlunoInput,
  EditarComoAlunoInput,
} from "@/lib/validations/agenda";

/**
 * Agendamento pelo aluno. Além das regras da agenda do Personal (horário de
 * trabalho, bloqueio e conflito), aqui valem as regras que ele configurou para
 * os alunos: antecedência, janela, limite de marcações e prazo de cancelamento.
 *
 * Tudo é resolvido a partir do `alunoId` da sessão - o aluno não escolhe o
 * Personal nem enxerga a agenda de ninguém.
 */

export class SemPersonalError extends Error {
  constructor() {
    super("Você ainda não está vinculado a um Personal Trainer.");
    this.name = "SemPersonalError";
  }
}

export class AgendamentoRecusadoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "AgendamentoRecusadoError";
  }
}

export class AgendamentoNaoEncontradoError extends Error {
  constructor() {
    super("Agendamento não encontrado.");
    this.name = "AgendamentoNaoEncontradoError";
  }
}

/** Quantos dias à frente a tela de agendamento mostra por padrão. */
const DIAS_NA_TELA = 21;

async function personalDoAluno(alunoId: string) {
  const aluno = await prisma.alunoProfile.findUnique({
    where: { id: alunoId },
    select: {
      personalId: true,
      status: true,
      user: { select: { name: true } },
      personal: { select: { user: { select: { name: true, email: true, avatarUrl: true } } } },
    },
  });

  if (!aluno?.personalId) throw new SemPersonalError();
  return {
    personalId: aluno.personalId,
    personal: aluno.personal,
    nomeDoAluno: aluno.user.name,
    /**
     * Aluno inativo é aluno com quem o Personal encerrou (ou pausou) o
     * trabalho. Ele continua enxergando o próprio histórico - o dado é dele -
     * mas não toma mais horário na agenda de quem o desativou.
     */
    ativo: aluno.status === "ATIVO",
  };
}

/** Atendimentos futuros que ainda ocupam a agenda do aluno. */
async function ativosDoAluno(alunoId: string, agora: Date) {
  return prisma.agendamento.count({
    where: {
      alunoId,
      status: { in: [...STATUS_ATIVOS] },
      // A coluna é uma data de calendário: compara com o dia de hoje no
      // Brasil, não com o instante em que a consulta rodou.
      data: { gte: dataUTC(hojeISO(agora)) },
    },
  });
}

/* -------------------------------------------------------------------------
   Horários que o aluno pode escolher
   ------------------------------------------------------------------------- */

/**
 * Horários realmente disponíveis para o aluno em uma data: o que sobra dos
 * horários de trabalho depois de tirar bloqueios, atendimentos de qualquer
 * aluno e tudo que as regras não permitem (passado, antecedência, janela).
 */
export async function horariosParaAgendar(
  alunoId: string,
  dataISO: string,
  agora: Date = new Date()
): Promise<HorariosParaAgendarResponse> {
  const { personalId, ativo } = await personalDoAluno(alunoId);
  const regras = await regrasDoPersonal(personalId);

  const vazio = (motivo: HorariosParaAgendarResponse["motivo"], mensagem: string | null = null) => ({
    data: dataISO,
    livres: [],
    motivo,
    mensagem,
  });

  if (!ativo) return vazio("ALUNO_INATIVO", MENSAGEM_RECUSA.ALUNO_INATIVO);

  if (!regras.permiteAgendamento) {
    return vazio("AGENDAMENTO_DESATIVADO", MENSAGEM_RECUSA.AGENDAMENTO_DESATIVADO);
  }

  if ((await ativosDoAluno(alunoId, agora)) >= regras.maxAtivosPorAluno) {
    return vazio("LIMITE_ATINGIDO", MENSAGEM_RECUSA.LIMITE_ATINGIDO);
  }

  const data = dataUTC(dataISO);
  const diaSemana = diaSemanaDeDataUTC(data);

  const [faixas, ocupados, bloqueios] = await Promise.all([
    prisma.disponibilidade.findMany({ where: { personalId, diaSemana } }),
    prisma.agendamento.findMany({
      where: {
        personalId,
        data,
        status: { in: [...STATUS_ATIVOS] },
      },
      select: { horaInicio: true, horaFim: true },
    }),
    prisma.bloqueio.findMany({ where: { personalId, data } }),
  ]);

  if (faixas.length === 0) return vazio("SEM_TRABALHO", "Seu Personal não atende neste dia.");
  if (bloqueios.some((bloqueio) => !bloqueio.horaInicio || !bloqueio.horaFim)) {
    return vazio("BLOQUEADO", "Seu Personal bloqueou este dia.");
  }

  const disputados = [
    ...ocupados,
    ...bloqueios
      .filter((bloqueio) => bloqueio.horaInicio && bloqueio.horaFim)
      .map((bloqueio) => ({ horaInicio: bloqueio.horaInicio!, horaFim: bloqueio.horaFim! })),
  ];

  const doDia = removerOcupados(
    faixas.flatMap((faixa) => gerarSlots(faixa.horaInicio, faixa.horaFim, faixa.duracaoMin)),
    disputados
  );

  // Cada horário passa pelas regras do aluno: passado, antecedência e janela.
  const recusas = new Set<string>();
  const livres = doDia.filter((slot) => {
    const motivo = motivoParaNaoAgendar(
      instanteDoAtendimento(dataISO, slot.horaInicio),
      regras,
      agora
    );
    if (motivo) recusas.add(motivo);
    return motivo === null;
  });

  if (livres.length > 0) {
    return {
      data: dataISO,
      livres: livres.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
      motivo: "OK",
      mensagem: null,
    };
  }

  // Sem horário: o motivo mais informativo é o da regra que barrou.
  if (recusas.has("FORA_DA_JANELA")) {
    return vazio("FORA_DA_JANELA", MENSAGEM_RECUSA.FORA_DA_JANELA);
  }
  if (recusas.has("ANTECEDENCIA")) return vazio("ANTECEDENCIA", MENSAGEM_RECUSA.ANTECEDENCIA);
  if (recusas.has("PASSADO")) return vazio("PASSADO", MENSAGEM_RECUSA.PASSADO);

  return vazio("LOTADO", "Todos os horários deste dia já foram preenchidos.");
}

/** A janela de dias com a contagem de horários livres em cada um. */
export async function diasParaAgendar(
  alunoId: string,
  agora: Date = new Date(),
  dias = DIAS_NA_TELA
): Promise<DiasParaAgendarResponse> {
  const { personalId, personal } = await personalDoAluno(alunoId);
  const regras = await regrasDoPersonal(personalId);

  const hoje = hojeUTC();
  const ate = somarDiasUTC(hoje, Math.min(dias, regras.janelaDias) - 1);
  const datas = intervaloDeDatas(hoje, ate);

  const [faixas, ocupados, bloqueios, ativos] = await Promise.all([
    prisma.disponibilidade.findMany({ where: { personalId } }),
    prisma.agendamento.findMany({
      where: {
        personalId,
        data: { gte: hoje, lte: ate },
        status: { in: [...STATUS_ATIVOS] },
      },
      select: { data: true, horaInicio: true, horaFim: true },
    }),
    prisma.bloqueio.findMany({ where: { personalId, data: { gte: hoje, lte: ate } } }),
    ativosDoAluno(alunoId, agora),
  ]);

  const ocupadosPorDia = new Map<string, SlotLivre[]>();
  for (const item of ocupados) {
    const iso = dataDeCalendario(item.data);
    ocupadosPorDia.set(iso, [
      ...(ocupadosPorDia.get(iso) ?? []),
      { horaInicio: item.horaInicio, horaFim: item.horaFim },
    ]);
  }

  const bloqueiosPorDia = new Map<string, typeof bloqueios>();
  for (const bloqueio of bloqueios) {
    const iso = paraISO(bloqueio.data);
    bloqueiosPorDia.set(iso, [...(bloqueiosPorDia.get(iso) ?? []), bloqueio]);
  }

  const podeMarcar = regras.permiteAgendamento && ativos < regras.maxAtivosPorAluno;

  const resultado: DiaParaAgendar[] = datas.map((data) => {
    const iso = paraISO(data);
    const diaSemana = diaSemanaDeDataUTC(data);
    const doDia = bloqueiosPorDia.get(iso) ?? [];

    if (!podeMarcar || doDia.some((bloqueio) => !bloqueio.horaInicio || !bloqueio.horaFim)) {
      return { data: iso, diaSemana, livres: 0, indisponivel: true };
    }

    const disputados = [
      ...(ocupadosPorDia.get(iso) ?? []),
      ...doDia
        .filter((bloqueio) => bloqueio.horaInicio && bloqueio.horaFim)
        .map((bloqueio) => ({ horaInicio: bloqueio.horaInicio!, horaFim: bloqueio.horaFim! })),
    ];

    const livres = removerOcupados(
      faixas
        .filter((faixa) => faixa.diaSemana === diaSemana)
        .flatMap((faixa) => gerarSlots(faixa.horaInicio, faixa.horaFim, faixa.duracaoMin)),
      disputados
    ).filter(
      (slot) =>
        motivoParaNaoAgendar(instanteDoAtendimento(iso, slot.horaInicio), regras, agora) === null
    );

    return { data: iso, diaSemana, livres: livres.length, indisponivel: livres.length === 0 };
  });

  return {
    de: paraISO(hoje),
    ate: paraISO(ate),
    dias: resultado,
    regras,
    ativos,
    personal: personal
      ? {
          nome: personal.user.name,
          email: personal.user.email,
          avatarUrl: personal.user.avatarUrl,
        }
      : null,
  };
}

/* -------------------------------------------------------------------------
   Marcar, cancelar e reagendar
   ------------------------------------------------------------------------- */

/** Revalida no servidor tudo o que a tela já filtrou. */
async function garantirQuePodeMarcar(
  alunoId: string,
  personalId: string,
  regras: RegrasAgendamento,
  input: { data: string; horaInicio: string; horaFim: string },
  agora: Date,
  ignorarId?: string
) {
  const motivo = motivoParaNaoAgendar(
    instanteDoAtendimento(input.data, input.horaInicio),
    regras,
    agora
  );
  if (motivo) throw new AgendamentoRecusadoError(MENSAGEM_RECUSA[motivo]);

  if (!ignorarId && (await ativosDoAluno(alunoId, agora)) >= regras.maxAtivosPorAluno) {
    throw new AgendamentoRecusadoError(MENSAGEM_RECUSA.LIMITE_ATINGIDO);
  }

  const data = dataUTC(input.data);

  const [faixas, ocupados, bloqueios] = await Promise.all([
    prisma.disponibilidade.findMany({
      where: { personalId, diaSemana: diaSemanaDeDataUTC(data) },
    }),
    prisma.agendamento.findMany({
      where: {
        personalId,
        data,
        status: { in: [...STATUS_ATIVOS] },
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
      },
      select: { horaInicio: true, horaFim: true },
    }),
    prisma.bloqueio.findMany({ where: { personalId, data } }),
  ]);

  // O horário precisa caber inteiro dentro de uma faixa de trabalho: o aluno
  // não escolhe horários fora do expediente.
  const dentroDoExpediente = faixas.some(
    (faixa) => input.horaInicio >= faixa.horaInicio && input.horaFim <= faixa.horaFim
  );
  if (!dentroDoExpediente) {
    throw new AgendamentoRecusadoError("Seu Personal não atende neste horário.");
  }

  const bloqueado = bloqueios.some((bloqueio) =>
    !bloqueio.horaInicio || !bloqueio.horaFim
      ? true
      : sobrepoe(input.horaInicio, input.horaFim, bloqueio.horaInicio, bloqueio.horaFim)
  );
  if (bloqueado) throw new AgendamentoRecusadoError("Este horário está bloqueado.");

  const ocupado = ocupados.some((item) =>
    sobrepoe(input.horaInicio, input.horaFim, item.horaInicio, item.horaFim)
  );
  if (ocupado) throw new AgendamentoRecusadoError("Este horário acabou de ser preenchido.");
}

function toMeuAgendamento(
  agendamento: {
    id: string;
    data: Date;
    horaInicio: string;
    horaFim: string;
    status: MeuAgendamento["status"];
    observacoes: string | null;
  },
  regras: RegrasAgendamento,
  agora: Date
): MeuAgendamento {
  const iso = dataDeCalendario(agendamento.data);
  const ativo = (STATUS_ATIVOS as readonly string[]).includes(agendamento.status);

  return {
    id: agendamento.id,
    // O dia do atendimento, não o instante: "2026-09-16". Devolver o ISO
    // completo fazia a tela do aluno exibir a véspera (meia-noite UTC é 21h
    // do dia anterior em São Paulo) e quebrava a data relativa.
    data: iso,
    horaInicio: agendamento.horaInicio,
    horaFim: agendamento.horaFim,
    status: agendamento.status,
    observacoes: agendamento.observacoes,
    podeDesmarcar:
      ativo && podeDesmarcar(instanteDoAtendimento(iso, agendamento.horaInicio), regras, agora),
  };
}

export async function agendarComoAluno(
  alunoId: string,
  input: AgendarComoAlunoInput,
  agora: Date = new Date()
): Promise<MeuAgendamento> {
  const { personalId, nomeDoAluno, ativo } = await personalDoAluno(alunoId);
  if (!ativo) throw new AgendamentoRecusadoError(MENSAGEM_RECUSA.ALUNO_INATIVO);

  const regras = await regrasDoPersonal(personalId);

  await garantirQuePodeMarcar(alunoId, personalId, regras, input, agora);

  const agendamento = await prisma.agendamento.create({
    data: {
      personalId,
      alunoId,
      data: dataUTC(input.data),
      horaInicio: input.horaInicio,
      horaFim: input.horaFim,
      // Nasce à espera do aceite, salvo se o Personal liberou a confirmação.
      status: regras.confirmacaoAutomatica ? "CONFIRMADO" : "AGENDADO",
      observacoes: input.observacoes?.trim() || null,
    },
  });

  // O Personal precisa saber que apareceu horário novo na agenda dele.
  await notificar({
    tipo: "NOVO_AGENDAMENTO",
    personalId,
    quem: nomeDoAluno,
    quando: { data: input.data, horaInicio: input.horaInicio, horaFim: input.horaFim },
  });

  return toMeuAgendamento(agendamento, regras, agora);
}

/** Cancelar ou reagendar - sempre dentro do prazo definido pelo Personal. */
export async function editarComoAluno(
  alunoId: string,
  agendamentoId: string,
  input: EditarComoAlunoInput,
  agora: Date = new Date()
): Promise<MeuAgendamento> {
  const atual = await prisma.agendamento.findFirst({
    where: { id: agendamentoId, alunoId },
  });
  if (!atual) throw new AgendamentoNaoEncontradoError();

  const { personalId, nomeDoAluno, ativo } = await personalDoAluno(alunoId);
  const regras = await regrasDoPersonal(personalId);

  if (!(STATUS_ATIVOS as readonly string[]).includes(atual.status)) {
    throw new AgendamentoRecusadoError("Este atendimento não está mais ativo.");
  }

  // Cancelar segue permitido mesmo inativo - soltar um horário não ocupa
  // agenda de ninguém. Remarcar, sim: tomaria um horário novo.
  if (!ativo && input.status !== "CANCELADO") {
    throw new AgendamentoRecusadoError(MENSAGEM_RECUSA.ALUNO_INATIVO);
  }

  const inicioAtual = instanteDoAtendimento(
    dataDeCalendario(atual.data),
    atual.horaInicio
  );
  if (!podeDesmarcar(inicioAtual, regras, agora)) {
    throw new AgendamentoRecusadoError(
      `Só é possível alterar com ${regras.cancelamentoMinHoras}h de antecedência. Fale com seu Personal.`
    );
  }

  if (input.status === "CANCELADO") {
    const cancelado = await prisma.agendamento.update({
      where: { id: atual.id },
      data: { status: "CANCELADO" },
    });

    await notificar({
      tipo: "AGENDAMENTO_CANCELADO",
      personalId,
      porQuem: "ALUNO",
      quem: nomeDoAluno,
      quando: {
        data: dataDeCalendario(cancelado.data),
        horaInicio: cancelado.horaInicio,
        horaFim: cancelado.horaFim,
      },
    });

    return toMeuAgendamento(cancelado, regras, agora);
  }

  const novo = {
    data: input.data!,
    horaInicio: input.horaInicio!,
    horaFim: input.horaFim!,
  };

  await garantirQuePodeMarcar(alunoId, personalId, regras, novo, agora, atual.id);

  const reagendado = await prisma.agendamento.update({
    where: { id: atual.id },
    data: {
      data: dataUTC(novo.data),
      horaInicio: novo.horaInicio,
      horaFim: novo.horaFim,
      status: "REAGENDADO",
    },
  });

  await notificar({
    tipo: "AGENDAMENTO_REAGENDADO",
    personalId,
    porQuem: "ALUNO",
    quem: nomeDoAluno,
    quando: { data: novo.data, horaInicio: novo.horaInicio, horaFim: novo.horaFim },
  });

  return toMeuAgendamento(reagendado, regras, agora);
}
