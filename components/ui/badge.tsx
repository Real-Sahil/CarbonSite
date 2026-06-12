import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-[14px] py-[7px] text-xs font-normal tracking-[-0.36px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0f3e17] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#b6ced5] text-[#0f3e17] border-transparent",
        secondary:
          "bg-[#e1f4df] text-[#0f3e17] border-transparent",
        outline:
          "text-[#222222] border border-[#e5e7eb]",
        destructive:
          "bg-red-100 text-red-700 border-transparent",
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
