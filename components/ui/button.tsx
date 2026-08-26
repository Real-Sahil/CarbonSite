import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium tracking-[-0.42px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-[10px] hover:from-teal-400 hover:to-cyan-400 shadow-[0_0_20px_rgba(13,148,136,0.3)]",
        destructive:
          "bg-red-500/80 text-white rounded-[10px] hover:bg-red-500 border border-red-500/20",
        outline:
          "border border-white/15 bg-white/6 text-white rounded-[10px] hover:bg-white/10 hover:border-white/25",
        secondary:
          "bg-teal-500/10 text-teal-300 rounded-[10px] hover:bg-teal-500/15 border border-teal-500/15",
        ghost:
          "text-white/50 rounded-[7px] hover:bg-white/6 hover:text-white/80",
        link:
          "text-teal-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[21px] py-[14px]",
        sm:      "h-8 px-[14px] py-[7px] text-xs",
        lg:      "h-10 px-[28px] py-[14px]",
        icon:    "h-9 w-9 rounded-[7px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
