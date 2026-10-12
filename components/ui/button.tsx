import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium tracking-[-0.42px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2400c]/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#c2400c] text-white rounded-full hover:bg-[#a33409]",
        destructive:
          "bg-red-500 text-white rounded-full hover:bg-red-600 border border-red-600",
        outline:
          "border border-[#131d29]/10 bg-white text-[#131d29] rounded-full shadow-[0_1px_4px_rgba(19,29,41,0.05)] hover:bg-[#F9FAFC] hover:border-[#131d29]/25",
        secondary:
          "bg-amber-50 text-amber-700 rounded-full hover:bg-amber-100 border border-amber-200",
        ghost:
          "text-[#41505F] rounded-full hover:bg-white hover:text-[#131d29]",
        link:
          "text-amber-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[21px] py-[14px] max-sm:min-h-11",
        sm:      "h-8 px-[14px] py-[7px] text-xs max-sm:min-h-11",
        lg:      "h-10 px-[28px] py-[14px] max-sm:min-h-11",
        icon:    "h-9 w-9 rounded-full max-sm:h-11 max-sm:w-11",
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
