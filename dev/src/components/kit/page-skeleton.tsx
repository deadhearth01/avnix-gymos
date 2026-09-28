/** Shimmering placeholder that mirrors the typical page layout (header, KPIs, content). */
export function PageSkeleton({ kpis = 4, table = true }: { kpis?: number; table?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-in duration-500 fade-in-0">
      <div className="mb-6 space-y-3">
        <div className="skeleton h-3 w-28 rounded-md" />
        <div className="skeleton h-7 w-64 rounded-lg" />
        <div className="skeleton h-4 w-96 max-w-full rounded-md" />
      </div>
      {kpis > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <div key={i} className="surface space-y-4 p-5">
              <div className="skeleton size-9 rounded-[10px]" />
              <div className="skeleton h-3 w-24 rounded-md" />
              <div className="skeleton h-7 w-32 rounded-lg" />
            </div>
          ))}
        </div>
      )}
      {table && (
        <div className="surface mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <div className="skeleton h-9 w-40 rounded-lg" />
            <div className="skeleton h-9 w-56 rounded-lg" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-0">
              <div className="skeleton size-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-44 rounded-md" style={{ opacity: 1 - i * 0.08 }} />
                <div className="skeleton h-2.5 w-28 rounded-md" style={{ opacity: 1 - i * 0.08 }} />
              </div>
              <div className="skeleton h-6 w-20 rounded-md" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
