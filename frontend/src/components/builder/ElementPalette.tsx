// frontend/src/components/builder/ElementPalette.tsx

"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import {
  Page,
  Element as ElementType,
  Location,
  MenuItem,
  Category,
} from "./Properties";
import { PanelLeftClose, PanelLeftOpen, MapPin } from "lucide-react";
import { useSubscription } from "@/context/SubscriptionContext";

interface ElementPaletteProps {
  isExpanded: boolean;
  onToggle: () => void;
  selectedSubsectionId: string | null;
  activePage: Page | null;
  onUpdate: (updatedPage: Page) => void;
  locations: Location[];
  selectedLocationId: string | null;
  onLocationChange: (locationId: string) => void;
  categories: Category[];
  websiteId: string; // <-- add this
}

const GOOGLE_MAP_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAP_KEY;
const availableElements = [
  {
    type: "TEXT",
    name: "Text",
    defaultProps: {
      content: "New Text Block",
      style: { fontSize: "1rem", color: "#000000" },
    },
  },
  {
    type: "BUTTON",
    name: "Button",
    defaultProps: { text: "Click Me", action_type: "LINK", action_value: "#" },
  },
  {
    type: "IMAGE",
    name: "Image",
    defaultProps: {
      src: "https://placehold.co/600x400",
      alt: "Placeholder Image",
    },
  },
  {
    type: "LIST",
    name: "List (UL)",
    defaultProps: {
      items: ["List item 1", "List item 2", "List item 3"],
      style: { listStyleType: "disc", color: "#000000", marginLeft: "20px" },
    },
  },
  {
    type: "DROPDOWN",
    name: "Dropdown Menu",
    defaultProps: {
      label: "Select an Option",
      options: [{ text: "Go to Home", action_value: "/" }],
    },
  },
  {
    type: "FORM",
    name: "Form",
    defaultProps: {
      title: "Contact Us",
      fields: [
        {
          id: `field_${Date.now()}`,
          label: "Your Name",
          placeholder: "Enter your name",
        },
        {
          id: `field_${Date.now() + 1}`,
          label: "Your Email",
          placeholder: "Enter your email",
        },
      ],
      submitButton: {
        text: "Submit",
        style: {
          backgroundColor: "#3498db",
          color: "#ffffff",
          padding: "0.75rem 1.5rem",
          border: "none",
          borderRadius: "8px",
          width: "100%",
        },
      },
      style: {
        backgroundColor: "#f9fafb",
        width: "100%",
        padding: "3rem",
        borderRadius: "8px",
      },
      labelStyle: {
        color: "#374151",
      },
    },
  },
  {
    type: "ACCORDION",
    name: "Accordion",
    defaultProps: {
      items: [
        {
          id: `accordion_${Date.now()}`,
          question: "First Question?",
          answer: "This is the answer to the first question.",
        },
        {
          id: `accordion_${Date.now() + 1}`,
          question: "Second Question?",
          answer: "This is the answer to the second question.",
        },
      ],
      style: {
        width: "100%",
      },
    },
  },
  {
    type: "MAP",
    icon: <MapPin size={24} />,
    name: "map",
    label: "Map",
    defaultProps: {
      // Default to a central location, user will change this
      src: `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAP_KEY}&q=Eiffel+Tower,Paris+France`,
      style: {
        width: "100%",
        height: "450px",
        border: "0",
      },
    },
  },
  {
    type: "LOGIN_FORM",
    name: "Login Form",
    defaultProps: {
      title: "Sign in to your account",
      fields: [
        {
          id: `login_email_${Date.now()}`,
          label: "Email",
          name: "email",
          placeholder: "you@example.com",
          type: "email",
        },
        {
          id: `login_pass_${Date.now() + 1}`,
          label: "Password",
          name: "password",
          placeholder: "••••••••",
          type: "password",
        },
      ],
      submitButton: {
        text: "Login",
        style: {
          backgroundColor: "#111827",
          color: "#ffffff",
          padding: "0.75rem 1.25rem",
          border: "none",
          borderRadius: "8px",
          width: "100%",
        },
      },
      successRedirect: "", // leave empty to use http://localhost:3000/<subdomain>
      style: {
        backgroundColor: "#f9fafb",
        padding: "2rem",
        borderRadius: "10px",
        width: "100%",
        maxWidth: "420px",
      },
      labelStyle: { color: "#374151" },
      inputStyle: { color: "#111827" },
    },
  },
  {
    type: "REGISTER_FORM",
    name: "Register Form",
    defaultProps: {
      title: "Create your account",
      fields: [
        {
          id: `reg_name_${Date.now()}`,
          label: "Full name",
          name: "full_name",
          placeholder: "Jane Doe",
          type: "text",
        },
        {
          id: `reg_email_${Date.now() + 1}`,
          label: "Email",
          name: "email",
          placeholder: "you@example.com",
          type: "email",
        },
        {
          id: `reg_pass_${Date.now() + 2}`,
          label: "Password",
          name: "password",
          placeholder: "••••••••",
          type: "password",
        },
      ],
      submitButton: {
        text: "Register",
        style: {
          backgroundColor: "#2563eb",
          color: "#ffffff",
          padding: "0.75rem 1.25rem",
          border: "none",
          borderRadius: "8px",
          width: "100%",
        },
      },
      successRedirect: "",
      style: {
        backgroundColor: "#f9fafb",
        padding: "2rem",
        borderRadius: "10px",
        width: "100%",
        maxWidth: "420px",
      },
      labelStyle: { color: "#374151" },
      inputStyle: { color: "#111827" },
    },
  },
  {
    type: "VIDEO",
    name: "Video (card)",
    defaultProps: {
      title: "Sample Video",
      length: "03:21",
      src: "", // filled after upload in the editor
      poster: "", // optional thumbnail
      controls: true,
      // card/container styles
      style: {
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        padding: "1rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
        maxWidth: "640px",
        width: "100%",
      },
      // editable text styles
      titleStyle: { fontSize: "1.125rem", fontWeight: 700, color: "#111827" },
      metaStyle: { fontSize: ".875rem", color: "#6b7280" },
      videoStyle: { width: "100%", borderRadius: "10px" },
    },
  },
];

