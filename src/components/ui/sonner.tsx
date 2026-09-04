"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const [isMobile, setIsMobile] = React.useState(false)

  // No mobile os toasts vão para o topo: a base da tela é da navegação inferior.
  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={isMobile ? "top-center" : "bottom-right"}
      offset={16}
      mobileOffset={12}
      gap={10}
      duration={4500}
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast !gap-3 !p-4 !shadow-overlay !ring-1 !ring-border font-sans",
          title: "!text-sm !font-semibold",
          description: "!text-sm !text-muted-foreground",
          actionButton: "!rounded-lg !bg-primary !text-primary-foreground !text-xs !font-medium",
          cancelButton: "!rounded-lg !bg-muted !text-muted-foreground !text-xs !font-medium",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
