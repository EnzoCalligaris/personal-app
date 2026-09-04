import { Loader2Icon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin text-current", {
  variants: {
    size: {
      xs: "size-3.5",
      sm: "size-4",
      default: "size-5",
      lg: "size-8",
    },
  },
  defaultVariants: { size: "default" },
});

function Spinner({
  className,
  size,
  label = "Carregando",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof spinnerVariants> & { label?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      data-slot="spinner"
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <Loader2Icon className={cn(spinnerVariants({ size }))} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export { Spinner, spinnerVariants };
