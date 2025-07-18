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
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

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
}

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
}) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    const fetchMenuItems = async () => {
      if (selectedLocationId) {
        try {
          const response = await api.get(
            `/locations/${selectedLocationId}/menu`
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
