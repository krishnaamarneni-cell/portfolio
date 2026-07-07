import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SeoJsonLd from "@/components/SeoJsonLd";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://krishnaamarneni.com");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  verification: {
    google: "wCiq3wqantoox_zoRmivjpfuNOTqAC5Eoog39JnNKZc",
  },
  title: "Krishna Amarneni | Full-Stack Developer & SAP Expert",
  description:
    "Portfolio of Krishna Amarneni — Full-Stack Developer, AI Agent Builder, and SAP Business Analyst. Author of 'Drive to Freedom'. Creator of WealthClaude, Lucy AI, and more.",
  keywords: [
    "Krishna Amarneni",
    "Drive to Freedom",
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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lucy",
  },
  openGraph: {
    title: "Krishna Amarneni — SAP Expert, AI Builder, Author",
    description:
      "Building intelligent systems at the intersection of AI, finance, and enterprise technology. Author of 'Drive to Freedom: A Farmer's Son's Guide to Building Wealth'.",
    type: "website",
    url: siteUrl,
    siteName: "Krishna Amarneni",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Drive to Freedom by Krishna Amarneni",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Krishna Amarneni — SAP Expert, AI Builder, Author",
    description:
      "Author of 'Drive to Freedom'. Builder of WealthClaude, Lucy AI, and more.",
    images: ["/og-image.png"],
    creator: "@Kp26W39306",
  },
};

export const viewport: Viewport = {
  // Allow the user to pinch-zoom (better than maximumScale=1) but prevent
  // page-zoom-on-focus jitter on iOS Safari with userScalable.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the page draw under the iPhone notch
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#050505" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <ThemeProvider>
          <SeoJsonLd />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
