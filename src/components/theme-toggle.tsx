"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Alterna claro/escuro. Os dois ícones são renderizados e a visibilidade é
 * resolvida em CSS pela classe `dark` no <html> - assim não há divergência de
 * hidratação nem estado de "montado".
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label="Alternar tema claro e escuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="block dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </Button>
  );
}
