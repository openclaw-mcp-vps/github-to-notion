import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      success: "bg-[#1f6feb]/20 text-[#58a6ff]",
      warning: "bg-[#9e6a03]/20 text-[#e3b341]",
      danger: "bg-[#da3633]/20 text-[#ff7b72]",
      neutral: "bg-[#30363d] text-[#c9d1d9]"
    }
  },
  defaultVariants: {
    variant: "neutral"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
