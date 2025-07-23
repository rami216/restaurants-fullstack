// frontend/src/components/builder/CategoryMenu.tsx
"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import { PublicWebsiteData, MenuItem, Location } from "../builder/Properties";

interface Props {
  websiteData: PublicWebsiteData;
  categoryId: string;
}

export default function CategoryMenu({ websiteData, categoryId }: Props) {
  const { locations, pages } = websiteData;

  // default to the first location
  const [selectedLocation, setSelectedLocation] = useState<string>(
    locations[0]?.location_id ?? ""
  );
  const [items, setItems] = useState<MenuItem[]>([]);

  // whenever location or category changes, re‑fetch
  useEffect(() => {
    if (!selectedLocation) return;
    api
      .get<MenuItem[]>(
        `/locations/${selectedLocation}/menu?category_id=${categoryId}`
      )
      .then((res) => setItems(res.data))
      .catch(() => setItems([]));
  }, [selectedLocation, categoryId]);

  // find your site’s “home” page title for the header
  const homeTitle =
    pages.find((p) => p.slug === "/")?.title || pages[0]?.title || "";

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">
        {homeTitle} — Category {categoryId}
      </h1>

      {/* dropdown to pick location */}
      <div className="mb-6">
        <label className="block mb-2 font-medium">View menu for:</label>
        <select
          className="border rounded p-2"
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
        >
          {locations.map((loc: Location) => (
            <option key={loc.location_id} value={loc.location_id}>
              {loc.location_name}
            </option>
          ))}
        </select>
      </div>

      {/* grid of menu items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <div
            key={item.item_id}
            className="border rounded-lg p-4 bg-white shadow hover:shadow-lg transition"
          >
            {item.image_url && (
              <img
                src={`${api.defaults.baseURL}${item.image_url}`}
                alt={item.item_name}
                className="w-full h-40 object-cover rounded mb-3"
              />
            )}
            <h2 className="font-semibold text-lg">{item.item_name}</h2>
            <p className="text-sm text-gray-600 my-2">{item.description}</p>
            <p className="font-bold">${item.base_price.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
