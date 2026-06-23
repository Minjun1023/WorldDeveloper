import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // DESIGN.md: 칩/배지는 pill(완전 둥근). 카테고리·지역 마커.
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium",
  {
    variants: {
      variant: {
        default: "bg-surface-2 text-muted-foreground",
        outline: "border border-border text-foreground",
        primary: "bg-primary-tint text-primary",
        success: "text-success",
        destructive: "text-destructive",
        muted: "bg-surface-2 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
