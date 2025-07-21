// frontend/src/app/[subdomain]/page.tsx

import React from "react";
import api from "@/lib/axios";
import { WebsiteData } from "@/components/builder/Properties";
// --- UPDATED: Import the new PublicCanvas component ---
import PublicCanvas from "@/components/builder/PublicCanvas";

async function getWebsiteData(subdomain: string): Promise<WebsiteData | null> {
  try {
    const response = await api.get(`/builder/public/${subdomain}`);
    return response.data;
  } catch (error) {
    console.error(
      `Failed to fetch public website data for subdomain: ${subdomain}`
    );
    return null;
  }
}

export default async function PublicWebsitePage({
  params,
}: {
  params: { subdomain: string };
}) {
  const websiteData = await getWebsiteData(params.subdomain);

  if (!websiteData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <h1 className="text-2xl font-bold">Website not found.</h1>
      </div>
    );
  }

  const homePage =
    websiteData.pages.find((p) => p.slug === "/") || websiteData.pages[0];

  return (
    <div>
      {/* --- UPDATED: Use the new PublicCanvas component --- */}
      <PublicCanvas initialPage={homePage} websiteData={websiteData} />
    </div>
  );
}
