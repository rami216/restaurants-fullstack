// frontend/src/components/builder/PublicCanvas.tsx

"use client";

import React, { useState, useEffect } from "react";
import {
  Page,
  WebsiteData,
  NavbarItem,
  Section as SectionType,
  Subsection as SubsectionType,
  Element as ElementType,
  FormField,
  AccordionItem,
} from "./Properties";
import api from "@/lib/axios";
import { ChevronDown } from "lucide-react";

// You should move your Accordion component to its own file and import it here
const Accordion = ({
  items,
  style,
}: {
  items: AccordionItem[];
  style: any;
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const toggleItem = (index: number) =>
    setOpenIndex(openIndex === index ? null : index);
  return (
    <div className="space-y-2" style={{ width: style.width || "100%" }}>
      {(items || []).map((item, index) => (
        <div key={item.id} className="border rounded-md overflow-hidden">
          <button
            onClick={() => toggleItem(index)}
            className="w-full flex justify-between items-center p-3 font-semibold text-left"
            style={{ backgroundColor: style.questionBg || "#f3f4f6" }}
          >
            <span>{item.question}</span>
            <ChevronDown
              size={20}
              style={{
                color: style.iconColor || "#6b7280",
                transform:
                  openIndex === index ? "rotate(180deg)" : "rotate(0deg)",
              }}
              className="transition-transform duration-300"
            />
          </button>
          {openIndex === index && (
            <div
              className="p-3 text-gray-700"
              style={{ backgroundColor: style.answerBg || "#ffffff" }}
            >
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

interface PublicCanvasProps {
  initialPage: Page | undefined;
  websiteData: WebsiteData;
}

const PublicCanvas: React.FC<PublicCanvasProps> = ({
  initialPage,
  websiteData,
}) => {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    page: Page
  ) => {
    e.preventDefault();
    setCurrentPage(page);
    window.history.pushState({}, "", page.slug);
  };

  // This is a complete renderElement function copied from your BuilderCanvas
  const renderElement = (element: ElementType) => {
    const props = element.properties || {};
    const style = props.style || {};
    const BACKEND_URL = api.defaults.baseURL || "http://127.0.0.1:8000";

    switch (element.element_type) {
      case "TEXT":
        return <div style={style}>{props.content || "New Text Block"}</div>;
      case "BUTTON":
        return <button style={style}>{props.text || "Button"}</button>;
      case "IMAGE":
        return (
          <img
            src={props.src || "https://placehold.co/600x400"}
            alt={props.alt || "placeholder"}
            style={style}
          />
        );
      case "LIST":
        return (
          <ul style={style}>
            {(props.items || []).map((item: string, index: number) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        );
      case "DROPDOWN":
        return (
          <select className="border border-gray-300 rounded p-2">
            {props.label && <option disabled>{props.label}</option>}
            {(props.options || []).map((opt: any, index: number) => (
              <option key={index} value={opt.action_value}>
                {opt.text}
              </option>
            ))}
          </select>
        );
      case "MENU_ITEM":
        return (
          <div className="border rounded-lg p-4 bg-white shadow" style={style}>
            {props.image_url && (
              <img
                src={`${BACKEND_URL}${props.image_url}`}
                alt={props.item_name}
                className="w-full object-cover rounded-md mb-4"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <h4 className="font-bold text-lg text-gray-800">
              {props.item_name || "Menu Item"}
            </h4>
            <p className="text-sm text-gray-600 my-2">
              {props.description || "No description available."}
            </p>
            <p className="font-semibold text-right text-gray-800">
              ${props.base_price?.toFixed(2) || "0.00"}
            </p>
          </div>
        );
      case "CATEGORY":
        const nameStyle = props.nameStyle || {};
        return (
          <div
            className="rounded-lg overflow-hidden bg-white shadow-md"
            style={style}
          >
            {props.image_url && (
              <img
                src={`${BACKEND_URL}${props.image_url}`}
                alt={props.name}
                className="w-full h-40 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="p-4">
              <h4 className="font-bold text-xl text-gray-800" style={nameStyle}>
                {props.name || "Category Name"}
              </h4>
            </div>
          </div>
        );
      case "ACCORDION":
        return <Accordion items={props.items || []} style={style} />;
      case "FORM":
        const buttonStyle = props.submitButton?.style || {};
        const labelStyle = props.labelStyle || {};
        return (
          <div className="border rounded-lg" style={style}>
            <h3 className="text-2xl font-bold mb-4 text-gray-800">
              {props.title || "Form Title"}
            </h3>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              {(props.fields || []).map((field: FormField) => (
                <div key={field.id}>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={labelStyle}
                  >
                    {field.label}
                  </label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
              ))}
              <button type="submit" style={buttonStyle}>
                {props.submitButton?.text || "Submit"}
              </button>
            </form>
          </div>
        );
      case "MAP":
        return (
          <iframe
            src={props.src}
            style={style} // pointerEvents:none is crucial
            allowFullScreen={false}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Google Map"
          ></iframe>
        );
      default:
        return (
          <div className="border p-2 bg-gray-300 text-black rounded">
            Unknown Element
          </div>
        );
    }
  };

  if (!currentPage) {
    return <div>Page not found.</div>;
  }

  return (
    <div className="bg-white">
      {websiteData.navbar && (
        <nav style={websiteData.navbar.properties}>
          <div className="flex items-center justify-between p-4">
            <div className="text-lg font-bold">Your Logo</div>
            <div className="flex items-center space-x-4">
              {websiteData.navbar.items.map((item: NavbarItem) => {
                const targetPage = websiteData.pages.find(
                  (p) => p.slug === item.link_url
                );
                if (!targetPage) return null;
                return (
                  <a
                    key={item.item_id}
                    href={item.link_url}
                    onClick={(e) => handleNavClick(e, targetPage)}
                    style={websiteData.navbar?.properties?.itemStyle}
                  >
                    {item.text}
                  </a>
                );
              })}
            </div>
          </div>
        </nav>
      )}
      <div className="space-y-4">
        {currentPage.sections.map((section: SectionType) => (
          <div key={section.section_id} style={section.properties}>
            <div
              className="flex flex-wrap"
              style={{
                display: "flex",
                flexDirection: section.properties.flexDirection,
                justifyContent: section.properties.justifyContent,
                alignItems: section.properties.alignItems,
                gap: section.properties.gap,
              }}
            >
              {section.subsections.map((subsection: SubsectionType) => (
                <div
                  key={subsection.subsection_id}
                  style={subsection.properties}
                >
                  {subsection.elements.map((element: ElementType) => (
                    <div key={element.element_id}>{renderElement(element)}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PublicCanvas;