const ElementPalette: React.FC<ElementPaletteProps> = ({
  isExpanded,
  onToggle,
  selectedSubsectionId,
  activePage,
  onUpdate,
  locations,
  selectedLocationId,
  onLocationChange,
  categories,
  websiteId,
}) => {
  const { subscriptionStatus } = useSubscription(); // <-- 2. USE THE HOOK
  const isSubscribed = subscriptionStatus === "active"; // <-- 3. CREATE A HELPER VARIABLE
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  //for ai generated element

  const [aiPrompt, setAiPrompt] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);

  // ✅ NEW: State for the ADVANCED Data App generator
  const [aiDataAppPrompt, setAiDataAppPrompt] = useState("");
  const [isGeneratingDataApp, setIsGeneratingDataApp] = useState(false);

  const [aiDataViewPrompt, setAiDataViewPrompt] = useState("");
  const [isGeneratingDataView, setIsGeneratingDataView] = useState(false);

  const handleGenerateAi = async () => {
    if (!aiPrompt.trim() || !selectedSubsectionId || !activePage) return;
    setLoadingAi(true);
    try {
      const newElementId = `ai_${Date.now()}`;
      const uniqueClassName = `ai-element-${newElementId.substring(3, 10)}`;

      const { data } = await api.post("/ai/generate-ai-element", {
        prompt: aiPrompt,
        unique_class_name: uniqueClassName,
        website_id: websiteId,
      });

      // --- SAFETY STRIPPER: Remove unwanted alerts if GPT ignores instructions ---
      // let cleanScript = data.script || "";
      // if (cleanScript.includes("alert(")) {
      //   console.warn("Stripped placeholder alert from AI script.");
      //   cleanScript = "";
      // }

      const aiEl: ElementType = {
        element_id: newElementId,
        element_type: "AI",
        position: 999,
        // Sync initial AI data to master properties so it's not empty
        properties: {
          ...data.properties,
          bgColor: "transparent", // Ensure the outer box is transparent
        },
        aiPayload: {
          ...data,
          script: data.script,
          id: `ai_payload_${Date.now()}`,
        },
      };

      const updatedPage = {
        ...activePage,
        sections: activePage.sections.map((sec) => ({
          ...sec,
          subsections: sec.subsections.map((sub) =>
            sub.subsection_id === selectedSubsectionId
              ? { ...sub, elements: [...sub.elements, aiEl] }
              : sub,
          ),
        })),
      };

      onUpdate(updatedPage);
      setAiPrompt("");
    } catch (err) {
      console.error(err);
      alert("AI generation failed");
    } finally {
      setLoadingAi(false);
    }
  };
  const handleGenerateDataApp = async () => {
    if (!aiDataAppPrompt.trim() || !selectedSubsectionId || !activePage) return;
    setIsGeneratingDataApp(true);
    try {
      // Generate a unique class name for CSS scoping
      const unique_class_name = `ai-data-app-${Date.now()}`;

      const { data: aiPayload } = await api.post(
        "/ai/generate-data-app-element",
        {
          prompt: aiDataAppPrompt,
          website_id: websiteId,
          unique_class_name: unique_class_name, // Send the class name to the backend
        },
      );

      const newElement: ElementType = {
        element_id: `data_app_${Date.now()}`,
        element_type: "AI",
        position: 999,
        properties: aiPayload.properties,
        aiPayload: aiPayload,
      };

      // Add the new element to the selected subsection
      const updatedPage = {
        ...activePage,
        sections: activePage.sections.map((sec) => ({
          ...sec,
          subsections: sec.subsections.map((sub) =>
            sub.subsection_id === selectedSubsectionId
              ? { ...sub, elements: [...sub.elements, newElement] }
              : sub,
          ),
        })),
      };
      onUpdate(updatedPage);
      setAiDataAppPrompt("");
    } catch (err) {
      console.error("AI Data App generation failed:", err);
      alert("AI Data App generation failed. Please check the console.");
    } finally {
      setIsGeneratingDataApp(false);
    }
  };
  const handleGenerateDataView = async () => {
    if (!aiDataViewPrompt.trim() || !selectedSubsectionId || !activePage)
      return;
    setIsGeneratingDataView(true);
    try {
      const unique_class_name = `ai-data-view-${Date.now()}`;

      const { data: aiPayload } = await api.post(
        "/ai/generate-view-only-element", // Call the new endpoint
        {
          prompt: aiDataViewPrompt, // Use the new state
          website_id: websiteId,
          unique_class_name: unique_class_name,
        },
      );

      const newElement: ElementType = {
        element_id: `data_view_${Date.now()}`,
        element_type: "AI",
        position: 999,
        properties: aiPayload.properties,
        aiPayload: aiPayload,
      };

      const updatedPage = {
        ...activePage,
        sections: activePage.sections.map((sec) => ({
          ...sec,
          subsections: sec.subsections.map((sub) =>
            sub.subsection_id === selectedSubsectionId
              ? { ...sub, elements: [...sub.elements, newElement] }
              : sub,
          ),
        })),
      };
      onUpdate(updatedPage);
      setAiDataViewPrompt(""); // Reset the new state
    } catch (err: any) {
      console.error("AI Data View generation failed:", err);
      const errorMsg =
        err.response?.data?.detail || "An unexpected error occurred.";
      alert(`AI Data View generation failed: ${errorMsg}`);
    } finally {
      setIsGeneratingDataView(false);
    }
  };

  useEffect(() => {
    const fetchMenuItems = async () => {
      if (selectedLocationId) {
        try {
          const response = await api.get(
            `/locations/${selectedLocationId}/menu`,
          );
          setMenuItems(response.data);
        } catch (error) {
          console.error("Error fetching menu items:", error);
          setMenuItems([]);
        }
      } else {
        setMenuItems([]);
      }
    };
    fetchMenuItems();
  }, [selectedLocationId]);

  const handleAddElement = (elementType: string, defaultProps: any) => {
    if (!selectedSubsectionId || !activePage)
      return alert("Please select a layout block first.");

    const newElement: ElementType = {
      element_id: `element_${Date.now()}`,
      element_type: elementType,
      position: 999,
      properties: defaultProps,
    };

    const updatedPage = {
      ...activePage,
      sections: activePage.sections.map((section) => ({
        ...section,
        subsections: section.subsections.map((subsection) => {
          if (subsection.subsection_id === selectedSubsectionId) {
            return {
              ...subsection,
              elements: [...subsection.elements, newElement],
            };
          }
          return subsection;
        }),
      })),
    };
    onUpdate(updatedPage);
  };

  // This function creates a 'MENU_ITEM' element with all the necessary data
  const handleAddMenuItemElement = (item: MenuItem) => {
    const menuItemProps = {
      item_id: item.item_id,
      item_name: item.item_name,
      description: item.description,
      base_price: item.base_price,
      image_url: item.image_url,
      is_shippable: item.is_shippable,
      stripe_product_id: item.stripe_product_id,
      stripe_price_id: item.stripe_price_id,
      // You can add default styles for the card here
      style: {
        padding: "1rem",
        border: "1px solid #e2e8f0",
        borderRadius: "0.5rem",
        backgroundColor: "#ffffff",
        boxShadow:
          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        maxWidth: "300px", // Set a maximum width for the card
      },
    };
    handleAddElement("MENU_ITEM", menuItemProps);
  };
  const handleAddCategoryElement = (category: Category) => {
    const categoryProps = {
      id: category.id,
      name: category.name,
      image_url: category.image_url,
      menu_items_url: `/locations/${selectedLocationId}/menu?category_id=${category.id}`,
      style: {
        maxWidth: "320px",
        textAlign: "center",
      },
    };
    handleAddElement("CATEGORY", categoryProps);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        {isExpanded && <h2 className="text-xl font-bold">Elements</h2>}
        <button
          onClick={onToggle}
          className="p-1 text-gray-500 hover:text-gray-800"
        >
          {isExpanded ? (
            <PanelLeftClose size={20} />
          ) : (
            <PanelLeftOpen size={20} />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="overflow-y-auto flex-grow">
          {/* ─── AI GENERATOR ─── */}
          <div className="mb-4">
            <textarea
              rows={3}
              className="w-full border rounded p-2"
              placeholder="Describe your custom element…"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <button
              onClick={handleGenerateAi}
              disabled={loadingAi || !aiPrompt.trim() || !isSubscribed}
              className="mt-2 w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
            >
              {loadingAi ? "Generating…" : "Generate AI Element"}
            </button>
            {!isSubscribed && (
              <p className="mt-2 text-sm text-red-600 text-center">
                Please subscribe to use AI features.
              </p>
            )}
          </div>
          <hr className="my-4 border-gray-300" />
          {/* --- ✅ NEW: AI GENERATOR (Data Apps) --- */}
          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-700">
              Generate a Data Table
            </label>
            <textarea
              rows={3}
              className="w-full border rounded p-2 mt-1 text-sm"
              placeholder="e.g., a table for team members with name, title, and photo..."
              value={aiDataAppPrompt}
              onChange={(e) => setAiDataAppPrompt(e.target.value)}
            />
            <button
              onClick={handleGenerateDataApp}
              disabled={
                isGeneratingDataApp || !aiDataAppPrompt.trim() || !isSubscribed
              }
              className="mt-2 w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50"
            >
              {isGeneratingDataApp ? "Generating..." : "Generate Data App"}
            </button>
            {!isSubscribed && (
              <p className="mt-2 text-sm text-red-600 text-center">
                Please subscribe to use AI features.
              </p>
            )}
          </div>
          {/* ✅ **3. ADD NEW UI for the View-Only generator** */}
          {/* <div className="mb-4">
            <label className="text-sm font-semibold text-gray-700">
              Generate a Read-Only View
            </label>
            <textarea
              rows={3}
              className="w-full border rounded p-2 mt-1 text-sm"
              placeholder="e.g., 'Show a public list of our team members...'"
              value={aiDataViewPrompt}
              onChange={(e) => setAiDataViewPrompt(e.target.value)}
            />
            <button
              onClick={handleGenerateDataView}
              disabled={
                isGeneratingDataView ||
                !aiDataViewPrompt.trim() ||
                !isSubscribed
              }
              className="mt-2 w-full bg-green-600 text-white py-2 rounded disabled:opacity-50"
            >
              {isGeneratingDataView
                ? "Generating..."
                : "Generate Read-Only View"}
            </button>
            {!isSubscribed && (
              <p className="mt-2 text-sm text-red-600 text-center">
                Please subscribe to use AI features.
              </p>
            )}
          </div> */}

          <hr className="my-4 border-gray-300" />
          <p
            className={`text-sm mb-4 ${
              selectedSubsectionId ? "text-green-600" : "text-red-600"
            }`}
          >
            {selectedSubsectionId
              ? "A layout block is selected."
              : "Select a layout block to add elements."}
          </p>
          <div className="space-y-2">
            {availableElements.map((el) => (
              <button
                key={el.type}
                onClick={() => handleAddElement(el.type, el.defaultProps)}
                disabled={!selectedSubsectionId}
                className="w-full text-left bg-gray-100 p-2 rounded hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {el.name}
              </button>
            ))}
          </div>

          <hr className="my-4 border-gray-300" />

          <div>
            <h3 className="text-lg font-semibold mb-2">Dynamic Content</h3>

            <div className="mt-4">
              <h4 className="font-semibold text-md mb-2">Categories</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleAddCategoryElement(cat)}
                      disabled={!selectedSubsectionId}
                      className="w-full text-left bg-gray-100 p-2 rounded hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      {cat.name}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No categories found.</p>
                )}
              </div>
            </div>

            <label
              htmlFor="location-select"
              className="block text-sm font-medium text-gray-700 mt-4 mb-1"
            >
              Choose Location for Menu Items
            </label>
            <select
              id="location-select"
              value={selectedLocationId || ""}
              onChange={(e) => onLocationChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="" disabled>
                -- Select a location --
              </option>
              {locations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>
                  {loc.location_name}
                </option>
              ))}
            </select>

            {selectedLocationId && (
              <div className="mt-4">
                <h4 className="font-semibold text-md mb-2">Menu Items</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {menuItems.length > 0 ? (
                    menuItems.map((item) => (
                      <button
                        key={item.item_id}
                        onClick={() => handleAddMenuItemElement(item)}
                        disabled={!selectedSubsectionId}
                        className="w-full text-left bg-gray-100 p-2 rounded hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        {item.item_name}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      No menu items found.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ElementPalette;
