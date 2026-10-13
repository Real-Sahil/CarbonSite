import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-[12px] border border-[#131d29]/15 bg-white px-3 py-2 text-sm font-normal tracking-[-0.42px] text-[#131d29] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-normal placeholder:text-[#5B6A78] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2400c]/40 focus-visible:ring-offset-0 hover:border-[#131d29]/25 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
