// components/builder/PropertyEditor.tsx

"use client";
import axios from "axios";

import React, { useRef, useState } from "react";
import {
  Selection,
  FormField,
  AccordionItem,
  NavbarItem,
  AnimationProps,
  Element,
} from "./Properties";
import api from "@/lib/axios";
import { Page } from "./Properties";

import {
  Trash2,
  PlusCircle,
  Bold,
  Italic,
  Underline,
  Upload,
  PanelRightClose,
  PanelRightOpen,
  Save,
  X,
  Check,
  Edit,
  Copy,
  ClipboardPaste,
  ArrowUp, // <-- ADD THIS
  ArrowDown, // <-- ADD THIS
} from "lucide-react";
import Mustache from "mustache";
import VisibilityEditor from "./VisibilityEditor";
import { resolveImageSrc } from "@/lib/imageUrl";
import { useSubscription } from "@/context/SubscriptionContext";

interface PropertyEditorProps {
  isExpanded: boolean;
  onToggle: () => void;
  selectedItem: any | null;
  selectionType: Selection["type"];
  activePage: Page | null;
  websiteData: any; // Pass the full website data to access all pages
  onUpdate: (updatedPage: Page) => void;
  onUpdateWebsite: (updatedWebsite: any) => void; // For navbar updates
  onDelete: (item: any, type: Selection["type"]) => void;
  onCreatePage: (title: string) => void;
  clipboard: Element | null;
  onCopy: () => void;
  onPaste: () => void;
  onGenerateSection: (prompt: string, sectionId: string) => void;
  onMoveSection: (sectionId: string, direction: "up" | "down") => void; // <-- ADD THIS
  onRefineSection: (prompt: string) => void;
  onRefineElement: (prompt: string) => void; // <-- ADD THIS
  onCreateStandalonePage: (title: string) => void; // <-- ADD THIS
}

