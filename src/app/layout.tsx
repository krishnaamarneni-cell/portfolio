import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Krishna Amarneni | Full-Stack Developer & SAP Expert",
  description:
    "Portfolio of Krishna Amarneni — Full-Stack Developer, AI Agent Builder, and SAP Business Analyst. Creator of WealthClaude, Lucy AI, and North Falmouth Pharmacy website.",
  keywords: [
    "Krishna Amarneni",
    "Full-Stack Developer",
    "SAP Consultant",
    "AI Agent Developer",
    "Next.js",
    "WealthClaude",
    "Lucy AI",
    "Portfolio",
  ],
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Krishna Amarneni | Full-Stack Developer & SAP Expert",
    description:
      "Building intelligent systems at the intersection of AI, finance, and enterprise technology.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#050505] text-white">
        {children}
      </body>
    </html>
  );
}
