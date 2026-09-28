import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The native select in the Input's look (UI plan G4), so a phone opens its own
 * picker and the keyboard keeps its own keys. In the dark theme the open list
 * is drawn dark too (color-scheme), not white with pale text.
 */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:[color-scheme:dark] [&_option]:bg-popover [&_option]:text-popover-foreground",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

export { Select };
