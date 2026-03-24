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
  websiteId: string;
  hasAiKey: boolean;
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
      src: "",
      poster: "",
      controls: true,
      style: {
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        padding: "1rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
        maxWidth: "640px",
        width: "100%",
      },
      titleStyle: { fontSize: "1.125rem", fontWeight: 700, color: "#111827" },
      metaStyle: { fontSize: ".875rem", color: "#6b7280" },
      videoStyle: { width: "100%", borderRadius: "10px" },
    },
  },
  {
    type: "DIVIDER",
    name: "Divider",
    defaultProps: {
      style: {
        borderColor: "#e5e7eb",
        borderWidth: "1px",
        marginTop: "1rem",
        marginBottom: "1rem",
        width: "100%",
      },
    },
  },
  {
    type: "SPACER",
    name: "Spacer",
    defaultProps: {
      style: { height: "48px", width: "100%" },
    },
  },
  {
    type: "EMBED",
    name: "Embed (YouTube / Calendly / etc.)",
    defaultProps: {
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      style: {
        width: "100%",
        height: "400px",
        border: "0",
        borderRadius: "8px",
      },
    },
  },
  {
    type: "COUNTDOWN",
    name: "Countdown Timer",
    defaultProps: {
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      title: "Launching In",
      style: {
        textAlign: "center",
        padding: "2rem",
        backgroundColor: "#111827",
        borderRadius: "12px",
        color: "#ffffff",
      },
      labelStyle: {
        fontSize: "0.75rem",
        color: "#9ca3af",
        textTransform: "uppercase",
      },
      numberStyle: { fontSize: "2.5rem", fontWeight: "700", color: "#ffffff" },
    },
  },
  {
    type: "SOCIAL_LINKS",
    name: "Social Links",
    defaultProps: {
      links: [
        {
          platform: "instagram",
          url: "https://instagram.com",
          label: "Instagram",
        },
        {
          platform: "facebook",
          url: "https://facebook.com",
          label: "Facebook",
        },
        { platform: "tiktok", url: "https://tiktok.com", label: "TikTok" },
        {
          platform: "whatsapp",
          url: "https://wa.me/1234567890",
          label: "WhatsApp",
        },
      ],
      style: {
        display: "flex",
        gap: "12px",
        flexWrap: "wrap",
        justifyContent: "center",
      },
      iconStyle: {
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        backgroundColor: "#111827",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    },
  },
  {
    type: "RATING",
    name: "Star Rating",
    defaultProps: {
      rating: 4,
      maxRating: 5,
      label: "Excellent service!",
      style: { textAlign: "center", padding: "1rem" },
      starColor: "#f59e0b",
      labelStyle: { fontSize: "1rem", color: "#374151", marginTop: "8px" },
    },
  },
  {
    type: "PROGRESS_BAR",
    name: "Progress Bar",
    defaultProps: {
      label: "Goal Progress",
      percentage: 65,
      style: { padding: "1rem", width: "100%" },
      barColor: "#3b82f6",
      trackColor: "#e5e7eb",
      labelStyle: {
        fontSize: "0.875rem",
        color: "#374151",
        marginBottom: "6px",
      },
    },
  },
  {
    type: "BADGE",
    name: "Badge / Tag",
    defaultProps: {
      text: "New",
      style: {
        display: "inline-block",
        backgroundColor: "#3b82f6",
        color: "#ffffff",
        padding: "4px 12px",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: "600",
      },
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
  hasAiKey,
}) => {
  const { subscriptionStatus } = useSubscription();
  const isSubscribed = subscriptionStatus === "active";
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // --- AI Generator State ---
  const [aiPrompt, setAiPrompt] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  // ✅ NEW: Model Selection State

  // --- Data App Generator State ---
  const [aiDataAppPrompt, setAiDataAppPrompt] = useState("");
  const [isGeneratingDataApp, setIsGeneratingDataApp] = useState(false);

  // --- Data View Generator State ---
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

      const aiEl: ElementType = {
        element_id: newElementId,
        element_type: "AI",
        position: 999,
        properties: { ...data.properties, bgColor: "transparent" },
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
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "AI generation failed");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleGenerateDataApp = async () => {
    if (!aiDataAppPrompt.trim() || !selectedSubsectionId || !activePage) return;
    setIsGeneratingDataApp(true);
    try {
      const unique_class_name = `ai-data-app-${Date.now()}`;

      const { data: aiPayload } = await api.post(
        "/ai/generate-data-app-element",
        {
          prompt: aiDataAppPrompt,
          website_id: websiteId,
          unique_class_name: unique_class_name,
        },
      );

      const newElement: ElementType = {
        element_id: `data_app_${Date.now()}`,
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
        "/ai/generate-view-only-element",
        {
          prompt: aiDataViewPrompt,
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
      setAiDataViewPrompt("");
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
      style: {
        padding: "1rem",
        border: "1px solid #e2e8f0",
        borderRadius: "0.5rem",
        backgroundColor: "#ffffff",
        boxShadow:
          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        maxWidth: "300px",
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
            {/* ✅ NEW: Model Selection & Generate Button */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleGenerateAi}
                disabled={
                  loadingAi || !aiPrompt.trim() || !isSubscribed || !hasAiKey
                }
                className="w-2/3 bg-blue-600 text-white py-2 rounded disabled:opacity-50 text-sm font-semibold"
              >
                {loadingAi ? "Generating…" : "Generate UI"}
              </button>
            </div>
            {!isSubscribed && (
              <p className="mt-2 text-sm text-red-600 text-center">
                Please subscribe to use AI features.
              </p>
            )}
            {isSubscribed && !hasAiKey && (
              <p className="mt-2 text-sm text-orange-500 text-center">
                ⚠️ Add an API key in Settings → AI Provider to use AI features.
              </p>
            )}
          </div>
          <hr className="my-4 border-gray-300" />

          {/* --- AI GENERATOR (Data Apps) --- */}
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
                isGeneratingDataApp ||
                !aiDataAppPrompt.trim() ||
                !isSubscribed ||
                !hasAiKey
              }
              className="mt-2 w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50 font-semibold"
            >
              {isGeneratingDataApp ? "Generating..." : "Generate Data App"}
            </button>
            {!isSubscribed && (
              <p className="mt-2 text-sm text-red-600 text-center">
                Please subscribe to use AI features.
              </p>
            )}
            {isSubscribed && !hasAiKey && (
              <p className="mt-2 text-sm text-orange-500 text-center">
                ⚠️ Add an API key in Settings → AI Provider to use AI features.
              </p>
            )}
          </div>

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
