import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /thoughts was an earlier name for the admin-published notes page.
      // Everything lives under /notes now.
      { source: "/thoughts", destination: "/notes", permanent: true },
    ];
  },
  async headers() {
    const noStore = {
      key: "Cache-Control",
      value: "no-store, no-cache, must-revalidate, max-age=0",
    };
    return [
      { source: "/notes", headers: [noStore] },
      { source: "/investments", headers: [noStore] },
      { source: "/api/thoughts", headers: [noStore] },
      { source: "/api/jobs", headers: [noStore] },
      { source: "/api/projects", headers: [noStore] },
      { source: "/api/site-content", headers: [noStore] },
    ];
  },
};

export default nextConfig;
