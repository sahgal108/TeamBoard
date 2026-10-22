"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { antdTheme } from "@/lib/antd-theme";

/** Server-side style extraction, the brand theme, and App context for message / modal.confirm. */
export function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider theme={antdTheme}>
        <App className="flex min-h-full flex-1 flex-col">{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
