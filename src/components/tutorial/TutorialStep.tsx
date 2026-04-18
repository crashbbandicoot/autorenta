import { cn } from "@/lib/utils";

interface TutorialStepProps {
  number: number;
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function TutorialStep({ number, title, children, className }: TutorialStepProps) {
  return (
    <div className={cn("flex gap-4", className)}>
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 text-blue-600 text-sm font-semibold flex items-center justify-center mt-0.5">
        {number}
      </div>
      <div className="flex-1 pb-6">
        <p className="font-medium text-gray-900">{title}</p>
        {children && <div className="mt-2 text-sm text-gray-600 space-y-2">{children}</div>}
      </div>
    </div>
  );
}
