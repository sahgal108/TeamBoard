import { Suspense } from "react";
import { SearchBox } from "@/components/search/search-box";

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-7">
      {/* useSearchParams inside SearchBox needs a Suspense boundary */}
      <Suspense fallback={<div className="h-[34px] w-[360px] rounded-lg border border-line bg-canvas" />}>
        <SearchBox />
      </Suspense>
    </header>
  );
}
