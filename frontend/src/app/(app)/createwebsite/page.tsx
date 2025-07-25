// frontend/src/app/createwebsite/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import ElementPalette from "@/components/builder/ElementPalette";
import BuilderCanvas from "@/components/builder/BuilderCanvas";
import {
  WebsiteData,
  Page,
  Selection,
  Location,
  Category,
  Navbar,
} from "@/components/builder/Properties";
import PropertyEditor from "@/components/builder/ElementPropertyEditor";
import { v4 as uuidv4 } from "uuid";
import { isEqual } from "lodash";

type DeletedItem = {
  type: "section" | "subsection" | "element" | "navbar_item";
  id: string;
};

const CreateWebsitePage = () => {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  // NEW: State to store a snapshot of the original data for comparison
  const [originalWebsiteData, setOriginalWebsiteData] =
    useState<WebsiteData | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({
    type: null,
    id: null,
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [isPaletteExpanded, setIsPaletteExpanded] = useState(true);
  const [isPropertiesExpanded, setIsPropertiesExpanded] = useState(true);
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);

  const isTempId = (id: string) =>
    typeof id === "string" &&
    !id.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

  const fetchWebsiteData = async () => {
    setLoading(true);
    try {
      const [websiteRes, locationsRes, restaurantRes] = await Promise.all([
        api.get("/builder/website").catch((e) => e.response),
        api.get("/locations/has-location").catch((e) => e.response),
        api.get("/restaurants/has-restaurant").catch((e) => e.response),
      ]);

      if (websiteRes && websiteRes.status === 200) {
        setWebsiteData(websiteRes.data);
        // NEW: Keep a pristine copy to compare against for finding updates
        setOriginalWebsiteData(JSON.parse(JSON.stringify(websiteRes.data)));
        if (websiteRes.data.pages?.length > 0 && !activePageId) {
          setActivePageId(websiteRes.data.pages[0].page_id);
        }
      } else {
        setWebsiteData(null);
        setOriginalWebsiteData(null);
      }

      if (locationsRes && locationsRes.status === 200) {
        setLocations(locationsRes.data);
        if (locationsRes.data.length > 0) {
          setSelectedLocationId(locationsRes.data[0].location_id);
        }
      }

      if (
        restaurantRes &&
        restaurantRes.status === 200 &&
        restaurantRes.data.has_restaurant
      ) {
        const rId = restaurantRes.data.restaurant_id;
        setRestaurantId(rId);
        const categoriesRes = await api.get(`/restaurants/categories/${rId}`);
        setCategories(categoriesRes.data);
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebsiteData();
  }, []);

  const handleCreateWebsite = async () => {
    try {
      await api.post("/builder/website", {});
      await fetchWebsiteData();
    } catch (error) {
      alert("Failed to create website.");
      console.error(error);
    }
  };

  // --- UPDATED: Fully implemented efficient save logic ---
  const handleSaveChangesToDB = async () => {
    if (!websiteData || !activePageId || !originalWebsiteData) return;
    setIsSaving(true);

    try {
      // --- 1. Process Deletions First ---
      const deletePromises = deletedItems.map((item) => {
        if (!isTempId(item.id)) {
          return api.delete(`/builder/${item.type}s/${item.id}`);
        }
        return Promise.resolve();
      });
      await Promise.all(deletePromises);
      setDeletedItems([]);

      // --- 2. Process Page Content Creates and Updates ---
      const activePageData = websiteData.pages.find(
        (p) => p.page_id === activePageId
      );
      const originalPageData = originalWebsiteData.pages.find(
        (p) => p.page_id === activePageId
      );

      if (!activePageData || !originalPageData)
        throw new Error("Active page data not found");

      const originalItems = new Map();
      originalPageData.sections.forEach((s) => {
        originalItems.set(s.section_id, s);
        s.subsections.forEach((sub) => {
          originalItems.set(sub.subsection_id, sub);
          sub.elements.forEach((el) => originalItems.set(el.element_id, el));
        });
      });

      for (const [s_idx, section] of activePageData.sections.entries()) {
        let sectionId = section.section_id;
        if (isTempId(sectionId)) {
          const res = await api.post("/builder/sections", {
            page_id: activePageId,
            section_type: section.section_type,
            position: s_idx,
            properties: section.properties,
          });
          sectionId = res.data.section_id;
        } else {
          const originalSection = originalItems.get(sectionId);
          if (
            originalSection &&
            (!isEqual(originalSection.properties, section.properties) ||
              originalSection.position !== s_idx)
          ) {
            await api.put(`/builder/sections/${sectionId}`, {
              position: s_idx,
              properties: section.properties,
            });
          }
        }

        for (const [sub_idx, subsection] of section.subsections.entries()) {
          let subsectionId = subsection.subsection_id;
          if (isTempId(subsectionId)) {
            const res = await api.post("/builder/subsections", {
              section_id: sectionId,
              position: sub_idx,
              properties: subsection.properties,
            });
            subsectionId = res.data.subsection_id;
          } else {
            const originalSubsection = originalItems.get(subsectionId);
            if (
              originalSubsection &&
              (!isEqual(originalSubsection.properties, subsection.properties) ||
                originalSubsection.position !== sub_idx)
            ) {
              await api.put(`/builder/subsections/${subsectionId}`, {
                position: sub_idx,
                properties: subsection.properties,
              });
            }
          }

          for (const [el_idx, element] of subsection.elements.entries()) {
            if (isTempId(element.element_id)) {
              await api.post("/builder/elements", {
                subsection_id: subsectionId,
                element_type: element.element_type,
                position: el_idx,
                properties: element.properties,
                aiPayload: element.aiPayload,
              });
            } else {
              const originalElement = originalItems.get(element.element_id);
              if (
                originalElement &&
                (!isEqual(originalElement.properties, element.properties) ||
                  // --- THIS IS THE FIX ---
                  // Add a check to see if the aiPayload has changed
                  !isEqual(originalElement.aiPayload, element.aiPayload) ||
                  originalElement.position !== el_idx)
              ) {
                await api.put(`/builder/elements/${element.element_id}`, {
                  position: el_idx,
                  properties: element.properties,
                  aiPayload: element.aiPayload,
                });
              }
            }
          }
        }
      }

      // --- 3. Process Navbar Property Updates ---
      if (websiteData.navbar && originalWebsiteData.navbar) {
        if (
          !isEqual(
            websiteData.navbar.properties,
            originalWebsiteData.navbar.properties
          )
        ) {
          await api.put(`/builder/navbars/${websiteData.navbar.navbar_id}`, {
            properties: websiteData.navbar.properties,
          });
        }
      }

      alert("All changes saved successfully!");
      await fetchWebsiteData();
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("An error occurred while saving. Please check the console.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateWebsiteData = (updatedPage: Page) => {
    if (!websiteData) return;
    setWebsiteData({
      ...websiteData,
      pages: websiteData.pages.map((p) =>
        p.page_id === updatedPage.page_id ? updatedPage : p
      ),
    });
  };

  const activePage = websiteData?.pages.find((p) => p.page_id === activePageId);
  const navbar = websiteData?.navbar || null;

  const findSelectedItem = () => {
    if (!selection.id || !websiteData) return null;
    if (selection.type === "navbar") return navbar;
    if (selection.type === "navbar_item")
      return (
        navbar?.items.find((item) => item.item_id === selection.id) || null
      );
    if (!activePage) return null;
    for (const section of activePage.sections) {
      if (selection.type === "section" && section.section_id === selection.id)
        return section;
      for (const subsection of section.subsections) {
        if (
          selection.type === "subsection" &&
          subsection.subsection_id === selection.id
        )
          return subsection;
        for (const element of subsection.elements) {
          if (
            selection.type === "element" &&
            element.element_id === selection.id
          )
            return element;
        }
      }
    }
    return null;
  };

  const selectedItem = findSelectedItem();

  const handleDeleteItem = () => {
    if (!selectedItem || !selection.type) return;
    if (selection.type === "navbar") {
      alert("The main navbar container cannot be deleted.");
      return;
    }

    const idKey = `${selection.type}_id` as keyof typeof selectedItem;
    const idToDelete = selectedItem[idKey];

    if (!isTempId(idToDelete)) {
      setDeletedItems((prev) => [
        ...prev,
        { type: selection.type as DeletedItem["type"], id: idToDelete },
      ]);
    }

    if (selection.type === "navbar_item") {
      const newNavbar = {
        ...navbar!,
        items: navbar!.items.filter((item) => item.item_id !== idToDelete),
      };
      setWebsiteData({ ...websiteData!, navbar: newNavbar });
    } else if (activePage) {
      let updatedSections = activePage.sections;
      if (selection.type === "section") {
        updatedSections = activePage.sections.filter(
          (s) => s.section_id !== idToDelete
        );
      } else {
        updatedSections = activePage.sections.map((s) => ({
          ...s,
          subsections: s.subsections
            .map((sub) => ({
              ...sub,
              elements: sub.elements.filter(
                (el) => el.element_id !== idToDelete
              ),
            }))
            .filter((sub) => sub.subsection_id !== idToDelete),
        }));
      }
      updateWebsiteData({ ...activePage, sections: updatedSections });
    }
    setSelection({ type: null, id: null });
  };

  const handleCreatePage = async (title: string) => {
    if (!websiteData) return;
    try {
      const slug = `/${title.toLowerCase().replace(/\s+/g, "-")}`;
      const response = await api.post("/builder/pages", {
        website_id: websiteData.website_id,
        title,
        slug,
      });
      await fetchWebsiteData();
      setActivePageId(response.data.page_id);
    } catch (error) {
      console.error("Failed to create page:", error);
      alert("Error creating page.");
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        Loading Builder...
      </div>
    );
  if (!websiteData) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-100">
        <h2 className="text-2xl font-bold mb-4">No Website Found</h2>
        <p className="mb-6">Get started by creating your website.</p>
        <button
          onClick={handleCreateWebsite}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          Create a Website
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-200 font-sans">
      <aside
        className={`bg-white shadow-lg transition-all duration-300 ease-in-out ${
          isPaletteExpanded ? "w-64 p-4" : "w-16 p-2"
        }`}
      >
        <ElementPalette
          isExpanded={isPaletteExpanded}
          onToggle={() => setIsPaletteExpanded(!isPaletteExpanded)}
          selectedSubsectionId={
            selection.type === "subsection" ? selection.id : null
          }
          activePage={activePage || null}
          onUpdate={updateWebsiteData}
          locations={locations}
          selectedLocationId={selectedLocationId}
          onLocationChange={setSelectedLocationId}
          categories={categories}
        />
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Website Builder</h1>
          {websiteData?.subdomain && (
            <a
              href={`/${websiteData.subdomain}`}
              target="_blank" // Opens in a new tab
              rel="noopener noreferrer"
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded"
            >
              Preview
            </a>
          )}
          <button
            onClick={handleSaveChangesToDB}
            disabled={isSaving}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded disabled:bg-gray-400"
          >
            {isSaving ? "Saving..." : "Save All Changes"}
          </button>
        </header>
        <main className="flex-1 p-4 overflow-y-auto">
          <BuilderCanvas
            page={activePage}
            navbar={navbar}
            websiteData={websiteData}
            selection={selection}
            onSelect={setSelection}
            onUpdate={updateWebsiteData}
            onPageSwitch={setActivePageId}
          />
        </main>
      </div>
      <aside
        className={`bg-white shadow-lg transition-all duration-300 ease-in-out ${
          isPropertiesExpanded ? "w-80 p-4" : "w-16 p-2"
        }`}
      >
        <PropertyEditor
          isExpanded={isPropertiesExpanded}
          onToggle={() => setIsPropertiesExpanded(!isPropertiesExpanded)}
          selectedItem={selectedItem}
          selectionType={selection.type}
          activePage={activePage || null}
          websiteData={websiteData}
          onUpdate={updateWebsiteData}
          onUpdateWebsite={(updatedWebsite) => setWebsiteData(updatedWebsite)}
          onDelete={handleDeleteItem}
          onCreatePage={handleCreatePage}
        />
      </aside>
    </div>
  );
};

export default CreateWebsitePage;
