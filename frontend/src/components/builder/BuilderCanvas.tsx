// frontend/src/components/builder/BuilderCanvas.tsx

"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Page,
  Selection,
  Section as SectionType,
  Subsection as SubsectionType,
  Element as ElementType,
  FormField,
  AccordionItem,
  Navbar,
  NavbarItem,
  WebsiteData, // Import WebsiteData
} from "./Properties";
import { Plus, ChevronDown } from "lucide-react";
import api from "@/lib/axios"; // Import api to get the base URL
import { motion } from "framer-motion";
import { getMotionConfig } from "./animate";
import Mustache from "mustache";

const Accordion = ({
  items,
  style,
}: {
  items: AccordionItem[];
  style: any;
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

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
const AiElementRunner: React.FC<{ element: ElementType }> = ({ element }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { aiPayload } = element;

  useEffect(() => {
    if (containerRef.current && aiPayload?.script) {
      try {
        // Create a function that takes the container element as an argument
        const scriptFunction = new Function("container", aiPayload.script);
        // Execute the script, passing the actual container div to it
        scriptFunction(containerRef.current);
      } catch (error) {
        console.error("Error executing AI-generated script:", error);
      }
    }
  }, [aiPayload?.script, aiPayload?.properties]); // Re-run if script or properties change

  if (!aiPayload) {
    return <div>AI Element Data Missing</div>;
  }

  const { aiTemplate, properties: aiProps } = aiPayload;
  const html = Mustache.render(aiTemplate, aiProps);

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
};

interface BuilderCanvasProps {
  page: Page | undefined;
  navbar: Navbar | null; // Pass navbar data
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onUpdate: (updatedPage: Page) => void;
  onPageSwitch: (pageId: string) => void;
  websiteData: WebsiteData | null; // Add websiteData to props
  isPreview?: boolean;
}

const BuilderCanvas: React.FC<BuilderCanvasProps> = ({
  page,
  navbar,
  selection,
  onUpdate,
  onSelect,
  onPageSwitch,
  websiteData,
  isPreview = false,
}) => {
  // --- NEW: State for handling page navigation in preview mode ---
  const [currentPage, setCurrentPage] = useState(page);
  const handlePreviewPageSwitch = (pageId: string) => {
    const newPage = websiteData?.pages.find((p) => p.page_id === pageId);
    if (newPage) {
      setCurrentPage(newPage);
    }
  };
  const handleAddSection = () => {
    if (!page) return;
    const newSection: SectionType = {
      section_id: `section_${Date.now()}`,
      section_type: "default",
      position: (page.sections?.length || 0) + 1,
      properties: {
        display: "flex",
        flexDirection: "row",
        gap: "1rem",
        padding: "2rem",
        backgroundColor: "#ffffff",
      },
      subsections: [],
    };
    const updatedPage = { ...page, sections: [...page.sections, newSection] };
    onUpdate(updatedPage);
  };

  const handleAddSubsection = (sectionId: string) => {
    if (!page) return;
    const updatedSections = page.sections.map((section) => {
      if (section.section_id === sectionId) {
        const newSubsection: SubsectionType = {
          subsection_id: `subsection_${Date.now()}`,
          position: (section.subsections?.length || 0) + 1,
          properties: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
          },
          elements: [],
        };
        return {
          ...section,
          subsections: [...section.subsections, newSubsection],
        };
      }
      return section;
    });
    onUpdate({ ...page, sections: updatedSections });
  };

  function renderElement(element: ElementType) {
    const props = element.properties || {};
    const style = props.style || {};
    const BACKEND_URL = "http://127.0.0.1:8000";

    // pull motion configs (will be {} if no anim requested)
    const { initial, animate, transition } = getMotionConfig(props.animation);

    // helper to wrap any JSX in motion.div
    const wrap = (children: React.ReactNode) => (
      <motion.div
        style={style}
        initial={initial}
        animate={animate}
        transition={transition}
      >
        {children}
      </motion.div>
    );

    switch (element.element_type) {
      case "FORM": {
        const buttonStyle = props.submitButton?.style || {};
        const labelStyle = props.labelStyle || {};

        const formJSX = (
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

        return wrap(formJSX);
      }

      case "TEXT": {
        return wrap(<div>{props.content}</div>);
      }

      case "BUTTON": {
        // navigate on click if action_value is a slug
        const targetPage = websiteData?.pages.find(
          (p) => p.slug === props.action_value
        );

        return wrap(
          <button
            style={style}
            // onClick={(e) => {
            //   e.preventDefault();
            //   e.stopPropagation();
            //   if (targetPage) onPageSwitch(targetPage.page_id);
            // }}
          >
            {props.text || "Button"}
          </button>
        );
      }

      case "IMAGE": {
        return wrap(
          <img
            src={props.src || "https://placehold.co/600x400"}
            alt={props.alt || "placeholder"}
            style={style}
          />
        );
      }

      case "LIST": {
        return wrap(
          <ul style={style}>
            {(props.items || []).map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
      }

      case "DROPDOWN": {
        return wrap(
          <select className="border border-gray-300 rounded p-2">
            {props.label && <option disabled>{props.label}</option>}
            {(props.options || []).map((opt: any, i: number) => (
              <option key={i} value={opt.action_value}>
                {opt.text}
              </option>
            ))}
          </select>
        );
      }

      case "MENU_ITEM": {
        const card = (
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
        return wrap(card);
      }

      case "CATEGORY": {
        const nameStyle = props.nameStyle || {};
        const card = (
          <div
            className="rounded-lg overflow-hidden bg-white shadow-md cursor-pointer"
            style={style}
            // onClick={() => setActiveCategory(props.id)}
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
              <h4 className="font-bold text-xl" style={nameStyle}>
                {props.name || "Category Name"}
              </h4>
            </div>
          </div>
        );
        return wrap(card);
      }

      case "ACCORDION": {
        return wrap(<Accordion items={props.items || []} style={style} />);
      }

      case "MAP": {
        return wrap(
          <div className="relative">
            <div className="absolute inset-0 z-10 cursor-pointer" />
            <iframe
              src={props.src}
              style={{ ...style, pointerEvents: "none" }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Google Map"
            />
          </div>
        );
      }
      // case "AI": {
      //   if (!element.aiPayload) {
      //     return wrap(
      //       <div className="border p-2 bg-red-200 text-red-800 rounded">
      //         AI Element Data Missing
      //       </div>
      //     );
      //   }
      //   // THE FIX: Re-render the Mustache template with the current properties on every render.
      //   const { aiTemplate, properties: aiProps } = element.aiPayload;
      //   const html = Mustache.render(aiTemplate, aiProps);
      //   return wrap(<div dangerouslySetInnerHTML={{ __html: html }} />);
      // }
      // case "AI": {
      //   if (!element.aiPayload) {
      //     return wrap(
      //       <div className="border p-2 bg-red-200 text-red-800 rounded">
      //         AI Element Data Missing
      //       </div>
      //     );
      //   }

      //   const { aiTemplate, properties: aiProps } = element.aiPayload;

      //   // THE FIX: This correctly handles both text rendering and live style updates.
      //   // 1. Render the template to get the correct text values.
      //   const html = Mustache.render(aiTemplate, aiProps);

      //   // 2. Create a style object for the dynamic CSS variables.
      //   const styleVariables: React.CSSProperties = {};
      //   for (const [key, value] of Object.entries(aiProps)) {
      //     // This tells TypeScript to allow custom properties like "--primaryColor"
      //     (styleVariables as any)[`--${key}`] = value;
      //   }

      //   // 3. Return a wrapper div with the dynamic styles, containing the rendered HTML.
      //   return (
      //     <div style={styleVariables}>
      //       <div dangerouslySetInnerHTML={{ __html: html }} />
      //     </div>
      //   );
      // }
      case "AI": {
        // --- REPLACE the old AI case with this ---
        return <AiElementRunner element={element} />;
      }
      default:
        return wrap(
          <div className="border p-2 bg-gray-300 text-black rounded">
            Unknown Element
          </div>
        );
    }
  }

  if (!page) {
    return (
      <div className="text-center p-10 text-gray-500">
        Select a page to start building.
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-inner">
      {/* --- NAVBAR RENDERING --- */}
      {navbar && (
        <nav
          onClick={
            !isPreview
              ? () => onSelect({ type: "navbar", id: navbar.navbar_id })
              : undefined
          }
          className={`p-4 mb-4 rounded-lg transition-all ${
            !isPreview
              ? `cursor-pointer border-2 ${
                  selection.type === "navbar" &&
                  selection.id === navbar.navbar_id
                    ? "border-purple-500"
                    : "border-dashed border-gray-300"
                }`
              : ""
          }`}
          style={navbar.properties}
        >
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold">Your Logo</div>
            <div className="flex items-center space-x-4">
              {navbar.items.map((item: NavbarItem) => {
                const targetPage = websiteData?.pages.find(
                  (p) => p.slug === item.link_url
                );
                const itemStyle = navbar.properties?.itemStyle || {};

                return (
                  <a
                    key={item.item_id}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (targetPage) onPageSwitch(targetPage.page_id);
                      onSelect({ type: "navbar_item", id: item.item_id });
                    }}
                    style={itemStyle}
                    className={`px-3 py-2 rounded transition-all ${
                      selection.type === "navbar_item" &&
                      selection.id === item.item_id
                        ? "ring-2 ring-purple-500"
                        : ""
                    } ${
                      page?.page_id === targetPage?.page_id
                        ? "bg-purple-100 text-purple-700"
                        : ""
                    }`}
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
        {page.sections.map((section) => {
          // build section style
          const sectionStyle: React.CSSProperties = { ...section.properties };
          if (section.properties.backgroundImage) {
            sectionStyle.backgroundImage = `url(${api.defaults.baseURL}${section.properties.backgroundImage})`;
            sectionStyle.backgroundSize = "cover";
            sectionStyle.backgroundPosition = "center";
          }

          return (
            <div
              key={section.section_id}
              onClick={
                !isPreview
                  ? () => onSelect({ type: "section", id: section.section_id })
                  : undefined
              }
              className={`p-4 rounded-lg transition-all ${
                !isPreview
                  ? `cursor-pointer border-2 ${
                      selection.type === "section" &&
                      selection.id === section.section_id
                        ? "border-blue-500"
                        : "border-dashed border-gray-300"
                    }`
                  : ""
              }`}
              style={sectionStyle}
            >
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
                {section.subsections.map((sub) => {
                  // build subsection style
                  const subsectionStyle: React.CSSProperties = {
                    display: sub.properties.display || "flex",
                    gap: sub.properties.gap || "1rem",
                  };
                  if (sub.properties.display === "grid") {
                    subsectionStyle.gridTemplateColumns =
                      sub.properties.gridTemplateColumns || "repeat(2, 1fr)";
                  } else {
                    subsectionStyle.flexDirection =
                      sub.properties.flexDirection || "column";
                    subsectionStyle.justifyContent =
                      sub.properties.justifyContent || "flex-start";
                    subsectionStyle.alignItems =
                      sub.properties.alignItems || "stretch";
                  }

                  // pull motion config
                  const { initial, animate, transition } = getMotionConfig(
                    sub.properties.animation
                  );

                  return (
                    <motion.div
                      key={sub.subsection_id}
                      initial={initial}
                      animate={animate}
                      transition={transition}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect({
                          type: "subsection",
                          id: sub.subsection_id,
                        });
                      }}
                      className={`p-4 border-2 rounded-lg min-h-[100px] flex-1 transition-all ${
                        selection.type === "subsection" &&
                        selection.id === sub.subsection_id
                          ? "border-green-500"
                          : "border-dashed border-gray-400"
                      }`}
                      style={subsectionStyle}
                    >
                      {sub.elements.map((el) => (
                        <div
                          key={el.element_id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect({ type: "element", id: el.element_id });
                          }}
                          className={`p-2 rounded transition-all ${
                            selection.type === "element" &&
                            selection.id === el.element_id
                              ? "ring-2 ring-offset-2 ring-pink-500"
                              : ""
                          }`}
                        >
                          {renderElement(el)}
                        </div>
                      ))}

                      {sub.elements.length === 0 && (
                        <div className="text-gray-400 self-center mx-auto">
                          Add elements here
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {/* one Add Subsection per section */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddSubsection(section.section_id);
                  }}
                  className="flex items-center justify-center min-h-[100px] w-32 border-2 border-dashed border-gray-400 rounded-lg text-gray-400 hover:border-green-500 hover:text-green-500 transition-all"
                >
                  <Plus size={24} />
                </button>
              </div>
            </div>
          );
        })}

        {/* one Add New Section at bottom */}
        {!isPreview && (
          <button
            onClick={handleAddSection}
            className="w-full py-4 border-2 border-dashed border-gray-400 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500"
          >
            + Add New Section
          </button>
        )}
      </div>
    </div>
  );
};

export default BuilderCanvas;
