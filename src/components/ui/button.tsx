import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(85,214,232,0.35)] hover:shadow-[0_0_22px_rgba(85,214,232,0.55)] hover:-translate-y-0.5 active:translate-y-0",
        destructive: "bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 shadow-[0_0_12px_rgba(255,77,90,0.3)]",
        outline: "border border-white/10 bg-[#0E1626] text-slate-200 hover:bg-white/[0.06] hover:border-cyan-400/50 hover:text-cyan-400 shadow-sm",
        secondary: "bg-[#151F32] border border-white/[0.08] text-slate-200 hover:bg-[#1A263D] hover:text-white shadow-sm",
        ghost: "text-slate-300 hover:bg-white/[0.06] hover:text-cyan-400",
        link: "text-cyan-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-8",
        icon: "h-9 w-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
