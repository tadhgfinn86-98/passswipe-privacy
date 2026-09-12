"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--brand)] text-[var(--brand-contrast)] shadow-[0_1px_2px_rgba(9,9,11,.16),inset_0_1px_0_rgba(255,255,255,.18)] hover:bg-[var(--brand-hover)] hover:shadow-[0_6px_20px_-6px_var(--brand-ring)]",
        secondary:
          "border border-border bg-card text-foreground shadow-subtle hover:border-border-strong hover:bg-card-muted",
        ghost: "text-muted-foreground hover:bg-card-muted hover:text-foreground",
        dark: "bg-foreground text-background hover:opacity-90",
        inverse:
          "bg-white text-[#0a0a0b] shadow-[0_1px_2px_rgba(0,0,0,.3)] hover:bg-white/90",
        outlineInverse:
          "border border-white/15 bg-white/5 text-white backdrop-blur hover:border-white/25 hover:bg-white/10",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        xl: "h-13 px-7 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

/** Arrow that nudges right on parent hover. */
export function ButtonArrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn(
        "size-4 transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5",
        className,
      )}
    >
      <path
        d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { buttonVariants };
