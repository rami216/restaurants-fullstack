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

type DeletedItem = {
  type: "section" | "subsection" | "element" | "navbar_item";
  id: string;
};
const CreateWebsitePage = () => {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // For save button loading state
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
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
  // Helper to check if an ID is temporary (created on the frontend)
  const isTempId = (id: string) =>
    typeof id === "string" &&
    !id.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  // State to manage sidebar visibility
  const [isPaletteExpanded, setIsPaletteExpanded] = useState(true);
  const [isPropertiesExpanded, setIsPropertiesExpanded] = useState(true);
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [websiteRes, locationsRes, restaurantRes] = await Promise.all([
          api.get("/builder/website").catch((e) => e.response),
          api.get("/locations/has-location").catch((e) => e.response),
          api.get("/restaurants/has-restaurant").catch((e) => e.response),
        ]);

        if (websiteRes && websiteRes.status === 200) {
          setWebsiteData(websiteRes.data);
          if (websiteRes.data.pages?.length > 0 && !activePageId) {
            setActivePageId(websiteRes.data.pages[0].page_id);
          }
        } else {
          setWebsiteData(null);
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

    fetchInitialData();
  }, []);

  const handleCreateWebsite = async () => {
    try {
      await api.post("/builder/website", {});
      window.location.reload();
    } catch (error) {
      alert("Failed to create website.");
      console.error(error);
    }
  };

  const handleSaveChangesToDB = async () => {
    if (!websiteData || !activePageId) return;
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
      setDeletedItems([]); // Clear the deletion queue

      // --- 2. Process Creates and Updates ---
      let activePageData = JSON.parse(
        JSON.stringify(
          websiteData.pages.find((p) => p.page_id === activePageId)
        )
      );

      if (!activePageData) throw new Error("Active page not found");

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
          await api.put(`/builder/sections/${sectionId}`, {
            position: s_idx,
            properties: section.properties,
          });
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
            await api.put(`/builder/subsections/${subsectionId}`, {
              position: sub_idx,
              properties: subsection.properties,
            });
          }

          for (const [el_idx, element] of subsection.elements.entries()) {
            if (isTempId(element.element_id)) {
              await api.post("/builder/elements", {
                subsection_id: subsectionId,
                element_type: element.element_type,
                position: el_idx,
                properties: element.properties,
              });
            } else {
              await api.put(`/builder/elements/${element.element_id}`, {
                position: el_idx,
                properties: element.properties,
              });
            }
          }
        }
      }

      alert("All changes saved successfully!");
      window.location.reload();
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("An error occurred while saving. Please check the console.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Deletion Handler ---

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

    if (selection.type === "navbar" && navbar?.navbar_id === selection.id) {
      return navbar;
    }
    if (selection.type === "navbar_item") {
      return (
        navbar?.items.find((item) => item.item_id === selection.id) || null
      );
    }

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

    // Explicitly prevent deleting the navbar container
    if (selection.type === "navbar") {
      alert(
        "The main navbar container cannot be deleted. You can delete individual items from it."
      );
      return;
    }

    const idKey = `${selection.type}_id` as keyof typeof selectedItem;
    const idToDelete = selectedItem[idKey];

    if (!isTempId(idToDelete)) {
      // Now that we've excluded 'navbar', this is safe.
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
      } else if (selection.type === "subsection") {
        updatedSections = activePage.sections.map((s) => ({
          ...s,
          subsections: s.subsections.filter(
            (sub) => sub.subsection_id !== idToDelete
          ),
        }));
      } else if (selection.type === "element") {
        updatedSections = activePage.sections.map((s) => ({
          ...s,
          subsections: s.subsections.map((sub) => ({
            ...sub,
            elements: sub.elements.filter((el) => el.element_id !== idToDelete),
          })),
        }));
      }
      updateWebsiteData({ ...activePage, sections: updatedSections });
    }

    setSelection({ type: null, id: null });
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
          <button
            onClick={handleSaveChangesToDB}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded"
          >
            Save All Changes
          </button>
        </header>
        <main className="flex-1 p-4 overflow-y-auto">
          <BuilderCanvas
            page={activePage}
            navbar={navbar}
            selection={selection}
            onSelect={setSelection}
            onUpdate={updateWebsiteData}
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
          onUpdate={updateWebsiteData}
          onDelete={handleDeleteItem} // Use the new handler
        />
      </aside>
    </div>
  );
};

export default CreateWebsitePage;
