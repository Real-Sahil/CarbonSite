import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-[10px] py-[3px] text-xs font-medium tracking-[-0.36px] transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:ring-offset-0",
  {
    variants: {
      variant: {
        default:
          "bg-teal-500/15 text-teal-300 border border-teal-500/20",
        secondary:
          "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
        outline:
          "text-white/60 border border-white/15",
        destructive:
          "bg-red-500/15 text-red-400 border border-red-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
