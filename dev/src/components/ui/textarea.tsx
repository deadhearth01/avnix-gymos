import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-[10px] border border-input bg-card px-3 py-2.5 text-[15px] shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-subtle hover:border-foreground/20 focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive/60 aria-invalid:ring-4 aria-invalid:ring-destructive/10 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
