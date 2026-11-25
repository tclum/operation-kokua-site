import type { MetadataRoute } from "next";

// Crawling is allowed in both indexing states so crawlers can read the
// noindex header and meta tag. No sitemap until the domain slice.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" } };
}
