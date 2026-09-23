import { cn } from "@/lib/utils";

/**
 * One header for every page: an optional eyebrow, the condensed display title,
 * a short description, and actions on the right. Long explanations go in
 * `about`, folded away behind "About this page" so the data comes first.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  about,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  about?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 max-w-4xl">
        {eyebrow && <div className="label-eyebrow mb-1">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <div className="mt-1.5 text-sm text-muted-foreground">{description}</div>}
        {about && (
          <details className="group mt-2 text-sm text-muted-foreground">
            <summary className="w-fit cursor-pointer select-none text-xs font-medium text-foreground/80 hover:text-foreground">
              <span className="group-open:hidden">About this page</span>
              <span className="hidden group-open:inline">Hide</span>
            </summary>
            <div className="mt-2 max-w-3xl space-y-2 leading-relaxed">{about}</div>
          </details>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
