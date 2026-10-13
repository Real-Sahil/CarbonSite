import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-[#E3E8EE]", className)} />
  );
}

export function PageSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-[#F9FAFC]">
      <div className="bg-white border-b border-[#E3E8EE]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg animate-pulse bg-[#E3E8EE]" />
            <Bar className="h-2.5 w-16" />
          </div>
          <Bar className="h-7 w-52 mb-2" />
          <Bar className="h-4 w-80" />
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">
        <div className="rounded-lg border border-[#E3E8EE] bg-white">
          <div className="px-6 py-4 border-b border-[#E3E8EE]">
            <Bar className="h-4 w-36" />
          </div>
          <div className="px-6 py-5 flex flex-col gap-3">
            <Bar className="h-8 w-full" />
            <Bar className="h-8 w-full" />
            <Bar className="h-8 w-3/4" />
          </div>
        </div>

        <div className="rounded-lg border border-[#E3E8EE] bg-white">
          <div className="px-6 py-4 border-b border-[#E3E8EE]">
            <Bar className="h-4 w-24" />
          </div>
          <div className="p-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-3.5 border-b border-[#E3E8EE]">
                <Bar className="h-3.5 w-24 shrink-0" />
                <Bar className="h-3.5 flex-1" />
                <Bar className="h-3.5 w-20 shrink-0" />
                <Bar className="h-3.5 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
