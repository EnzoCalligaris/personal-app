import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:brightness-105",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/70",
        outline:
          "border-border bg-card text-foreground [a]:hover:bg-muted",
        success:
          "bg-success/12 text-success dark:bg-success/18 [a]:hover:bg-success/20",
        warning:
          "bg-warning/15 text-warning dark:bg-warning/20 [a]:hover:bg-warning/25",
        info: "bg-info/12 text-info dark:bg-info/18 [a]:hover:bg-info/20",
        destructive:
          "bg-destructive/12 text-destructive dark:bg-destructive/18 [a]:hover:bg-destructive/20",
        ghost: "text-muted-foreground hover:bg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
