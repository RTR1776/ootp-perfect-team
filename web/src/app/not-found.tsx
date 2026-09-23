import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg overflow-hidden text-center">
        <div aria-hidden className="stitch-rule opacity-60" />
        <div className="flex flex-col items-center gap-4 px-6 py-10">
          <div className="stat-value text-6xl text-muted-foreground">404</div>
          <div className="flex flex-col gap-1.5">
            <h1 className="page-title text-3xl">Foul ball</h1>
            <p className="text-sm text-muted-foreground">That page is out of play.</p>
          </div>
          <Link href="/build" className={buttonVariants()}>Back to Build</Link>
        </div>
      </Card>
    </div>
  );
}
