import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  CalendarDaysIcon,
  DumbbellIcon,
  HouseIcon,
  ListChecksIcon,
  TrendingUpIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  /** Rótulo curto usado na navegação inferior (mobile). */
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
  /** Se falso, aparece só na sidebar/rail (a barra inferior cabe 5 itens). */
  inBottomNav?: boolean;
};

export const personalNav: NavItem[] = [
  { label: "Visão geral", shortLabel: "Início", href: "/personal", icon: HouseIcon },
  { label: "Alunos", href: "/personal/alunos", icon: UsersRoundIcon },
  { label: "Treinos", href: "/personal/treinos", icon: DumbbellIcon },
  { label: "Agenda", href: "/personal/agenda", icon: CalendarDaysIcon },
  { label: "Avaliações", shortLabel: "Avaliação", href: "/personal/avaliacoes", icon: ActivityIcon },
  {
    label: "Exercícios",
    href: "/personal/exercicios",
    icon: ListChecksIcon,
    inBottomNav: false,
  },
];

export const alunoNav: NavItem[] = [
  { label: "Início", href: "/aluno", icon: HouseIcon },
  { label: "Meu treino", shortLabel: "Treino", href: "/aluno/treinos", icon: DumbbellIcon },
  { label: "Agenda", href: "/aluno/agenda", icon: CalendarDaysIcon },
  { label: "Evolução", href: "/aluno/evolucao", icon: TrendingUpIcon },
  { label: "Perfil", href: "/aluno/perfil", icon: UserRoundIcon },
];

/**
 * Configurações por área. Os componentes de navegação (client) importam daqui
 * diretamente: `icon` é um componente React e não pode atravessar a fronteira
 * server -> client como prop.
 */
export const navConfigs = {
  personal: { items: personalNav, rootHref: "/personal" },
  aluno: { items: alunoNav, rootHref: "/aluno" },
} as const;

export type NavKey = keyof typeof navConfigs;

/** Itens exibidos na barra inferior do mobile (no máximo 5). */
export function bottomNavItems(items: NavItem[]) {
  return items.filter((item) => item.inBottomNav !== false).slice(0, 5);
}

/** Marca a rota ativa considerando rotas aninhadas, sem casar "/personal" com tudo. */
export function isNavItemActive(pathname: string, href: string, rootHref: string) {
  if (href === rootHref) return pathname === rootHref;
  return pathname === href || pathname.startsWith(`${href}/`);
}
