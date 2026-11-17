import type { MetadataRoute } from "next";

const BASE_URL = "https://sanpedromotocare.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: BASE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/cotizar`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/tienda`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/tracking`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacidad`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terminos`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
