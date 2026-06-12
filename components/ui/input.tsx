import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-[14px] border border-[#e5e7eb] bg-[#fffefc] px-[14px] py-[7px] text-sm font-normal tracking-[-0.42px] text-black transition-colors file:border-0 file:bg-transparent file:text-sm file:font-normal placeholder:text-[#333333] placeholder:font-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3e17] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
