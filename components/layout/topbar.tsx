import { Suspense } from "react";
import { SearchBox } from "@/components/search/search-box";
import { Header, SkeletonInput } from "@/components/ui/antd";
import { layout, zIndex } from "@/lib/design-system";

export function Topbar() {
  return (
    <Header className="flex items-center border-b border-line" style={{ position: "sticky", top: 0, zIndex: zIndex.header }}>
      {/* useSearchParams inside SearchBox needs a Suspense boundary */}
      <Suspense fallback={<SkeletonInput active style={{ width: layout.searchWidth }} />}>
        <SearchBox />
      </Suspense>
    </Header>
  );
}
