"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** A page threw — usually the database. Say so plainly and offer a retry. */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg overflow-hidden">
        <div aria-hidden className="h-1 bg-negative" />
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-negative/10 text-negative">
            <AlertTriangle className="size-7" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="page-title text-3xl">Rain delay</h1>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              This page couldn&rsquo;t load. Most often the database is waking up — try again in a moment.
            </p>
            {error.digest && <p className="font-mono text-[11px] text-muted-foreground">ref {error.digest}</p>}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => unstable_retry()}>
              <RotateCw /> Try again
            </Button>
            <Link href="/build" className={buttonVariants({ variant: "outline" })}>Go to Build</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
