import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f81f7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]",
  {
    variants: {
      variant: {
        default: "bg-[#238636] text-[#f0f6fc] hover:bg-[#2ea043]",
        secondary: "bg-[#21262d] text-[#f0f6fc] hover:bg-[#30363d]",
        outline: "border border-[#30363d] bg-transparent text-[#f0f6fc] hover:bg-[#161b22]",
        ghost: "text-[#f0f6fc] hover:bg-[#161b22]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} type={type} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
