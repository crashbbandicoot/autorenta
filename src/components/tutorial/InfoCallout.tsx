import { cn } from "@/lib/utils";

type Variant = "info" | "warning" | "code";

interface InfoCalloutProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const styles: Record<Variant, string> = {
  info: "bg-blue-50 border-l-4 border-blue-400 text-blue-800",
  warning: "bg-amber-50 border-l-4 border-amber-400 text-amber-800",
  code: "bg-gray-100 font-mono text-sm text-gray-700 rounded-lg border-0",
};

export function InfoCallout({ variant = "info", children, className }: InfoCalloutProps) {
  return (
    <div className={cn("px-4 py-3 rounded-r-lg text-sm my-3", styles[variant], className)}>
      {children}
    </div>
  );
}
