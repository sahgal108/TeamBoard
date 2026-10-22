"use client";

import { Button, Result } from "antd";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Result
        status="error"
        title="Something went wrong"
        subTitle={error.message || "The page could not be loaded."}
        extra={<Button onClick={reset}>Try again</Button>}
      />
    </main>
  );
}
