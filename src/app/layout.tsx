import type { Metadata, Viewport } from "next";
import { rootMetadata } from "@/lib/metadata";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = rootMetadata();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10201F",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const stamp = `${process.env.BUILD_SHA ?? "nogit"} ${process.env.BUILD_TIME ?? ""}`.trim();
  return (
    <html lang="en">
      <head>
        <meta name="build-stamp" content={stamp} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
