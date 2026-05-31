/**
 * Server-rendered JSON-LD structured data for SEO.
 * NOT "use client" — this renders on the server so Google sees it
 * even though page.tsx is client-rendered.
 */

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://krishnaamarneni.com");

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${siteUrl}/#person`,
  name: "Krishna Amarneni",
  url: siteUrl,
  jobTitle: "Full-Stack Developer & SAP Expert",
  description:
    "Full-Stack Developer, AI Agent Builder, and SAP Business Analyst. Author of 'Drive to Freedom'. Creator of WealthClaude, Lucy AI, EchoNest, and enterprise automation systems.",
  sameAs: [
    "https://www.linkedin.com/in/krishna-amarneni/",
    "https://github.com/krishnaAmarneni",
    "https://x.com/Kp26W39306",
  ],
  knowsAbout: [
    "SAP S/4HANA",
    "SAP Business Technology Platform",
    "AI Agent Development",
    "Next.js",
    "React",
    "TypeScript",
    "Node.js",
    "Python",
    "Full-Stack Development",
    "Enterprise Automation",
    "Financial Technology",
    "Machine Learning",
  ],
  author: {
    "@type": "Book",
    name: "Drive to Freedom: A Farmer's Son's Guide to Building Wealth",
    url: `${siteUrl}/#book`,
  },
  image: `${siteUrl}/og-image.png`,
};

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "Krishna Amarneni",
  url: siteUrl,
  description:
    "Portfolio of Krishna Amarneni — Full-Stack Developer, AI Agent Builder, SAP Expert, and Author.",
  publisher: { "@id": `${siteUrl}/#person` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/notes?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function SeoJsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webSiteSchema),
        }}
      />
    </>
  );
}
