"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronsUpDownIcon, LogOutIcon, UserRoundIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/lib/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SessionUser = {
  name: string;
  email: string;
  role: "PERSONAL" | "ALUNO";
  profileHref: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu({
  user,
  variant = "topbar",
}: {
  user: SessionUser;
  variant?: "topbar" | "sidebar";
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("logout failed");
      toast.success("Sessão encerrada");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair", { description: "Tente novamente." });
      setLoggingOut(false);
    }
  }

  const roleLabel = user.role === "PERSONAL" ? "Personal Trainer" : "Aluno";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          variant === "sidebar" ? (
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors outline-none",
                "hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/40"
              )}
            />
          ) : (
            <button
              type="button"
              className="tap-target flex items-center gap-2 rounded-full p-0.5 transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
          )
        }
      >
        <Avatar size={variant === "sidebar" ? "default" : "default"}>
          <AvatarFallback className="bg-primary/15 font-medium text-primary dark:bg-primary/20">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        {variant === "sidebar" ? (
          <>
            <span className="hidden min-w-0 flex-1 flex-col lg:flex">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
            </span>
            <ChevronsUpDownIcon className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
          </>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        {/*
          O nome e o e-mail são a legenda deste grupo: `DropdownMenuLabel` é o
          `Menu.GroupLabel` do Base UI, que registra o próprio id no
          `Menu.Group` para as ações abaixo serem anunciadas como "as opções
          desta conta". Sem o grupo em volta, ele lança e derruba a árvore.
        */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href={user.profileHref} />}>
            <UserRoundIcon />
            Meu perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={handleLogout}
            disabled={loggingOut}
            closeOnClick={false}
          >
            {loggingOut ? <Spinner size="xs" /> : <LogOutIcon />}
            {loggingOut ? "Saindo..." : "Sair"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
