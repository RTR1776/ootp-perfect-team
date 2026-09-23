import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The baseball mark plus the condensed wordmark. */
export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/build" className={cn("flex items-center gap-2.5 rounded-md", className)} aria-label="PT Optimizer home">
      <Image src="/app-icon.png" alt="" width={32} height={32} priority className="size-8 rounded-lg shadow-sm" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-bold uppercase tracking-wide">PT Optimizer</span>
        <span className="text-[11px] font-medium text-muted-foreground">Kansas City Torrent</span>
      </span>
    </Link>
  );
}
