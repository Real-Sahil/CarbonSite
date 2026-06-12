import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "pressable inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-normal tracking-[-0.42px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3e17] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#0f3e17] text-[#fffefc] rounded-[14px] hover:bg-[#0a2e11]",
        destructive:
          "bg-red-500 text-white rounded-[14px] hover:bg-red-600",
        outline:
          "border border-[#e5e7eb] bg-[#fffefc] text-[#222222] rounded-[14px] hover:bg-[#e1f4df] hover:text-[#0f3e17]",
        secondary:
          "bg-[#e1f4df] text-[#0f3e17] rounded-[14px] hover:bg-[#cfe7d3]",
        ghost:
          "text-[#222222] rounded-[7px] hover:bg-[#e1f4df] hover:text-[#0f3e17]",
        link:
          "text-[#0f3e17] underline-offset-4 hover:underline",
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
