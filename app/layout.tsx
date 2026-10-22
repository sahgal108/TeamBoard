import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { AntdProvider } from "@/components/providers/antd-provider";
import { cssVariables } from "@/lib/design-system";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--nf-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = IBM_Plex_Sans({
  variable: "--nf-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--nf-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "TeamBoard", template: "%s · TeamBoard" },
  description: "Multi-tenant project and team management with role-based access that follows your org chart.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <head>
        {/* Design tokens as --ds-* variables; Tailwind and plain CSS read them. */}
        <style>{cssVariables()}</style>
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-ink font-sans">
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
