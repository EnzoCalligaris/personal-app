"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const modalSizes = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
} as const;

type ModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Elemento que abre o modal (uso não controlado). */
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Ações do rodapé - já vêm alinhadas e empilhadas no mobile. */
  footer?: React.ReactNode;
  size?: keyof typeof modalSizes;
  className?: string;
  showCloseButton?: boolean;
};

/**
 * Modal padrão da aplicação: bottom sheet no mobile, diálogo centralizado no
 * desktop. Encapsula a composição do Dialog para o uso mais comum.
 */
function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  showCloseButton = true,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : null}
      <DialogContent className={cn(modalSizes[size], className)} showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

export { Modal, DialogClose as ModalClose, DialogTrigger as ModalTrigger };
