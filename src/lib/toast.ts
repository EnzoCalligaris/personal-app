import { toast as sonner } from "sonner";

type ToastOptions = {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

/**
 * Camada fina sobre o sonner para manter o feedback visual consistente em
 * toda a aplicação (mesmos ícones, duração e vocabulário).
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => sonner.success(message, options),
  error: (message: string, options?: ToastOptions) => sonner.error(message, options),
  info: (message: string, options?: ToastOptions) => sonner.info(message, options),
  warning: (message: string, options?: ToastOptions) => sonner.warning(message, options),
  loading: (message: string, options?: ToastOptions) => sonner.loading(message, options),
  dismiss: (id?: string | number) => sonner.dismiss(id),
  /** Feedback de uma operação assíncrona (carregando → sucesso/erro). */
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string | ((data: T) => string); error: string }
  ) => sonner.promise(promise, messages),
};
