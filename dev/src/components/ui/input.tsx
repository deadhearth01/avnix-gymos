import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "tabular h-10 w-full min-w-0 rounded-[10px] border border-input bg-card px-3 py-1 text-[15px] shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-subtle hover:border-foreground/20 focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive/60 aria-invalid:ring-4 aria-invalid:ring-destructive/10 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
