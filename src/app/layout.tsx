import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Noto_Sans_Telugu, Petrona } from "next/font/google";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});
const petrona = Petrona({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-petrona",
  display: "swap",
});
const telugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  weight: ["400"],
  variable: "--font-telugu",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Astra Dine", template: "%s · Astra Dine" },
  description: "Table QR ordering, kitchen display, billing and loyalty for restaurants.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f5f5f2", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${atkinson.variable} ${petrona.variable} ${telugu.variable}`}>
      <body>{children}</body>
    </html>
  );
}
