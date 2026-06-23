import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // DESIGN.md: 옅은 fill(surface-2) + 투명 보더. 포커스 시 흰 배경 + primary 보더(2px). 48px 터치 타깃.
        "flex h-12 w-full rounded-lg border-2 border-transparent bg-surface-2 px-4 py-1 text-body",
        "placeholder:text-hint transition-colors",
        "focus-visible:bg-surface focus-visible:border-primary focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
