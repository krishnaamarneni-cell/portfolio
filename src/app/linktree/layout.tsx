import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Krishna Amarneni — Links",
  description:
    "All my links in one place — portfolio, free courses, free tools, and social profiles.",
  openGraph: {
    title: "Krishna Amarneni — Links",
    description: "Portfolio, courses, tools, and social profiles in one place.",
    type: "website",
  },
};

export default function LinktreeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
