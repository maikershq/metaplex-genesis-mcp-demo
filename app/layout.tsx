import type { Metadata } from "next";
import { Rajdhani, Open_Sans } from "next/font/google";
import "./globals.css";

const heading = Rajdhani({
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const body = Open_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Metaplex Genesis Agent",
  description: "AI Agent for Metaplex Genesis Protocol",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${heading.variable} ${body.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
