"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  label: string;
  badge?: boolean;
}

export function NavLink({ href, label, badge }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-1.5 px-1 py-4 text-sm font-medium transition-colors border-b-2",
        isActive
          ? "text-blue-600 border-blue-600"
          : "text-gray-500 border-transparent hover:text-gray-800"
      )}
    >
      {label}
      {badge && (
        <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
      )}
    </Link>
  );
}
