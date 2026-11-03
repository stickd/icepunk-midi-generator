import type { MetadataRoute } from "next";

const siteUrl = "https://icepunk.app";
const lastModified = new Date("2026-11-03T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/desktop`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/impressum`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/datenschutz`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}
