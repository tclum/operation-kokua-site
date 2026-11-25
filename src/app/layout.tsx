import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { rootMetadata } from "@/lib/metadata";
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "600"],
  variable: "--font-source-serif",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = rootMetadata();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10201F",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const stamp = `${process.env.BUILD_SHA ?? "nogit"} ${process.env.BUILD_TIME ?? ""}`.trim();
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <head>
        <meta name="build-stamp" content={stamp} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
