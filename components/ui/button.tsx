import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium tracking-[-0.42px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#0EA5E9] text-white rounded-[10px] hover:bg-[#0284C7]",
        destructive:
          "bg-red-500 text-white rounded-[10px] hover:bg-red-600",
        outline:
          "border border-[#E5E7EB] bg-white text-[#111827] rounded-[10px] hover:bg-[#F9FAFB] hover:border-[#D1D5DB]",
        secondary:
          "bg-[#F0F9FF] text-[#0EA5E9] rounded-[10px] hover:bg-[#E0F2FE]",
        ghost:
          "text-[#374151] rounded-[7px] hover:bg-[#F9FAFB] hover:text-[#111827]",
        link:
          "text-[#0EA5E9] underline-offset-4 hover:underline",
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
