"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700",
        secondary:
          "bg-neutral-800 text-neutral-100 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600",
        ghost:
          "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800",
        destructive:
          "bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-600/20",
        outline:
          "border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100",
        glass:
          "bg-white/5 backdrop-blur-sm border border-white/10 text-neutral-200 hover:bg-white/10",
      },
      size: {
        xs: "h-7 px-2.5 text-xs",
        sm: "h-8 px-3 text-sm",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-5 text-base",
        xl: "h-13 px-7 text-base",
        icon: "h-9 w-9 text-sm",
        "icon-sm": "h-7 w-7 text-xs",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...(props as React.ComponentPropsWithRef<typeof motion.button>)}
      >
        {loading && (
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        )}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
