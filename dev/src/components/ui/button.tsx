import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "anim-host group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-out outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_color-mix(in_oklab,var(--primary)_30%,transparent)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_4px_14px_-4px_color-mix(in_oklab,var(--primary)_55%,transparent)] hover:brightness-[1.06]",
        outline: "border-border bg-card text-foreground shadow-[var(--shadow-card)] hover:bg-muted/70 aria-expanded:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted-foreground/12",
        soft: "bg-success-soft text-success-ink hover:bg-success-soft/70",
        ghost: "text-foreground/80 hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive: "bg-destructive text-white shadow-[0_1px_2px_rgb(220_38_38/0.3)] hover:brightness-110",
        "destructive-soft": "bg-danger-soft text-danger-ink hover:bg-danger-soft/70",
        dark: "bg-foreground text-background hover:bg-foreground/90",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5",
        xs: "h-7 gap-1 rounded-lg px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-[13px]",
        lg: "h-10 px-4 text-[15px]",
        xl: "h-12 rounded-xl px-5 text-base",
        icon: "size-9",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

function Button({ className, variant = "default", size = "default", asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <span className="absolute inset-0 grid place-items-center">
              <Loader2 className="size-4 animate-spin" />
            </span>
          )}
          <span className={cn("contents", loading && "text-transparent [&>*]:opacity-0")}>{children}</span>
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
