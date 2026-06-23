import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // DESIGN.md: 16px 라운드(squircle), 견고한 핀테크 톤. 220ms 스냅 트랜지션.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-body-sm font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:opacity-90",
        secondary: "bg-surface-2 text-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-accent",
        outline: "border border-border bg-transparent text-foreground hover:bg-accent",
        destructive: "bg-destructive text-white hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // DESIGN.md: 표준 버튼 52px, 모든 버튼 최소 48px 터치 타깃.
      // 주의: size 에 text-* (font-size)를 넣으면 tailwind-merge 가 variant 의 text-primary-foreground
      // (글자색)까지 같은 text-* 그룹으로 보고 지워버려 글씨가 어두워진다. 그래서 size 엔 색/폰트 클래스 금지.
      size: {
        sm: "h-12 px-4", // 48px (최소 터치 타깃)
        md: "h-[52px] px-6", // 52px (표준)
        lg: "h-14 px-8", // 56px (대형 CTA)
        xl: "h-14 px-8",
        icon: "h-12 w-12", // 48px
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
