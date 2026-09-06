"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { toast } from "@/lib/toast";
import type { Avaliacao } from "@/types/avaliacao";
import type { AlunoListResponse } from "@/types/aluno";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalClose } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

/**
 * Campos da balança. Nenhum é obrigatório: cada equipamento mede um conjunto
 * diferente, e o que ficar em branco é gravado como "sem valor".
 */
const CAMPOS: {
  chave: keyof Omit<Avaliacao, "id" | "data" | "aluno" | "observacoes" | "medidas" | "variacao">;
  rotulo: string;
  unidade?: string;
  passo?: string;
  grupo: "composicao" | "metabolismo";
}[] = [
  { chave: "peso", rotulo: "Peso", unidade: "kg", passo: "0.1", grupo: "composicao" },
  { chave: "imc", rotulo: "IMC", passo: "0.1", grupo: "composicao" },
  { chave: "percentualGordura", rotulo: "Gordura", unidade: "%", passo: "0.1", grupo: "composicao" },
  { chave: "massaGorda", rotulo: "Massa de gordura", unidade: "kg", passo: "0.1", grupo: "composicao" },
  { chave: "massaMuscular", rotulo: "Massa muscular", unidade: "kg", passo: "0.1", grupo: "composicao" },
  { chave: "massaMagra", rotulo: "Massa magra", unidade: "kg", passo: "0.1", grupo: "composicao" },
  { chave: "massaOssea", rotulo: "Massa óssea", unidade: "kg", passo: "0.1", grupo: "composicao" },
  { chave: "aguaPercentual", rotulo: "Água corporal", unidade: "%", passo: "0.1", grupo: "metabolismo" },
  { chave: "aguaLitros", rotulo: "Água corporal", unidade: "L", passo: "0.1", grupo: "metabolismo" },
  { chave: "gorduraVisceral", rotulo: "Gordura visceral", unidade: "nível", passo: "0.1", grupo: "metabolismo" },
  { chave: "metabolismoBasal", rotulo: "Metabolismo basal", unidade: "kcal", grupo: "metabolismo" },
  { chave: "idadeMetabolica", rotulo: "Idade metabólica", unidade: "anos", grupo: "metabolismo" },
];

/** Circunferências mais comuns; o Personal preenche só o que mediu. */
const CIRCUNFERENCIAS = [
  { chave: "peito", rotulo: "Peito" },
  { chave: "cintura", rotulo: "Cintura" },
  { chave: "quadril", rotulo: "Quadril" },
  { chave: "braco", rotulo: "Braço" },
  { chave: "coxa", rotulo: "Coxa" },
  { chave: "panturrilha", rotulo: "Panturrilha" },
];

type Valores = Record<string, string>;

