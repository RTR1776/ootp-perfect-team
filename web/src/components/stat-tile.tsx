import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A headline number: small label, scoreboard value, optional footnote. */
export function StatTile({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "positive" | "negative" | "warning";
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden px-5 pt-4 pb-3.5", className)}>
      <div className="label-eyebrow">{label}</div>
      <div
        className={cn(
          "stat-value mt-1",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
