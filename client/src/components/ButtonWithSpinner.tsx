import { Button, buttonVariants } from "@/components/ui/button";
import { Loader2  } from 'lucide-react';
import { ReactNode } from "react";
import { VariantProps } from "class-variance-authority";
import { ComponentProps } from "react";

interface ButtonWithSpinnerProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  loadingText?: string;
  children: ReactNode;
  asChild?: boolean;
}

export function ButtonWithSpinner({
  isLoading = false,
  loadingText,
  children,
  disabled,
  ...props
}: ButtonWithSpinnerProps) {
  return (
    <Button disabled={disabled || isLoading} {...props}>
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {isLoading && loadingText ? loadingText : children}
    </Button>
  );
}
