import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-[10px] py-[3px] text-xs font-medium tracking-[-0.36px] transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-0",
  {
    variants: {
      variant: {
        default:
          "bg-teal-50 text-teal-700 border border-teal-200",
        secondary:
          "bg-emerald-50 text-emerald-700 border border-emerald-200",
        outline:
          "text-[#374151] border border-[#E5E7EB]",
        destructive:
          "bg-red-50 text-red-700 border border-red-200",
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