const PropertyEditor: React.FC<PropertyEditorProps> = ({
  isExpanded,
  onToggle,
  selectedItem,
  selectionType,
  activePage,
  websiteData,
  onUpdate,
  onUpdateWebsite,
  onDelete,
  onCreatePage,
  clipboard,
  onCopy,
  onPaste,
  onGenerateSection,
  onMoveSection,
  onRefineSection,
  onRefineElement,
  onCreateStandalonePage,
}) => {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const { subscriptionStatus } = useSubscription(); // <-- 2. USE THE HOOK
  const isSubscribed = subscriptionStatus === "active"; // <-- 3. CREATE A HELPER VARIABLE
  const [editingStandalonePageId, setEditingStandalonePageId] = useState<
    string | null
  >(null);
  const [editedStandaloneTitle, setEditedStandaloneTitle] = useState("");
  const [editedStandaloneSlug, setEditedStandaloneSlug] = useState("");

  const [products, setProducts] = React.useState<
    { product_id: string; name: string }[]
  >([]);

  React.useEffect(() => {
    const run = async () => {
      if (!websiteData?.website_id) return;
      try {
        const { data } = await api.get(
          `/users-stripe-account/builder/websites/${websiteData.website_id}/products`
        );
        setProducts(
          (data || []).map((p: any) => ({
            product_id: p.product_id,
            name: p.name,
          }))
        );
      } catch (e) {
        console.warn("Failed to load products for interactivity", e);
      }
    };
    run();
  }, [websiteData?.website_id]);

  const posterInputRef = useRef<HTMLInputElement>(null);

  const handleTitleStyleChange = (key: string, value: string) =>
    handlePropertyChange("titleStyle", {
      ...(selectedItem.properties.titleStyle || {}),
      [key]: value,
    });

  const handleMetaStyleChange = (key: string, value: string) =>
    handlePropertyChange("metaStyle", {
      ...(selectedItem.properties.metaStyle || {}),
      [key]: value,
    });

  const handleVideoStyleChange = (key: string, value: string) =>
    handlePropertyChange("videoStyle", {
      ...(selectedItem.properties.videoStyle || {}),
      [key]: value,
    });

  // --- START: ADD STATE FOR SECTION AI ---
  const [sectionAiPrompt, setSectionAiPrompt] = useState("");
  const [isGeneratingSection, setIsGeneratingSection] = useState(false);

  const [elementRefinePrompt, setElementRefinePrompt] = useState("");
  const [isRefiningElement, setIsRefiningElement] = useState(false);

  // 2. Add state and a handler for the new UI
  const [isAddingStandalonePage, setIsAddingStandalonePage] = useState(false);
  const [newStandalonePageTitle, setNewStandalonePageTitle] = useState("");
  const [localPreview, setLocalPreview] = React.useState<
    Record<string, string>
  >({});

  const handleCreateStandalone = () => {
    if (newStandalonePageTitle.trim()) {
      onCreateStandalonePage(newStandalonePageTitle.trim());
      setNewStandalonePageTitle("");
      setIsAddingStandalonePage(false);
    }
  };

  const handleRefineElementClick = async () => {
    if (!elementRefinePrompt.trim()) return;
    setIsRefiningElement(true);
    try {
      await onRefineElement(elementRefinePrompt);
      setElementRefinePrompt("");
    } finally {
      setIsRefiningElement(false);
    }
  };

  const handleGenerateSectionClick = async () => {
    if (!sectionAiPrompt.trim() || !selectedItem || selectionType !== "section")
      return;
    setIsGeneratingSection(true);
    try {
      await onGenerateSection(sectionAiPrompt, selectedItem.section_id);
      setSectionAiPrompt("");
    } catch (error) {
      // Error is handled in the parent component
    } finally {
      setIsGeneratingSection(false);
    }
  };
  // --- END: ADD STATE FOR SECTION AI ---

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const [isAddingPage, setIsAddingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  // --- NEW: Function to handle the actual image file upload ---

  //for navbaritems(new)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editedItemText, setEditedItemText] = useState("");
  // at top of PropertyEditor component

  // At the top of the PropertyEditor component, add these state variables
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const handleRefineClick = async () => {
    if (!refinePrompt.trim() || !selectedItem) return;
    setIsRefining(true);
    try {
      await onRefineSection(refinePrompt);
      setRefinePrompt("");
    } finally {
      setIsRefining(false);
    }
  };
  const handleAnimationChange = (key: keyof AnimationProps, value: any) => {
    if (!selectedItem) return;
    const anim: AnimationProps = {
      ...(selectedItem.properties.animation || {}),
      [key]: value,
    };
    handlePropertyChange("animation", anim);
  };

  const handleUpdateNavbarItem = async () => {
    if (!editingItemId || !editedItemText) return;

    const slug = `/${editedItemText
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[?#]/g, "")}`;

    try {
      await api.put(`/builder/navbar-items/${editingItemId}`, {
        text: editedItemText,
        link_url: slug,
      });
      alert("Link updated successfully!");
      window.location.reload(); // Easiest way to refresh all data
    } catch (error) {
      console.error("Failed to update link:", error);
      alert("Error updating link.");
    } finally {
      setEditingItemId(null);
      setEditedItemText("");
    }
  };
  const deletePageUnified = async (pageId: string) => {
    try {
      await api.delete(`/builder/pages/${pageId}`);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 405) {
        // some environments block DELETE – use the POST alias
        await api.post(`/builder/pages/${pageId}/delete`);
      } else {
        throw err;
      }
    }
  };
  const handleDeleteNavbarItem = async (
    itemId: string,
    itemText: string,
    itemSlug: string
  ) => {
    const msg = `Delete the "${itemText}" page and navbar link?\n\nThis will permanently delete the page and its content.`;
    if (!confirm(msg)) return;

    try {
      const page = (websiteData?.pages || []).find(
        (p: any) => p.slug === itemSlug
      );
      if (page) {
        await deletePageUnified(page.page_id);
      } else {
        await api.delete(`/builder/navbar-items/${itemId}`);
      }
      alert("Deleted.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  };

  // helpers
  const slugify = (s: string) =>
    "/" +
    s
      .trim()
      .toLowerCase()
      .replace(/^\//, "") // no double leading slash
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-\/]/g, ""); // keep letters, numbers, -, /

  const beginEditStandalone = (p: Page) => {
    setEditingStandalonePageId(p.page_id);
    setEditedStandaloneTitle(p.title);
    setEditedStandaloneSlug(p.slug);
  };

  const saveEditStandalone = async () => {
    if (!editingStandalonePageId) return;
    try {
      await api.put(`/builder/pages/${editingStandalonePageId}`, {
        title: editedStandaloneTitle.trim(),
        slug: slugify(editedStandaloneSlug || editedStandaloneTitle),
      });
      alert("Page updated.");
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Update failed.");
    } finally {
      setEditingStandalonePageId(null);
    }
  };

  const handleDeleteStandalonePage = async (pageId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deletePageUnified(pageId);
      alert("Deleted.");
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Delete failed.");
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    propertyName: string // 'backgroundImage' | 'src' | 'image_url' | ...
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // show local preview immediately
    const objUrl = URL.createObjectURL(file);
    setLocalPreview((prev) => ({ ...prev, [propertyName]: objUrl }));

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/uploads/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // backend returns a relative path like "/storage/v1/object/public/...."
      const { image_url } = response.data;
      if (!image_url) throw new Error("No image_url returned from upload.");

      // ✅ IMPORTANT: store the raw relative path on the element properties (not url(...))
      // (your renderers will call resolveImageSrc() to produce the full src)
      handlePropertyChange(propertyName, image_url);
    } catch (error) {
      console.error("Image upload failed:", error);
      alert("Image upload failed. Please check the console for details.");
      // if upload failed, drop the preview
      setLocalPreview((prev) => {
        const next = { ...prev };
        delete next[propertyName];
        return next;
      });
    } finally {
      setIsUploading(false);
      // optional: let the preview remain until the state re-renders with the saved value,
      // then you can revoke it later if you want:
      // URL.revokeObjectURL(objUrl);
    }
  };
  const handleVideoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    propertyName: "src"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // 1) Ask backend for a signed URL
      const formData = new FormData();
      formData.append("file_name", file.name);
      formData.append("content_type", file.type || "application/octet-stream");

      const { data: signed } = await api.post(
        "/uploads/video/signed-url",
        formData
      );
      const { upload_url, public_url, content_type } = signed;

      // 2) Upload directly to Supabase via PUT (with progress)
      await axios.put(upload_url, file, {
        headers: {
          "Content-Type":
            content_type || file.type || "application/octet-stream",
          "x-upsert": "true",
        },
        onUploadProgress: (evt) => {
          const percent = Math.round((evt.loaded * 100) / (evt.total ?? 1));
          setUploadProgress(percent);
        },
        maxBodyLength: Infinity, // allow large files
        maxContentLength: Infinity,
      });

      // 3) Save the public URL to your element's properties
      handlePropertyChange(propertyName, public_url);
    } catch (err) {
      console.error("Video upload failed:", err);
      alert("Video upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Also consider clearing the input so selecting the same file triggers again:
      event.target.value = "";
    }
  };

  const handleCreatePage = () => {
    if (newPageTitle.trim()) {
      onCreatePage(newPageTitle.trim());
      setNewPageTitle("");
      setIsAddingPage(false);
    }
  };
  const renderNavbarEditor = () => {
    if (!websiteData?.navbar) return null;

    const navProps = websiteData.navbar.properties || {};
    const itemStyle = navProps.itemStyle || {};

    return (
      <div className="space-y-6">
        {/* Section for managing pages and links */}
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-2">
            Pages & Links
          </h4>
          <div className="space-y-2">
            {/* --- START: EDIT --- */}
            {websiteData.navbar.items.map((item: NavbarItem) => (
              <div
                key={item.item_id}
                className="p-2 border rounded bg-gray-50 flex items-center justify-between"
              >
                {editingItemId === item.item_id ? (
                  <>
                    <input
                      type="text"
                      value={editedItemText}
                      onChange={(e) => setEditedItemText(e.target.value)}
                      className="flex-grow border-gray-300 rounded-md shadow-sm p-1 text-sm"
                    />
                    <div className="flex items-center ml-2">
                      <button
                        onClick={handleUpdateNavbarItem}
                        className="p-1 text-green-600 hover:bg-green-100 rounded-full"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setEditingItemId(null)}
                        className="p-1 text-gray-500 hover:bg-gray-200 rounded-full"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm">{item.text}</span>
                    <div className="flex items-center">
                      <button
                        onClick={() => {
                          setEditingItemId(item.item_id);
                          setEditedItemText(item.text);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded-full"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteNavbarItem(
                            item.item_id,
                            item.text,
                            item.link_url
                          )
                        }
                        className="p-1 text-red-600 hover:bg-red-100 rounded-full"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {/* --- END: EDIT --- */}
          </div>
          {!isAddingPage ? (
            <button
              onClick={() => setIsAddingPage(true)}
              className="mt-3 w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
            >
              <PlusCircle size={16} className="mr-2" /> Add New Page
            </button>
          ) : (
            <div className="mt-3 p-3 border rounded-md bg-gray-100">
              <input
                type="text"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder="New page title"
                className="block w-full border-gray-300 rounded-md shadow-sm p-2 text-sm"
              />
              <div className="flex items-center justify-end space-x-2 mt-2">
                <button
                  onClick={() => setIsAddingPage(false)}
                  className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={handleCreatePage}
                  className="p-2 text-green-600 hover:bg-green-100 rounded-full"
                >
                  <Save size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <hr />

        {/* Section for styling the navbar container */}
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-2">
            Navbar Styling
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Background Color
              </label>
              <input
                type="color"
                value={navProps.backgroundColor || "#ffffff"}
                onChange={(e) =>
                  handleNavbarPropertyChange("backgroundColor", e.target.value)
                }
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        <hr />

        {/* Section for styling the navigation links */}
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-2">
            Link Styling
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Text Style
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    toggleNavbarStyle("fontWeight", "bold", "normal")
                  }
                  className={`p-2 rounded ${
                    itemStyle.fontWeight === "bold"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Bold size={16} />
                </button>
                <button
                  onClick={() =>
                    toggleNavbarStyle("fontStyle", "italic", "normal")
                  }
                  className={`p-2 rounded ${
                    itemStyle.fontStyle === "italic"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Italic size={16} />
                </button>
                <button
                  onClick={() =>
                    toggleNavbarStyle("textDecoration", "underline", "none")
                  }
                  className={`p-2 rounded ${
                    itemStyle.textDecoration === "underline"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Underline size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Font Size
              </label>
              <input
                type="text"
                value={itemStyle.fontSize || "1rem"}
                onChange={(e) =>
                  handleNavbarStyleChange("fontSize", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 16px, 1.2rem"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Text Color
              </label>
              <input
                type="color"
                value={itemStyle.color || "#000000"}
                onChange={(e) =>
                  handleNavbarStyleChange("color", e.target.value)
                }
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
        {/* ✅ --- START: NEW PAGE VISIBILITY SECTION --- ✅ */}
        {activePage && (
          <>
            <hr />
            <div className="mt-4">
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Page Visibility ({activePage.title})
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Control who can see the entire "{activePage.title}" page.
              </p>
              <VisibilityEditor
                value={activePage.properties}
                onChange={(nextProperties) => {
                  const updatedActivePage = {
                    ...activePage,
                    properties: nextProperties,
                  };
                  onUpdate(updatedActivePage);
                }}
                onBecameProtected={async () => {
                  await api.post(
                    `/builder/ensure-auth-pages/${websiteData!.website_id}`
                  );
                }}
                products={products}
                isSubscribed={isSubscribed}
              />
            </div>
          </>
        )}
        {/* ✅ --- END: NEW PAGE VISIBILITY SECTION --- ✅ */}
      </div>
    );
  };
  const renderNavbarItemEditor = () => {
    // ... (logic to edit navbar item text and link)
    return <div>Navbar Item Editor</div>;
  };
  const handleNavbarPropertyChange = (key: string, value: any) => {
    if (!websiteData?.navbar) return;
    const currentProperties = websiteData.navbar.properties || {};
    const newProperties = { ...currentProperties, [key]: value };
    onUpdateWebsite({
      ...websiteData,
      navbar: { ...websiteData.navbar, properties: newProperties },
    });
  };

  const handleNavbarStyleChange = (key: string, value: any) => {
    if (!websiteData?.navbar) return;
    const currentProperties = websiteData.navbar.properties || {};
    const currentItemStyle = currentProperties.itemStyle || {};
    const newItemStyle = { ...currentItemStyle, [key]: value };
    handleNavbarPropertyChange("itemStyle", newItemStyle);
  };

  const toggleNavbarStyle = (
    styleKey: string,
    onValue: string,
    offValue: string
  ) => {
    const currentVal = websiteData?.navbar?.properties?.itemStyle?.[styleKey];
    const newVal = currentVal === onValue ? offValue : onValue;
    handleNavbarStyleChange(styleKey, newVal);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete this ${selectionType}?`)) {
      onDelete(selectedItem, selectionType);
    }
  };
  if (!selectedItem || !selectionType || !activePage) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">Properties</h2>
        <p className="text-gray-500">
          Select an item on the canvas to edit its properties.
        </p>
      </div>
    );
  }

  const updateItem = (updatedItem: any) => {
    if (!activePage) return;
    const updatedPage = {
      ...activePage,
      sections: activePage.sections.map((section) => {
        if (
          section.section_id === updatedItem.section_id &&
          selectionType === "section"
        ) {
          return updatedItem;
        }
        return {
          ...section,
          subsections: section.subsections.map((subsection) => {
            if (
              subsection.subsection_id === updatedItem.subsection_id &&
              selectionType === "subsection"
            ) {
              return updatedItem;
            }
            return {
              ...subsection,
              elements: subsection.elements.map((element) =>
                element.element_id === updatedItem.element_id &&
                selectionType === "element"
                  ? updatedItem
                  : element
              ),
            };
          }),
        };
      }),
    };
    onUpdate(updatedPage);
  };

  const handlePropertyChange = (key: string, value: any) => {
    const newProperties = { ...selectedItem.properties, [key]: value };
    updateItem({ ...selectedItem, properties: newProperties });
  };

  const handleStyleChange = (key: string, value: any) => {
    const newProperties = {
      ...selectedItem.properties,
      style: { ...selectedItem.properties.style, [key]: value },
    };
    updateItem({ ...selectedItem, properties: newProperties });
  };

  const renderSectionEditor = () => {
    // Create safe objects for properties and the nested style object
    const properties = selectedItem.properties || {};
    const style = properties.style || {};

    return (
      <div className="space-y-4">
        {/* --- AI SECTION GENERATOR UI (No changes needed) --- */}
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-2">
            Generate Layout with AI
          </h4>
          <div className="p-3 border rounded-md bg-gray-50">
            <textarea
              rows={4}
              className="w-full border rounded p-2 text-sm"
              placeholder="Describe the layout you want..."
              value={sectionAiPrompt}
              onChange={(e) => setSectionAiPrompt(e.target.value)}
            />
            <button
              onClick={handleGenerateSectionClick}
              disabled={
                isGeneratingSection || !sectionAiPrompt.trim() || !isSubscribed
              }
              className="mt-2 w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50"
            >
              {isGeneratingSection
                ? "Generating..."
                : "Generate Section Layout"}
            </button>
            {!isSubscribed && (
              <p className="mt-2 text-sm text-red-600 text-center">
                Please subscribe to use AI features.
              </p>
            )}
          </div>
        </div>
        <hr />
        {/* --- START: NEW REFINE UI --- */}
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-2">
            Refine Current Section
          </h4>
          <div className="p-3 border rounded-md bg-gray-50">
            <textarea
              rows={3}
              className="w-full border rounded p-2 text-sm"
              placeholder="e.g., 'Change the background to light blue' or 'Make the heading text larger'."
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
            />
            <button
              onClick={handleRefineClick}
              disabled={isRefining || !refinePrompt.trim() || !isSubscribed}
              className="mt-2 w-full bg-green-600 text-white py-2 rounded disabled:opacity-50"
            >
              {isRefining ? "Refining..." : "Refine with AI"}
            </button>
            {!isSubscribed && (
              <p className="mt-2 text-sm text-red-600 text-center">
                Please subscribe to use AI features.
              </p>
            )}
          </div>
        </div>
        {/* --- END: NEW REFINE UI --- */}

        {/* --- Background Image Uploader (No changes needed) --- */}
        {/* This continues to work with the top-level 'backgroundImage' property */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Background Image
          </label>
          <div className="mt-1 p-2 border-2 border-dashed border-gray-300 rounded-md">
            {properties.backgroundImage ? (
              <div className="text-center">
                <img
                  src={
                    localPreview.backgroundImage
                      ? localPreview.backgroundImage
                      : resolveImageSrc(properties.backgroundImage)
                  }
                  alt="Background Preview"
                  className="max-h-32 w-full object-cover mx-auto rounded-md"
                />
                <button
                  onClick={() => {
                    handlePropertyChange("backgroundImage", "");
                    setLocalPreview((prev) => {
                      const next = { ...prev };
                      delete next.backgroundImage;
                      return next;
                    });
                  }}
                  className="mt-2 text-xs text-red-600 hover:text-red-800"
                >
                  Remove Image
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <input
                  type="file"
                  id="bg-image-upload"
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  onChange={(e) => handleImageUpload(e, "backgroundImage")} // <-- UPDATE THIS
                  disabled={isUploading}
                />
                <label
                  htmlFor="bg-image-upload"
                  className={`cursor-pointer font-medium text-indigo-600 hover:text-indigo-500 ${
                    isUploading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isUploading ? "Uploading..." : "Upload an image"}
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, WEBP, GIF
                </p>
              </div>
            )}
          </div>
        </div>

        {/* --- Layout Controls (No changes needed) --- */}
        {/* These correctly edit the top-level layout properties */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Layout Direction (for subsections)
          </label>
          <select
            value={properties.flexDirection || "row"}
            onChange={(e) =>
              handlePropertyChange("flexDirection", e.target.value)
            }
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          >
            <option value="row">Horizontal (Columns)</option>
            <option value="column">Vertical (Rows)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Justify Subsections
          </label>
          <select
            value={properties.justifyContent || "flex-start"}
            onChange={(e) =>
              handlePropertyChange("justifyContent", e.target.value)
            }
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          >
            <option value="flex-start">Start</option>
            <option value="center">Center</option>
            <option value="flex-end">End</option>
            <option value="space-between">Space Between</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Gap Between Subsections
          </label>
          <input
            type="text"
            value={properties.gap || "1rem"}
            onChange={(e) => handlePropertyChange("gap", e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            placeholder="e.g., 1rem, 16px"
          />
        </div>

        {/* --- Visual Style Controls (THE FIX IS HERE) --- */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Padding
          </label>
          <input
            type="text"
            // 1. Read from the AI's 'style' object first, then fall back to the manual property
            value={style.padding || properties.padding || "2rem"}
            // 2. ALWAYS write the change to the 'style' object so it overrides the AI style
            onChange={(e) => handleStyleChange("padding", e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Background Color
          </label>
          <input
            type="color"
            // 1. Read from the AI's 'style' object first, then fall back to the manual property
            value={
              style.backgroundColor || properties.backgroundColor || "#ffffff"
            }
            // 2. ALWAYS write the change to the 'style' object
            onChange={(e) =>
              handleStyleChange("backgroundColor", e.target.value)
            }
            className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
          />
        </div>
        <VisibilityEditor
          value={selectedItem.properties}
          onChange={(next) => updateItem({ ...selectedItem, properties: next })}
          onBecameProtected={async () => {
            await api.post(
              `/builder/ensure-auth-pages/${websiteData!.website_id}`
            );
          }}
          products={products}
          isSubscribed={isSubscribed}
        />
      </div>
    );
  };

  const renderSubsectionEditor = () => {
    // Safely get properties and the nested style object at the top
    const properties = selectedItem.properties || {};
    const style = properties.style || {};

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Element Layout
          </label>
          <select
            value={properties.display || "flex"}
            onChange={(e) => {
              const newDisplay = e.target.value;
              handlePropertyChange("display", newDisplay);
              if (newDisplay === "grid" && !properties.gridColumns) {
                const newProps = {
                  ...properties,
                  display: "grid",
                  gridColumns: 2,
                  gridTemplateColumns: "repeat(2, 1fr)",
                };
                updateItem({ ...selectedItem, properties: newProps });
              }
            }}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          >
            <option value="flex">Flexbox (Vertical/Horizontal)</option>
            <option value="grid">Grid</option>
          </select>
        </div>

        {/* Conditional UI for Grid Layout */}
        {properties.display === "grid" && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Number of Columns
            </label>
            <input
              type="number"
              min="1"
              value={properties.gridColumns || ""}
              onChange={(e) => {
                const rawValue = e.target.value;
                handlePropertyChange("gridColumns", rawValue);
                const columns = parseInt(rawValue, 10);
                if (!isNaN(columns) && columns > 0) {
                  handlePropertyChange(
                    "gridTemplateColumns",
                    `repeat(${columns}, 1fr)`
                  );
                }
              }}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
        )}

        {/* Conditional UI for Flexbox Layout */}
        {(!properties.display || properties.display === "flex") && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Flex Direction
              </label>
              <select
                value={properties.flexDirection || "column"}
                onChange={(e) =>
                  handlePropertyChange("flexDirection", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="column">Vertical</option>
                <option value="row">Horizontal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Justify Elements
              </label>
              <select
                value={properties.justifyContent || "flex-start"}
                onChange={(e) =>
                  handlePropertyChange("justifyContent", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="flex-start">Start</option>
                <option value="center">Center</option>
                <option value="flex-end">End</option>
                <option value="space-between">Space Between</option>
              </select>
            </div>
          </>
        )}

        {/* Common Properties */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Gap Between Elements
          </label>
          <input
            type="text"
            value={properties.gap || "1rem"}
            onChange={(e) => handlePropertyChange("gap", e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            placeholder="e.g., 1rem, 16px"
          />
        </div>

        {/* Animation Panel */}
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-2">Animation</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Type
              </label>
              <select
                value={properties.animation?.type || ""}
                onChange={(e) =>
                  handleAnimationChange(
                    "type",
                    e.target.value as AnimationProps["type"]
                  )
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="">None</option>
                <option value="fade-in">Fade In</option>
                <option value="slide-up">Slide Up</option>
                <option value="bounce">Bounce</option>
                <option value="pulse">Pulse</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Delay (s)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={properties.animation?.delay ?? 0}
                onChange={(e) =>
                  handleAnimationChange("delay", parseFloat(e.target.value))
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Duration (s)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={properties.animation?.duration ?? 0.3}
                onChange={(e) =>
                  handleAnimationChange("duration", parseFloat(e.target.value))
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Repeat count
              </label>
              <input
                type="number"
                min={0}
                value={properties.animation?.repeat ?? 0}
                onChange={(e) =>
                  handleAnimationChange("repeat", parseInt(e.target.value, 10))
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
          </div>
        </div>

        {/* Positioning (Offset) Section */}
        <hr />
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-2">
            Positioning (Offset)
          </h4>
          <div className="space-y-3 p-3 border rounded-md bg-gray-50">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Position Type
              </label>
              <select
                value={style.position || "static"}
                onChange={(e) => handleStyleChange("position", e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="static">Static (Default)</option>
                <option value="relative">Relative</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Set to 'Relative' to use the offset controls below.
              </p>
            </div>
            {style.position === "relative" && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Top
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 20px, -1rem"
                    value={style.top || ""}
                    onChange={(e) => handleStyleChange("top", e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Left
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., -50px, 10%"
                    value={style.left || ""}
                    onChange={(e) => handleStyleChange("left", e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <VisibilityEditor
          value={selectedItem.properties}
          onChange={(next) => updateItem({ ...selectedItem, properties: next })}
          onBecameProtected={async () => {
            await api.post(
              `/builder/ensure-auth-pages/${websiteData!.website_id}`
            );
          }}
          products={products}
        />
      </div>
    );
  };
  const handleNameStyleChange = (key: string, value: any) => {
    if (!selectedItem) return;
    const newProperties = {
      ...selectedItem.properties,
      nameStyle: { ...selectedItem.properties.nameStyle, [key]: value },
    };
    updateItem({ ...selectedItem, properties: newProperties });
  };
  const handleLabelStyleChange = (key: string, value: any) => {
    if (!selectedItem) return;
    const newProperties = {
      ...selectedItem.properties,
      labelStyle: { ...selectedItem.properties.labelStyle, [key]: value },
    };
    updateItem({ ...selectedItem, properties: newProperties });
  };
  const renderAuthFormEditor = (kind: "LOGIN_FORM" | "REGISTER_FORM") => {
    const props = selectedItem.properties || {};
    const fields = props.fields || [];

    const updateField = (
      idx: number,
      key: "label" | "name" | "placeholder" | "type",
      value: string
    ) => {
      const next = [...fields];
      next[idx] = { ...next[idx], [key]: value };
      handlePropertyChange("fields", next);
    };

    const addField = () => {
      handlePropertyChange("fields", [
        ...fields,
        {
          id: `${kind.toLowerCase()}_${Date.now()}`,
          label: "New field",
          name: "custom",
          placeholder: "",
          type: "text",
        },
      ]);
    };

    const removeField = (idx: number) => {
      handlePropertyChange(
        "fields",
        fields.filter((_: any, i: number) => i !== idx)
      );
    };

    const updateBtn = (k: string, v: any) =>
      handlePropertyChange("submitButton", {
        ...(props.submitButton || {}),
        [k]: v,
      });

    const updateBtnStyle = (k: string, v: any) =>
      handlePropertyChange("submitButton", {
        ...(props.submitButton || {}),
        style: { ...((props.submitButton || {}).style || {}), [k]: v },
      });

    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            value={props.title || ""}
            onChange={(e) => handlePropertyChange("title", e.target.value)}
            className="mt-1 w-full border rounded p-2"
          />
        </div>

        <hr />

        <div>
          <h4 className="text-md font-medium text-gray-800 mb-2">Fields</h4>
          <div className="space-y-3">
            {fields.map((f: any, i: number) => (
              <div
                key={f.id}
                className="p-3 border rounded bg-gray-50 space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="border rounded p-2"
                    placeholder="Label"
                    value={f.label}
                    onChange={(e) => updateField(i, "label", e.target.value)}
                  />
                  <input
                    className="border rounded p-2"
                    placeholder="name (payload key)"
                    value={f.name}
                    onChange={(e) => updateField(i, "name", e.target.value)}
                  />
                  <input
                    className="border rounded p-2 col-span-2"
                    placeholder="Placeholder"
                    value={f.placeholder}
                    onChange={(e) =>
                      updateField(i, "placeholder", e.target.value)
                    }
                  />
                  <select
                    className="border rounded p-2"
                    value={f.type || "text"}
                    onChange={(e) => updateField(i, "type", e.target.value)}
                  >
                    <option value="text">text</option>
                    <option value="email">email</option>
                    <option value="password">password</option>
                  </select>
                  <button
                    onClick={() => removeField(i)}
                    className="border rounded p-2 text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addField}
            className="mt-2 w-full border-dashed border-2 rounded p-2"
          >
            + Add Field
          </button>
        </div>

        <hr />

        <div>
          <h4 className="text-md font-medium text-gray-800 mb-2">
            Form Styles
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border rounded p-2 col-span-2"
              placeholder="Width (e.g., 100%, 420px)"
              value={props.style?.width || "100%"}
              onChange={(e) => handleStyleChange("width", e.target.value)}
            />
            <input
              className="border rounded p-2 col-span-2"
              placeholder="Padding (e.g., 2rem)"
              value={props.style?.padding || "2rem"}
              onChange={(e) => handleStyleChange("padding", e.target.value)}
            />
            <input
              type="color"
              className="h-10 border rounded"
              value={props.style?.backgroundColor || "#f9fafb"}
              onChange={(e) =>
                handleStyleChange("backgroundColor", e.target.value)
              }
            />
            <input
              type="color"
              className="h-10 border rounded"
              value={props.labelStyle?.color || "#374151"}
              onChange={(e) => handleLabelStyleChange("color", e.target.value)}
            />
          </div>
        </div>

        <hr />

        <div>
          <h4 className="text-md font-medium text-gray-800 mb-2">
            Submit Button
          </h4>
          <label className="block text-sm font-medium text-gray-700">
            Text
          </label>
          <input
            className="w-full border rounded p-2 mb-3"
            value={
              props.submitButton?.text ||
              (kind === "LOGIN_FORM" ? "Login" : "Register")
            }
            onChange={(e) => updateBtn("text", e.target.value)}
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              type="color"
              className="h-10 border rounded"
              value={
                props.submitButton?.style?.backgroundColor ||
                (kind === "LOGIN_FORM" ? "#111827" : "#2563eb")
              }
              onChange={(e) =>
                updateBtnStyle("backgroundColor", e.target.value)
              }
            />
            <input
              type="color"
              className="h-10 border rounded"
              value={props.submitButton?.style?.color || "#ffffff"}
              onChange={(e) => updateBtnStyle("color", e.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Width"
              value={props.submitButton?.style?.width || "100%"}
              onChange={(e) => updateBtnStyle("width", e.target.value)}
            />
          </div>
        </div>

        {/* Visibility panel reuse */}
        <VisibilityEditor
          value={selectedItem.properties}
          onChange={(next) => updateItem({ ...selectedItem, properties: next })}
        />
      </div>
    );
  };

  const handleAiPropChange = (key: string, value: any) => {
    if (!selectedItem || !selectedItem.aiPayload) return;

    // Create a complete, deep copy of the element to prevent any and all side effects.
    const updatedElement = JSON.parse(JSON.stringify(selectedItem));

    // Ensure the properties object exists on the new copy.
    if (!updatedElement.aiPayload.properties) {
      updatedElement.aiPayload.properties = {};
    }

    // Set the new value directly on the copy.
    updatedElement.aiPayload.properties[key] = value;

    // Send the pristine, updated copy to the main state.
    updateItem(updatedElement);
  };
  //region form input text style
  const handleInputStyleChange = (key: string, value: string) => {
    const newInputStyle = {
      ...(selectedItem.properties.inputStyle || {}),
      [key]: value,
    };
    handlePropertyChange("inputStyle", newInputStyle);
  };

  const renderElementEditor = () => {
    const inter = selectedItem.properties?.interactivity || {};
    const action: "none" | "link" | "purchase" = inter.action || "none";
    const productId = inter.product_id || "";
    const linkHref = inter.href || "";

    const setInter = (next: any) => {
      const nextProps = {
        ...(selectedItem.properties || {}),
        interactivity: next,
      };
      updateItem({ ...selectedItem, properties: nextProps });
    };

    // small helpers local to this editor
    const toggleStyle = (
      styleKey: string,
      onValue: string,
      offValue: string
    ) => {
      const currentVal = selectedItem.properties.style?.[styleKey];
      handleStyleChange(styleKey, currentVal === onValue ? offValue : onValue);
    };

    const toggleNameStyle = (
      styleKey: string,
      onValue: string,
      offValue: string
    ) => {
      const currentVal = selectedItem.properties.nameStyle?.[styleKey];
      handleNameStyleChange(
        styleKey,
        currentVal === onValue ? offValue : onValue
      );
    };

    let editorBody: React.ReactNode = null;

    switch (selectedItem.element_type) {
      case "TEXT": {
        const style = selectedItem.properties.style || {};
        editorBody = (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Content
              </label>
              <textarea
                value={selectedItem.properties.content || ""}
                onChange={(e) =>
                  handlePropertyChange("content", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                rows={3}
              />
            </div>

            {/* Text style */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Styles
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toggleStyle("fontWeight", "bold", "normal")}
                  className={`p-2 rounded ${
                    style.fontWeight === "bold"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Bold size={16} />
                </button>
                <button
                  onClick={() => toggleStyle("fontStyle", "italic", "normal")}
                  className={`p-2 rounded ${
                    style.fontStyle === "italic"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Italic size={16} />
                </button>
                <button
                  onClick={() =>
                    toggleStyle("textDecoration", "underline", "none")
                  }
                  className={`p-2 rounded ${
                    style.textDecoration === "underline"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Underline size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Font Size
              </label>
              <input
                type="text"
                value={style.fontSize || "1rem"}
                onChange={(e) => handleStyleChange("fontSize", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Color
              </label>
              <input
                type="color"
                value={style.color || "#000000"}
                onChange={(e) => handleStyleChange("color", e.target.value)}
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>

            {/* Animation */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Animation
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Type
                  </label>
                  <select
                    value={selectedItem.properties.animation?.type || ""}
                    onChange={(e) =>
                      handleAnimationChange("type", e.target.value)
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
                  >
                    <option value="">None</option>
                    <option value="fade-in">Fade In</option>
                    <option value="slide-up">Slide Up</option>
                    <option value="bounce">Bounce</option>
                    <option value="pulse">Pulse</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Delay (s)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={selectedItem.properties.animation?.delay ?? 0}
                    onChange={(e) =>
                      handleAnimationChange("delay", parseFloat(e.target.value))
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Duration (s)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={selectedItem.properties.animation?.duration ?? 0.3}
                    onChange={(e) =>
                      handleAnimationChange(
                        "duration",
                        parseFloat(e.target.value)
                      )
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Repeat count
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={selectedItem.properties.animation?.repeat ?? 0}
                    onChange={(e) =>
                      handleAnimationChange(
                        "repeat",
                        parseInt(e.target.value, 10)
                      )
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
              </div>
            </div>
          </div>
        );
        break;
      }

      case "BUTTON": {
        const inter = selectedItem.properties?.interactivity || {};
        const action: "none" | "link" | "purchase" = inter.action || "none";
        const productId = inter.product_id || "";
        const linkHref = inter.href || "";
        editorBody = (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Button Text
              </label>
              <input
                type="text"
                value={selectedItem.properties.text || ""}
                onChange={(e) => handlePropertyChange("text", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            {/* ✅ START: NEW INTERACTIVITY SECTION */}
            <hr />
            <h4 className="text-md font-medium text-gray-800 pt-2">
              Interactivity
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium">Action</label>
                <select
                  className="border rounded p-2 w-full mt-1"
                  value={action}
                  onChange={(e) => {
                    const newAction = e.target.value as
                      | "none"
                      | "link"
                      | "purchase";
                    handlePropertyChange("interactivity", {
                      action: newAction,
                    });
                  }}
                >
                  <option value="none">No action</option>
                  <option value="link">Go to page</option>
                  <option value="purchase">Purchase product</option>
                </select>
              </div>

              {action === "link" && (
                <div>
                  <label className="block text-sm font-medium">Page</label>
                  <select
                    className="border rounded p-2 w-full mt-1"
                    value={linkHref}
                    onChange={(e) =>
                      handlePropertyChange("interactivity", {
                        action: "link",
                        href: e.target.value,
                      })
                    }
                  >
                    <option value="" disabled>
                      -- Select a Page --
                    </option>
                    {websiteData?.pages.map((page: Page) => (
                      <option key={page.page_id} value={page.slug}>
                        {page.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {action === "purchase" && (
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">
                    Product
                  </label>
                  <select
                    className="border rounded p-2 w-full"
                    value={productId}
                    onChange={(e) =>
                      handlePropertyChange("interactivity", {
                        action: "purchase",
                        product_id: e.target.value,
                      })
                    }
                  >
                    <option value="">Select a product…</option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {/* ✅ END: NEW INTERACTIVITY SECTION */}

            <hr />
            <h4 className="text-md font-medium text-gray-800 pt-2">Styling</h4>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Background Color
              </label>
              <input
                type="color"
                value={
                  selectedItem.properties.style?.backgroundColor || "#3498db"
                }
                onChange={(e) =>
                  handleStyleChange("backgroundColor", e.target.value)
                }
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Text Color
              </label>
              <input
                type="color"
                value={selectedItem.properties.style?.color || "#ffffff"}
                onChange={(e) => handleStyleChange("color", e.target.value)}
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Width
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.width || "auto"}
                onChange={(e) => handleStyleChange("width", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 100px, 100%, auto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Padding (Y X)
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.padding || "0.5rem 1rem"}
                onChange={(e) => handleStyleChange("padding", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 0.5rem 1rem"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Border
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.border || "none"}
                onChange={(e) => handleStyleChange("border", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 2px solid #000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Border Radius
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.borderRadius || "8px"}
                onChange={(e) =>
                  handleStyleChange("borderRadius", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 8px, 50%"
              />
            </div>
          </div>
        );
        break;
      }

      case "LIST": {
        editorBody = (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                List Items (one per line)
              </label>
              <textarea
                value={(selectedItem.properties.items || []).join("\n")}
                onChange={(e) =>
                  handlePropertyChange("items", e.target.value.split("\n"))
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                rows={5}
              />
            </div>
          </div>
        );
        break;
      }

      case "DROPDOWN": {
        const handleOptionChange = (
          index: number,
          key: "text" | "action_value",
          value: string
        ) => {
          const newOptions = [...(selectedItem.properties.options || [])];
          newOptions[index] = { ...newOptions[index], [key]: value };
          handlePropertyChange("options", newOptions);
        };
        const addDropdownOption = () => {
          handlePropertyChange("options", [
            ...(selectedItem.properties.options || []),
            { text: "New Option", action_value: "#" },
          ]);
        };
        const removeDropdownOption = (index: number) => {
          const newOptions = (selectedItem.properties.options || []).filter(
            (_: any, i: number) => i !== index
          );
          handlePropertyChange("options", newOptions);
        };

        editorBody = (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Dropdown Label
              </label>
              <input
                type="text"
                value={selectedItem.properties.label || ""}
                onChange={(e) => handlePropertyChange("label", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Options
              </label>
              {(selectedItem.properties.options || []).map(
                (option: any, index: number) => (
                  <div key={index} className="p-2 border rounded-md space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500">
                        Option {index + 1}
                      </span>
                      <button
                        onClick={() => removeDropdownOption(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Display Text"
                      value={option.text}
                      onChange={(e) =>
                        handleOptionChange(index, "text", e.target.value)
                      }
                      className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Link URL"
                      value={option.action_value}
                      onChange={(e) =>
                        handleOptionChange(
                          index,
                          "action_value",
                          e.target.value
                        )
                      }
                      className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                    />
                  </div>
                )
              )}
              <button
                onClick={addDropdownOption}
                className="w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
              >
                <PlusCircle size={16} className="mr-2" /> Add Option
              </button>
            </div>
          </div>
        );
        break;
      }

      case "IMAGE": {
        editorBody = (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Image Preview
              </label>
              <img
                src={
                  localPreview.src
                    ? localPreview.src
                    : resolveImageSrc(selectedItem.properties.src)
                }
                alt="preview"
                className="mt-1 w-full rounded-md border bg-gray-100"
              />
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, "src")}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
              >
                <Upload size={16} className="mr-2" /> Choose from PC
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Alt Text
              </label>
              <input
                type="text"
                value={selectedItem.properties.alt || ""}
                onChange={(e) => handlePropertyChange("alt", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            <hr />
            <h4 className="text-md font-medium text-gray-800 pt-2">Styling</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Width
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.width || "100%"}
                onChange={(e) => handleStyleChange("width", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 200px, 100%"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Height
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.height || "auto"}
                onChange={(e) => handleStyleChange("height", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 200px, auto"
              />
            </div>
          </div>
        );
        break;
      }

      case "CATEGORY": {
        const nameStyle = selectedItem.properties.nameStyle || {};
        editorBody = (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Category Name
              </label>
              <input
                type="text"
                value={selectedItem.properties.name || ""}
                onChange={(e) => handlePropertyChange("name", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            <hr />
            <h4 className="text-md font-medium text-gray-800 pt-2">
              Name Styling
            </h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Text Styles
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    toggleNameStyle("fontWeight", "bold", "normal")
                  }
                  className={`p-2 rounded ${
                    nameStyle.fontWeight === "bold"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Bold size={16} />
                </button>
                <button
                  onClick={() =>
                    toggleNameStyle("fontStyle", "italic", "normal")
                  }
                  className={`p-2 rounded ${
                    nameStyle.fontStyle === "italic"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Italic size={16} />
                </button>
                <button
                  onClick={() =>
                    toggleNameStyle("textDecoration", "underline", "none")
                  }
                  className={`p-2 rounded ${
                    nameStyle.textDecoration === "underline"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Underline size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Font Family
              </label>
              <select
                value={nameStyle.fontFamily || "sans-serif"}
                onChange={(e) =>
                  handleNameStyleChange("fontFamily", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="sans-serif">Sans-serif</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
                <option value="cursive">Cursive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Text Color
              </label>
              <input
                type="color"
                value={nameStyle.color || "#000000"}
                onChange={(e) => handleNameStyleChange("color", e.target.value)}
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        );
        break;
      }

      case "FORM": {
        const handleFieldChange = (
          index: number,
          key: "label" | "placeholder",
          value: string
        ) => {
          const newFields = [...(selectedItem.properties.fields || [])];
          newFields[index] = { ...newFields[index], [key]: value };
          handlePropertyChange("fields", newFields);
        };
        const addField = () => {
          handlePropertyChange("fields", [
            ...(selectedItem.properties.fields || []),
            {
              id: `field_${Date.now()}`,
              label: "New Field",
              placeholder: "Enter value",
            },
          ]);
        };
        const removeField = (index: number) => {
          handlePropertyChange(
            "fields",
            (selectedItem.properties.fields || []).filter(
              (_: any, i: number) => i !== index
            )
          );
        };
        const handleButtonPropChange = (key: string, value: string) => {
          const newButtonProps = {
            ...(selectedItem.properties.submitButton || {}),
            [key]: value,
          };
          handlePropertyChange("submitButton", newButtonProps);
        };
        const handleButtonStyleChange = (key: string, value: string) => {
          const sb = selectedItem.properties.submitButton || {};
          const newButtonProps = {
            ...sb,
            style: { ...(sb.style || {}), [key]: value },
          };
          handlePropertyChange("submitButton", newButtonProps);
        };

        editorBody = (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Form Title
              </label>
              <input
                type="text"
                value={selectedItem.properties.title || ""}
                onChange={(e) => handlePropertyChange("title", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            <hr />

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Form Styling
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Form Width
                  </label>
                  <input
                    type="text"
                    value={selectedItem.properties.style?.width || "100%"}
                    onChange={(e) => handleStyleChange("width", e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    placeholder="e.g., 100%, 500px"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Background Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.style?.backgroundColor ||
                      "#f9fafb"
                    }
                    onChange={(e) =>
                      handleStyleChange("backgroundColor", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Field Label Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.labelStyle?.color || "#374151"
                    }
                    onChange={(e) =>
                      handleLabelStyleChange("color", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Input Text Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.inputStyle?.color || "#000000"
                    }
                    onChange={(e) =>
                      handleInputStyleChange("color", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            <hr />

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Form Fields
              </h4>
              <div className="space-y-3">
                {(selectedItem.properties.fields || []).map(
                  (field: FormField, index: number) => (
                    <div
                      key={field.id}
                      className="p-3 border rounded-md bg-gray-50 space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500">
                          Field {index + 1}
                        </span>
                        <button
                          onClick={() => removeField(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Label"
                        value={field.label}
                        onChange={(e) =>
                          handleFieldChange(index, "label", e.target.value)
                        }
                        className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Placeholder"
                        value={field.placeholder}
                        onChange={(e) =>
                          handleFieldChange(
                            index,
                            "placeholder",
                            e.target.value
                          )
                        }
                        className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                      />
                    </div>
                  )
                )}
              </div>
              <button
                onClick={addField}
                className="mt-3 w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
              >
                <PlusCircle size={16} className="mr-2" /> Add Field
              </button>
            </div>

            <hr />

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Submit Button
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={selectedItem.properties.submitButton?.text || ""}
                    onChange={(e) =>
                      handleButtonPropChange("text", e.target.value)
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Background Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.submitButton?.style
                        ?.backgroundColor || "#3498db"
                    }
                    onChange={(e) =>
                      handleButtonStyleChange("backgroundColor", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Text Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.submitButton?.style?.color ||
                      "#ffffff"
                    }
                    onChange={(e) =>
                      handleButtonStyleChange("color", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Width
                  </label>
                  <input
                    type="text"
                    value={
                      selectedItem.properties.submitButton?.style?.width ||
                      "100%"
                    }
                    onChange={(e) =>
                      handleButtonStyleChange("width", e.target.value)
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    placeholder="e.g., 100px, 100%, auto"
                  />
                </div>
              </div>
            </div>
          </div>
        );
        break;
      }

      case "ACCORDION": {
        const handleAccordionChange = (
          index: number,
          key: "question" | "answer",
          value: string
        ) => {
          const next = [...(selectedItem.properties.items || [])];
          next[index] = { ...next[index], [key]: value };
          handlePropertyChange("items", next);
        };
        const addAccordionItem = () => {
          handlePropertyChange("items", [
            ...(selectedItem.properties.items || []),
            {
              id: `accordion_${Date.now()}`,
              question: "New Question",
              answer: "New Answer",
            },
          ]);
        };
        const removeAccordionItem = (index: number) => {
          handlePropertyChange(
            "items",
            (selectedItem.properties.items || []).filter(
              (_: any, i: number) => i !== index
            )
          );
        };

        editorBody = (
          <div className="space-y-6">
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Accordion Items
              </h4>
              <div className="space-y-3">
                {(selectedItem.properties.items || []).map(
                  (item: AccordionItem, index: number) => (
                    <div
                      key={item.id}
                      className="p-3 border rounded-md bg-gray-50 space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500">
                          Item {index + 1}
                        </span>
                        <button
                          onClick={() => removeAccordionItem(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <textarea
                        placeholder="Question"
                        value={item.question}
                        onChange={(e) =>
                          handleAccordionChange(
                            index,
                            "question",
                            e.target.value
                          )
                        }
                        className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                        rows={2}
                      />
                      <textarea
                        placeholder="Answer"
                        value={item.answer}
                        onChange={(e) =>
                          handleAccordionChange(index, "answer", e.target.value)
                        }
                        className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                        rows={3}
                      />
                    </div>
                  )
                )}
              </div>
              <button
                onClick={addAccordionItem}
                className="mt-3 w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
              >
                <PlusCircle size={16} className="mr-2" /> Add Item
              </button>
            </div>

            <hr />

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Styling
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Question Background
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.style?.questionBg || "#f3f4f6"
                    }
                    onChange={(e) =>
                      handleStyleChange("questionBg", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Answer Background
                  </label>
                  <input
                    type="color"
                    value={selectedItem.properties.style?.answerBg || "#ffffff"}
                    onChange={(e) =>
                      handleStyleChange("answerBg", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Icon Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.style?.iconColor || "#6b7280"
                    }
                    onChange={(e) =>
                      handleStyleChange("iconColor", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
        );
        break;
      }

      case "MAP": {
        const handleMapUrlChange = (newUrl: string) => {
          const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAP_KEY;
          let embedUrl = newUrl;
          if (newUrl.includes("/maps/place/")) {
            const place = newUrl.split("/place/")[1].split("/")[0];
            embedUrl = `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${place}`;
          } else if (newUrl.includes("?q=")) {
            const query = newUrl.split("?q=")[1];
            embedUrl = `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${query}`;
          }
          handlePropertyChange("src", embedUrl);
        };

        editorBody = (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Google Maps URL
              </label>
              <textarea
                defaultValue={selectedItem.properties.src}
                onBlur={(e) => handleMapUrlChange(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                rows={3}
                placeholder="Paste a Google Maps URL here (e.g., from the 'Share' button)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Go to Google Maps, find a location, click "Share", and paste the
                link here.
              </p>
            </div>

            <hr />
            <h4 className="text-md font-medium text-gray-800 pt-2">Styling</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Height
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.height || "450px"}
                onChange={(e) => handleStyleChange("height", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 450px"
              />
            </div>
          </div>
        );
        break;
      }
      case "MENU_ITEM": {
        const handleToggleShippable = async (isShippable: boolean) => {
          if (!selectedItem) return;

          setIsSyncing(true);
          try {
            if (isShippable) {
              // Logic to ENABLE and sync the product
              const response = await api.post(
                `/checkout/sync-product/${selectedItem.properties.item_id}`
              );
              updateItem({
                ...selectedItem,
                properties: {
                  ...selectedItem.properties,
                  is_shippable: true,
                  stripe_product_id: response.data.stripe_product_id,
                  stripe_price_id: response.data.stripe_price_id, // Also save the price ID
                },
              });
              alert("Product synced with Stripe successfully!");
            } else {
              // Logic to DISABLE and un-sync the product
              await api.post(
                `/checkout/unsync-product/${selectedItem.properties.item_id}`
              );
              updateItem({
                ...selectedItem,
                properties: { ...selectedItem.properties, is_shippable: false },
              });
              alert("Product un-synced successfully.");
            }
          } catch (error) {
            console.error("Failed to sync product:", error);
            alert("Error: Could not sync product.");
            // Optional: Revert checkbox state on failure
            updateItem({
              ...selectedItem,
              properties: {
                ...selectedItem.properties,
                is_shippable: !isShippable,
              },
            });
          } finally {
            setIsSyncing(false);
          }
        };
        editorBody = (
          <div className="space-y-4">
            <div className="p-3 border rounded-md bg-gray-50 space-y-2">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={!!selectedItem.properties.is_shippable}
                  onChange={(e) => handleToggleShippable(e.target.checked)}
                  disabled={isSyncing}
                />
                <span>Enable as a shippable product</span>
              </label>
              {isSyncing && <p className="text-sm">Syncing with Stripe...</p>}
              {selectedItem.properties.is_shippable && (
                <p className="text-xs text-green-700">Synced with Stripe!</p>
              )}
            </div>
            <h4 className="text-md font-medium text-gray-800">Chat Options</h4>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!selectedItem.properties.chatEnabled}
                onChange={(e) =>
                  handlePropertyChange("chatEnabled", e.target.checked)
                }
              />
              <span>Show WhatsApp chat icon on this card</span>
            </label>

            {selectedItem.properties.chatEnabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={selectedItem.properties.whatsappNumber || ""}
                    onChange={(e) =>
                      handlePropertyChange("whatsappNumber", e.target.value)
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    placeholder="+1 555 123 4567"
                  />
                  <p className="text-xs text-gray-500">
                    Any format is fine — it will be sanitized to digits for
                    wa.me.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Message (optional)
                  </label>
                  <input
                    type="text"
                    value={selectedItem.properties.chatMessage || ""}
                    onChange={(e) =>
                      handlePropertyChange("chatMessage", e.target.value)
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    placeholder="Hi! I'd like to ask about this item."
                  />
                </div>
              </>
            )}
          </div>
        );
        break;
      }

      case "AI": {
        const payload = selectedItem.aiPayload || {};
        const aiProps = payload.properties || {};
        const editableProps = Array.isArray(payload.editableProps)
          ? payload.editableProps
          : [];
        const handleAiPropLocalChange = (key: string, value: any) => {
          updateItem({
            ...selectedItem,
            aiPayload: { ...payload, properties: { ...aiProps, [key]: value } },
          });
        };

        editorBody = (
          <div className="space-y-4">
            {editableProps.map((field: any) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>

                {field.type === "number" && (
                  <input
                    type="number"
                    value={aiProps[field.key]}
                    onChange={(e) =>
                      handleAiPropLocalChange(field.key, +e.currentTarget.value)
                    }
                    className="w-full border p-2 rounded"
                  />
                )}

                {field.type === "text" && (
                  <input
                    type="text"
                    value={aiProps[field.key]}
                    onChange={(e) =>
                      handleAiPropLocalChange(field.key, e.currentTarget.value)
                    }
                    className="w-full border p-2 rounded"
                  />
                )}

                {field.type === "color" && (
                  <input
                    type="color"
                    value={aiProps[field.key]}
                    onChange={(e) =>
                      handleAiPropLocalChange(field.key, e.currentTarget.value)
                    }
                    className="w-full h-10 p-1 rounded border"
                  />
                )}
              </div>
            ))}

            <hr />
            <h4 className="text-md font-medium text-gray-800 pt-2">
              Interactivity
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium">Action</label>
                <select
                  className="border rounded p-2 w-full"
                  value={action}
                  onChange={(e) => {
                    const a = e.target.value as "none" | "link" | "purchase";
                    let newInteractivity;
                    if (a === "link") {
                      newInteractivity = {
                        action: "link",
                        href: linkHref || "",
                      };
                    } else if (a === "purchase") {
                      newInteractivity = {
                        action: "purchase",
                        product_id: productId || "",
                      };
                    } else {
                      newInteractivity = { action: "none" };
                    }
                    // ✅ Use the main property change handler
                    handlePropertyChange("interactivity", newInteractivity);
                  }}
                >
                  <option value="none">No action</option>
                  <option value="link">Go to page</option>
                  <option value="purchase">Purchase product</option>
                </select>
              </div>

              {action === "link" && (
                <div>
                  <label className="block text-sm font-medium">Page</label>
                  <select
                    className="border rounded p-2 w-full"
                    value={linkHref}
                    onChange={(e) =>
                      // ✅ Use the main property change handler
                      handlePropertyChange("interactivity", {
                        action: "link",
                        href: e.target.value,
                      })
                    }
                  >
                    <option value="" disabled>
                      -- Select a Page --
                    </option>
                    {websiteData?.pages.map((page: Page) => (
                      <option key={page.page_id} value={page.slug}>
                        {page.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Clicking this element will navigate to the selected page.
                  </p>
                </div>
              )}

              {action === "purchase" && (
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">
                    Product
                  </label>
                  <select
                    className="border rounded p-2 w-full"
                    value={productId}
                    onChange={(e) =>
                      // ✅ Use the main property change handler
                      handlePropertyChange("interactivity", {
                        action: "purchase",
                        product_id: e.target.value,
                      })
                    }
                  >
                    <option value="">Select a product…</option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This element will start a Stripe checkout for the selected
                    product.
                  </p>
                </div>
              )}
            </div>

            {selectedItem.properties.linkEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Link to Page
                </label>
                <select
                  value={selectedItem.properties.action_value || ""}
                  onChange={(e) =>
                    handlePropertyChange("action_value", e.target.value)
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="" disabled>
                    -- Select a Page --
                  </option>
                  {websiteData?.pages.map((page: Page) => (
                    <option key={page.page_id} value={page.slug}>
                      {page.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <hr />
            <h4 className="text-md font-medium text-gray-800 pt-2">
              WhatsApp chat
            </h4>
            <div className="space-y-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!selectedItem.properties.chatEnabled}
                  onChange={(e) =>
                    handlePropertyChange("chatEnabled", e.target.checked)
                  }
                />
                <span className="text-sm">
                  Show WhatsApp button on this card
                </span>
              </label>

              {selectedItem.properties.chatEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium">
                      WhatsApp number
                    </label>
                    <input
                      className="w-full border p-2 rounded"
                      placeholder="+1 555 123 4567"
                      value={selectedItem.properties.whatsappNumber || ""}
                      onChange={(e) =>
                        handlePropertyChange("whatsappNumber", e.target.value)
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Any format is fine; we’ll keep digits only when opening
                      WhatsApp.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium">
                      Prefilled message (optional)
                    </label>
                    <input
                      className="w-full border p-2 rounded"
                      placeholder={`Hi! I'm interested in ${
                        selectedItem.properties.item_name || "this item"
                      }`}
                      value={selectedItem.properties.chatMessage || ""}
                      onChange={(e) =>
                        handlePropertyChange("chatMessage", e.target.value)
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        );
        break;
      }
      case "VIDEO": {
        const props = selectedItem.properties;

        editorBody = (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                className="mt-1 block w-full border rounded-md p-2"
                value={props.title || ""}
                onChange={(e) => handlePropertyChange("title", e.target.value)}
              />
            </div>

            {/* Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Length
              </label>
              <input
                className="mt-1 block w-full border rounded-md p-2"
                placeholder="e.g. 03:21"
                value={props.length || ""}
                onChange={(e) => handlePropertyChange("length", e.target.value)}
              />
            </div>

            {/* Video preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Preview
              </label>
              <video
                src={props.src ? resolveImageSrc(props.src) : undefined}
                poster={
                  props.poster ? resolveImageSrc(props.poster) : undefined
                }
                controls
                style={{ width: "100%", borderRadius: "10px" }}
              />
            </div>

            {/* Upload video */}
            <div>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => handleVideoUpload(e, "src")}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
                disabled={isUploading}
              >
                {isUploading ? "Uploading..." : "Upload video"}
              </button>
            </div>
            {/* Progress bar */}
            {isUploading && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {/* Poster upload (optional) – reuse your image upload helper */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Poster
              </label>
              <div className="flex items-center gap-2">
                <img
                  src={
                    props.poster
                      ? resolveImageSrc(props.poster)
                      : "https://placehold.co/160x90?text=Poster"
                  }
                  alt="poster"
                  className="w-40 h-24 object-cover rounded border bg-gray-100"
                />
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={posterInputRef}
                    onChange={(e) => handleImageUpload(e, "poster")}
                  />
                  <button
                    onClick={() => posterInputRef.current?.click()}
                    className="text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
                  >
                    Upload poster
                  </button>
                </div>
              </div>
            </div>

            {/* Styles */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Card Style
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border rounded p-2"
                  placeholder="Background color"
                  value={props.style?.backgroundColor || "#ffffff"}
                  onChange={(e) =>
                    handleStyleChange("backgroundColor", e.target.value)
                  }
                />
                <input
                  className="border rounded p-2"
                  placeholder="Padding (e.g. 1rem)"
                  value={props.style?.padding || "1rem"}
                  onChange={(e) => handleStyleChange("padding", e.target.value)}
                />
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Title Style
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border rounded p-2"
                  placeholder="Font size"
                  value={props.titleStyle?.fontSize || "1.125rem"}
                  onChange={(e) =>
                    handleTitleStyleChange("fontSize", e.target.value)
                  }
                />
                <input
                  type="color"
                  className="h-10 border rounded"
                  value={props.titleStyle?.color || "#111827"}
                  onChange={(e) =>
                    handleTitleStyleChange("color", e.target.value)
                  }
                />
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Meta Style
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border rounded p-2"
                  placeholder="Font size"
                  value={props.metaStyle?.fontSize || ".875rem"}
                  onChange={(e) =>
                    handleMetaStyleChange("fontSize", e.target.value)
                  }
                />
                <input
                  type="color"
                  className="h-10 border rounded"
                  value={props.metaStyle?.color || "#6b7280"}
                  onChange={(e) =>
                    handleMetaStyleChange("color", e.target.value)
                  }
                />
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Video Style
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border rounded p-2"
                  placeholder="Width (e.g. 100%)"
                  value={props.videoStyle?.width || "100%"}
                  onChange={(e) =>
                    handleVideoStyleChange("width", e.target.value)
                  }
                />
                <input
                  className="border rounded p-2"
                  placeholder="Border radius (e.g. 10px)"
                  value={props.videoStyle?.borderRadius || "10px"}
                  onChange={(e) =>
                    handleVideoStyleChange("borderRadius", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Visibility panel reuse (as with other elements) */}
            <VisibilityEditor
              value={selectedItem.properties}
              onChange={(next) =>
                updateItem({ ...selectedItem, properties: next })
              }
            />
          </div>
        );
        break;
      }

      case "LOGIN_FORM":
        return renderAuthFormEditor("LOGIN_FORM");
      case "REGISTER_FORM":
        return renderAuthFormEditor("REGISTER_FORM");

      default: {
        editorBody = <p>No editor for this element.</p>;
      }
    }

    // Always append the Visibility editor
    return (
      <>
        {editorBody}
        <hr className="my-4" />
        <VisibilityEditor
          value={selectedItem.properties}
          onChange={(next) => updateItem({ ...selectedItem, properties: next })}
          onBecameProtected={async () => {
            await api.post(
              `/builder/ensure-auth-pages/${websiteData!.website_id}`
            );
          }}
          products={products}
          isSubscribed={isSubscribed} // <-- 7. PASS STATUS TO VISIBILITY EDITOR
        />
      </>
    );
  };

  return (
    <div className="flex flex-col h-full" key={selectedItem.element_id}>
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        {isExpanded && <h2 className="text-xl font-bold">Properties</h2>}
        <button
          onClick={onToggle}
          className="p-1 text-gray-500 hover:text-gray-800 ml-auto"
        >
          {isExpanded ? (
            <PanelRightClose size={20} />
          ) : (
            <PanelRightOpen size={20} />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="overflow-y-auto flex-grow">
          {selectedItem ? (
            <>
              {/* --- Top Toolbar (for all selected items) --- */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg text-gray-600 font-mono capitalize">
                  {selectionType?.replace("_", " ")}
                </h3>
                <div className="flex items-center space-x-2">
                  {selectionType === "element" && (
                    <button
                      onClick={onCopy}
                      title="Copy Element"
                      className="p-2 rounded-full hover:bg-gray-200"
                    >
                      <Copy size={16} />
                    </button>
                  )}
                  {selectionType === "subsection" && clipboard && (
                    <button
                      onClick={onPaste}
                      title="Paste Element"
                      className="p-2 rounded-full hover:bg-gray-200"
                    >
                      <ClipboardPaste size={16} />
                    </button>
                  )}
                  {selectionType !== "navbar" && (
                    <button
                      onClick={handleDelete}
                      className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* --- Section-Specific Editor --- */}
              {selectionType === "section" && (
                <>
                  <div className="flex justify-between items-center mb-4 p-2 border rounded-md">
                    <span className="text-sm font-medium text-gray-700">
                      Move Section
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() =>
                          onMoveSection(selectedItem.section_id, "up")
                        }
                        disabled={
                          activePage?.sections.findIndex(
                            (s) => s.section_id === selectedItem.section_id
                          ) === 0
                        }
                        className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Move Up"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() =>
                          onMoveSection(selectedItem.section_id, "down")
                        }
                        disabled={
                          activePage?.sections.findIndex(
                            (s) => s.section_id === selectedItem.section_id
                          ) ===
                          activePage.sections.length - 1
                        }
                        className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Move Down"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>
                  {renderSectionEditor()}
                </>
              )}

              {/* --- Subsection-Specific Editor --- */}
              {selectionType === "subsection" && renderSubsectionEditor()}

              {/* --- Element-Specific Editor --- */}
              {selectionType === "element" && (
                <>
                  {/* START: RE-ADDED REFINE ELEMENT UI */}
                  <div>
                    <h4 className="text-md font-medium text-gray-800 mb-2">
                      Refine Element with AI
                    </h4>
                    <div className="p-3 border rounded-md bg-gray-50">
                      <textarea
                        rows={3}
                        className="w-full border rounded p-2 text-sm"
                        placeholder="e.g., 'Make the text red' or 'Add a gradient background'."
                        value={elementRefinePrompt}
                        onChange={(e) => setElementRefinePrompt(e.target.value)}
                      />
                      <button
                        onClick={handleRefineElementClick}
                        disabled={
                          isRefiningElement ||
                          !elementRefinePrompt.trim() ||
                          !isSubscribed
                        }
                        className="mt-2 w-full bg-green-600 text-white py-2 rounded disabled:opacity-50"
                      >
                        {isRefiningElement ? "Refining..." : "Refine Element"}
                      </button>
                      {!isSubscribed && (
                        <p className="mt-2 text-sm text-red-600 text-center">
                          Please subscribe to use AI features.
                        </p>
                      )}
                    </div>
                  </div>
                  <hr className="my-4" />
                  {/* END: RE-ADDED REFINE ELEMENT UI */}

                  {renderElementEditor()}
                </>
              )}

              {/* --- Other Editors --- */}
              {selectionType === "navbar" && (
                <>
                  {renderNavbarEditor()}

                  {/* --- START: STANDALONE PAGES (create + list/edit/delete) --- */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="text-md font-medium text-gray-800 mb-2">
                      Standalone Pages
                    </h4>
                    <p className="text-sm text-gray-500 mb-3">
                      These pages won't appear in the main navbar but can be
                      linked from buttons or other elements.
                    </p>

                    {/* Create */}
                    {!isAddingStandalonePage ? (
                      <button
                        onClick={() => setIsAddingStandalonePage(true)}
                        className="w-full flex items-center justify-center text-sm text-green-600 hover:text-green-800 p-2 border-dashed border-2 rounded-md"
                      >
                        <PlusCircle size={16} className="mr-2" /> Create
                        Standalone Page
                      </button>
                    ) : (
                      <div className="mt-3 p-3 border rounded-md bg-gray-100">
                        <input
                          type="text"
                          value={newStandalonePageTitle}
                          onChange={(e) =>
                            setNewStandalonePageTitle(e.target.value)
                          }
                          placeholder="New page title"
                          className="block w-full border-gray-300 rounded-md shadow-sm p-2 text-sm"
                        />
                        <div className="flex items-center justify-end space-x-2 mt-2">
                          <button
                            onClick={() => setIsAddingStandalonePage(false)}
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={handleCreateStandalone}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-full"
                          >
                            <Save size={16} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* List / Edit / Delete */}
                    {(() => {
                      const navSlugs = new Set(
                        (websiteData?.navbar?.items || []).map(
                          (i: NavbarItem) => i.link_url
                        )
                      );
                      const standalonePages = (websiteData?.pages || []).filter(
                        (p: Page) => p.slug !== "/" && !navSlugs.has(p.slug)
                      );

                      if (standalonePages.length === 0) {
                        return (
                          <p className="text-sm text-gray-500 mt-3">
                            No standalone pages yet.
                          </p>
                        );
                      }

                      return (
                        <div className="space-y-2 mt-4">
                          {standalonePages.map((p: Page) => (
                            <div
                              key={p.page_id}
                              className="p-2 border rounded bg-white flex items-center justify-between"
                            >
                              {editingStandalonePageId === p.page_id ? (
                                <div className="flex-1 grid grid-cols-2 gap-2 mr-2">
                                  <input
                                    className="border rounded p-1 text-sm"
                                    value={editedStandaloneTitle}
                                    onChange={(e) =>
                                      setEditedStandaloneTitle(e.target.value)
                                    }
                                    placeholder="Title"
                                  />
                                  <input
                                    className="border rounded p-1 text-sm"
                                    value={editedStandaloneSlug}
                                    onChange={(e) =>
                                      setEditedStandaloneSlug(e.target.value)
                                    }
                                    placeholder="/my-page"
                                  />
                                </div>
                              ) : (
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">
                                    {p.title}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {p.slug}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                {editingStandalonePageId === p.page_id ? (
                                  <>
                                    <button
                                      onClick={saveEditStandalone}
                                      className="p-1 text-green-600 hover:bg-green-100 rounded-full"
                                      title="Save"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setEditingStandalonePageId(null)
                                      }
                                      className="p-1 text-gray-500 hover:bg-gray-200 rounded-full"
                                      title="Cancel"
                                    >
                                      <X size={16} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => beginEditStandalone(p)}
                                      className="p-1 text-blue-600 hover:bg-blue-100 rounded-full"
                                      title="Edit"
                                    >
                                      <Edit size={16} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteStandalonePage(
                                          p.page_id,
                                          p.title
                                        )
                                      }
                                      className="p-1 text-red-600 hover:bg-red-100 rounded-full"
                                      title="Delete"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  {/* --- END: STANDALONE PAGES --- */}
                </>
              )}
              {selectionType === "navbar_item" && renderNavbarItemEditor()}
            </>
          ) : (
            <p className="text-gray-500">Select an item to edit.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PropertyEditor;
