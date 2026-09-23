/** Shown while any page's server work runs — the shape of a page, shimmering. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-3 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="skeleton h-4 w-48" />
        <div className="mt-5 flex flex-col gap-3">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex gap-4">
              <div className="skeleton h-4 flex-[3]" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton hidden h-4 flex-1 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
