import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-[10px] py-[3px] text-xs font-medium tracking-[-0.36px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#EEF2FF] text-[#4F46E5] border-transparent",
        secondary:
          "bg-[#ECFDF5] text-[#059669] border-transparent",
        outline:
          "text-[#475569] border border-[#E2E8F0]",
        destructive:
          "bg-red-50 text-red-700 border-transparent",
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