function hojeISO() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(
    agora.getDate()
  ).padStart(2, "0")}`;
}

function paraFormulario(avaliacao: Avaliacao | null): Valores {
  const valores: Valores = { data: avaliacao ? avaliacao.data.slice(0, 10) : hojeISO() };

  for (const campo of CAMPOS) {
    const valor = avaliacao?.[campo.chave];
    valores[campo.chave] = valor === null || valor === undefined ? "" : String(valor);
  }
  for (const medida of CIRCUNFERENCIAS) {
    const valor = avaliacao?.medidas?.[medida.chave];
    valores[`medida_${medida.chave}`] = valor === undefined ? "" : String(valor);
  }

  valores.observacoes = avaliacao?.observacoes ?? "";
  return valores;
}

/** Só o que foi preenchido vira número; o resto vai como null. */
function paraPayload(valores: Valores, alunoId?: string) {
  const medidas: Record<string, number> = {};
  for (const medida of CIRCUNFERENCIAS) {
    const valor = valores[`medida_${medida.chave}`]?.trim();
    if (valor) medidas[medida.chave] = Number(valor);
  }

  return {
    ...(alunoId ? { alunoId } : {}),
    data: valores.data,
    ...Object.fromEntries(
      CAMPOS.map((campo) => [campo.chave, valores[campo.chave]?.trim() ? valores[campo.chave] : null])
    ),
    observacoes: valores.observacoes?.trim() || null,
    medidas: Object.keys(medidas).length ? medidas : null,
  };
}

export function AvaliacaoFormModal({
  open,
  onOpenChange,
  avaliacao,
  alunoFixo,
  onSalvo,
}: {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  /** Presente = edição/correção. */
  avaliacao?: Avaliacao | null;
  /** Quando a avaliação é criada dentro da ficha de um aluno. */
  alunoFixo?: { id: string; nome: string } | null;
  onSalvo: () => void;
}) {
  const editando = !!avaliacao;

  const [valores, setValores] = React.useState<Valores>(() => paraFormulario(null));
  const [alunoId, setAlunoId] = React.useState(alunoFixo?.id ?? "");
  const [salvando, setSalvando] = React.useState(false);

  // Reabrir em outro contexto recomeça do valor certo.
  const [contexto, setContexto] = React.useState("");
  const contextoAtual = `${open}:${avaliacao?.id ?? "novo"}:${alunoFixo?.id ?? ""}`;
  if (open && contexto !== contextoAtual) {
    setContexto(contextoAtual);
    setValores(paraFormulario(avaliacao ?? null));
    setAlunoId(avaliacao?.aluno.id ?? alunoFixo?.id ?? "");
  }

  const { data: alunosData } = useApi<AlunoListResponse>(
    open && !editando && !alunoFixo ? "/api/personal/alunos?status=ATIVO" : null
  );
  const alunos = alunosData?.alunos ?? [];
  const nomeDoAluno =
    avaliacao?.aluno.nome ??
    alunoFixo?.nome ??
    alunos.find((aluno) => aluno.id === alunoId)?.nome;

  function mudar(chave: string, valor: string) {
    setValores((atual) => ({ ...atual, [chave]: valor }));
  }

  async function salvar() {
    if (!editando && !alunoId) {
      toast.error("Escolha o aluno.");
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch(
        editando ? `/api/personal/avaliacoes/${avaliacao!.id}` : "/api/personal/avaliacoes",
        {
          method: editando ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paraPayload(valores, editando ? undefined : alunoId)),
        }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(body?.error ?? "Não foi possível salvar a avaliação.");
        return;
      }

      toast.success(editando ? "Avaliação corrigida." : "Avaliação registrada.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  const composicao = CAMPOS.filter((campo) => campo.grupo === "composicao");
  const metabolismo = CAMPOS.filter((campo) => campo.grupo === "metabolismo");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editando ? "Corrigir avaliação" : "Nova avaliação"}
      description="Preencha só o que o seu equipamento mediu - os campos em branco ficam sem valor."
      footer={
        <>
          <ModalClose render={<Button variant="ghost">Cancelar</Button>} />
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Spinner /> : <CheckIcon />}
            {editando ? "Salvar correção" : "Registrar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="avaliacao-aluno">Aluno</Label>
            {editando || alunoFixo ? (
              <Input id="avaliacao-aluno" value={nomeDoAluno ?? ""} readOnly disabled />
            ) : (
              <Select value={alunoId} onValueChange={(valor) => setAlunoId(valor ?? "")}>
                <SelectTrigger id="avaliacao-aluno" className="w-full">
                  <SelectValue placeholder="Selecione o aluno">
                    {() => nomeDoAluno ?? "Selecione o aluno"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {alunos.map((aluno) => (
                    <SelectItem key={aluno.id} value={aluno.id}>
                      {aluno.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="avaliacao-data">Data</Label>
            <Input
              id="avaliacao-data"
              type="date"
              value={valores.data}
              onChange={(evento) => mudar("data", evento.target.value)}
            />
          </div>
        </div>

        <Grupo titulo="Composição corporal">
          {composicao.map((campo) => (
            <CampoMedida
              key={campo.chave}
              campo={campo}
              valor={valores[campo.chave] ?? ""}
              onChange={(valor) => mudar(campo.chave, valor)}
            />
          ))}
        </Grupo>

        <Grupo titulo="Água e metabolismo">
          {metabolismo.map((campo) => (
            <CampoMedida
              key={campo.chave}
              campo={campo}
              valor={valores[campo.chave] ?? ""}
              onChange={(valor) => mudar(campo.chave, valor)}
            />
          ))}
        </Grupo>

        <Grupo titulo="Circunferências (cm)">
          {CIRCUNFERENCIAS.map((medida) => (
            <div key={medida.chave} className="flex flex-col gap-1.5">
              <Label htmlFor={`medida-${medida.chave}`} className="text-xs">
                {medida.rotulo}
              </Label>
              <Input
                id={`medida-${medida.chave}`}
                type="number"
                inputMode="decimal"
                step="0.5"
                placeholder="--"
                value={valores[`medida_${medida.chave}`] ?? ""}
                onChange={(evento) => mudar(`medida_${medida.chave}`, evento.target.value)}
              />
            </div>
          ))}
        </Grupo>

        <div className="flex flex-col gap-2">
          <Label htmlFor="avaliacao-observacoes">Observações</Label>
          <Textarea
            id="avaliacao-observacoes"
            rows={3}
            maxLength={1000}
            value={valores.observacoes ?? ""}
            onChange={(evento) => mudar("observacoes", evento.target.value)}
            placeholder="Contexto da medição, equipamento usado, orientações..."
          />
        </div>
      </div>
    </Modal>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">{titulo}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function CampoMedida({
  campo,
  valor,
  onChange,
}: {
  campo: (typeof CAMPOS)[number];
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`campo-${campo.chave}`} className="text-xs">
        {campo.rotulo}
        {campo.unidade ? (
          <span className="font-normal text-muted-foreground"> ({campo.unidade})</span>
        ) : null}
      </Label>
      <Input
        id={`campo-${campo.chave}`}
        type="number"
        inputMode="decimal"
        step={campo.passo ?? "1"}
        placeholder="--"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
      />
    </div>
  );
}
