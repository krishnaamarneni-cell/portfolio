import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Always-fresh routes: thoughts, investments, the homepage, and the
    // public list APIs. Vercel respects these on the edge.
    const noStore = {
      key: "Cache-Control",
      value: "no-store, no-cache, must-revalidate, max-age=0",
    };
    return [
      {
        source: "/thoughts",
        headers: [noStore],
      },
      {
        source: "/investments",
        headers: [noStore],
      },
      {
        source: "/api/thoughts",
        headers: [noStore],
      },
      {
        source: "/api/jobs",
        headers: [noStore],
      },
      {
        source: "/api/projects",
        headers: [noStore],
      },
      {
        source: "/api/site-content",
        headers: [noStore],
      },
    ];
  },
};

export default nextConfig;
