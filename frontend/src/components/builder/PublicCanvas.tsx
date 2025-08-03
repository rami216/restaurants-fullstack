// frontend/src/components/builder/PublicCanvas.tsx
"use client";
import { motion } from "framer-motion";
import { getMotionConfig } from "./animate";
import Mustache from "mustache";

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  Page,
  PublicWebsiteData,
  NavbarItem,
  Section as SectionType,
  Subsection as SubsectionType,
  Element as ElementType,
  FormField,
  AccordionItem,
  Location,
  MenuItem,
  Extra,
} from "./Properties";
import api from "@/lib/axios";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Element as BuilderElement } from "./Properties";

// const AiElementRunner: React.FC<{ element: ElementType }> = ({ element }) => {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const { aiPayload } = element;

//   useEffect(() => {
//     const container = containerRef.current;
//     // We only need the effect to run the script.
//     // The HTML is now handled by the main return statement.
//     if (container && aiPayload?.script) {
//       try {
//         const scriptFunction = new Function("container", aiPayload.script);
//         scriptFunction(container);
//       } catch (error) {
//         console.error("Error executing AI-generated script:", error);
//       }
//     }
//   }, [element.element_id, aiPayload]); // Re-run when the element itself changes

//   if (!aiPayload) {
//     return <div>AI Element Data Missing</div>;
//   }

//   // THE FIX: The HTML is now always rendered here, outside of the effect.
//   const { aiTemplate, properties: aiProps } = aiPayload;
//   const html = Mustache.render(aiTemplate, aiProps);

//   return (
//     <div
//       ref={containerRef}
//       className="w-full max-w-full overflow-x-hidden"
//       dangerouslySetInnerHTML={{ __html: html }}
//     />
//   );
// };
// --- Add this component inside PublicCanvas.tsx ---
// const AiElementRunner: React.FC<{ element: ElementType }> = ({ element }) => {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const { aiPayload } = element;

//   useEffect(() => {
//     if (containerRef.current && aiPayload?.script) {
//       try {
//         const scriptFunction = new Function("container", aiPayload.script);
//         scriptFunction(containerRef.current);
//       } catch (error) {
//         console.error("Error executing AI-generated script:", error);
//       }
//     }
//   }, [aiPayload]); // Re-run if the payload changes

//   if (!aiPayload) {
//     return <div>AI Element Data Missing</div>;
//   }

//   const { aiTemplate, properties: aiProps } = aiPayload;
//   const html = Mustache.render(aiTemplate, aiProps);

//   return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
// };
const AiElementRunner: React.FC<{ element: BuilderElement }> = ({
  element,
}) => {
  const { aiPayload } = element;
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!aiPayload || !containerRef.current) return;

    // render HTML
    containerRef.current.innerHTML = Mustache.render(
      aiPayload.aiTemplate,
      aiPayload.properties
    );

    // execute script
    if (aiPayload.script) {
      try {
        const fn = new Function("container", aiPayload.script);
        fn(containerRef.current);
      } catch (e) {
        console.error("AI script error:", e);
      }
    }
  }, [
    aiPayload?.aiTemplate,
    aiPayload?.script,
    JSON.stringify(aiPayload?.properties),
  ]);

  if (!aiPayload) {
    return <div>AI Element Data Missing</div>;
  }

  // safety: template must be string
  if (typeof aiPayload.aiTemplate !== "string") {
    console.error("Invalid aiTemplate:", aiPayload.aiTemplate);
    return (
      <div className="p-4 bg-red-100 text-red-700 border border-red-400 rounded">
        Error: AI template is corrupted.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full overflow-hidden" />;
};

const Accordion = ({
  items,
  style,
}: {
  items: AccordionItem[];
  style: any;
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="space-y-2" style={{ width: style.width || "100%" }}>
      {items.map((it, i) => (
        <div key={it.id} className="border rounded-md overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex justify-between items-center p-3 font-semibold text-left"
            style={{ backgroundColor: style.questionBg || "#f3f4f6" }}
          >
            <span>{it.question}</span>
            <ChevronDown
              size={20}
              className="transition-transform"
              style={{
                color: style.iconColor || "#6b7280",
                transform: openIndex === i ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>
          {openIndex === i && (
            <div
              className="p-3 text-gray-700"
              style={{ backgroundColor: style.answerBg || "#fff" }}
            >
              {it.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const CategoryMenuInCanvas = ({
  locations,
  categoryId,
}: {
  locations: Location[];
  categoryId: string;
}) => {
  const [locationId, setLocationId] = useState(locations[0]?.location_id || "");
  const [items, setItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    if (!locationId) return;
    api
      .get<MenuItem[]>(
        `/locations/${locationId}/menu?category_id=${categoryId}`
      )
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  }, [locationId, categoryId]);

  return (
    <div className="p-4">
      {/* location dropdown */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Choose location:</label>
        <select
          className="border rounded p-2"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          {locations.map((loc) => (
            <option key={loc.location_id} value={loc.location_id}>
              {loc.location_name}
            </option>
          ))}
        </select>
      </div>

      {/* menu items grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div
            key={item.item_id}
            className="border rounded-lg bg-white shadow hover:shadow-lg transition overflow-hidden"
            style={{ maxWidth: 280 }}
          >
            <div className="w-full aspect-[4/3] overflow-hidden">
              <img
                src={`${api.defaults.baseURL}${item.image_url}`}
                alt={item.item_name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-3">
              <h4 className="font-semibold text-base mb-1">{item.item_name}</h4>
              <p className="text-sm text-gray-600 mb-2">{item.description}</p>
              <p className="font-medium">${item.base_price.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface PublicCanvasProps {
  initialPage?: Page;
  websiteData: PublicWebsiteData;
}

const PublicCanvas: React.FC<PublicCanvasProps> = ({
  initialPage,
  websiteData,
}) => {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<Page | undefined>(initialPage);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [expandedMenuItemId, setExpandedMenuItemId] = useState<string | null>(
    null
  );
  const [extras, setExtras] = useState<Record<string, Extra[]>>({});
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const handleMenuItemClick = async (menuItemId: string) => {
    // If the clicked item is already open, close it.
    if (expandedMenuItemId === menuItemId) {
      setExpandedMenuItemId(null);
      return;
    }

    setIsLoadingExtras(true);
    setExpandedMenuItemId(menuItemId);

    try {
      // Check if we've already fetched extras for this item
      if (!extras[menuItemId]) {
        const response = await api.get<Extra[]>(
          `/menu-item-extras/extras-for-item/${menuItemId}`
        );
        setExtras((prevExtras) => ({
          ...prevExtras,
          [menuItemId]: response.data,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch extras:", error);
      // Handle error, maybe show a toast notification
    } finally {
      setIsLoadingExtras(false);
    }
  };
  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);
  // always render navbar
  const NavBar = () => (
    <nav style={websiteData.navbar!.properties}>
      <div className="flex items-center justify-between px-6 py-3 shadow-sm">
        <div className="font-bold text-xl">Your Logo</div>
        <div className="flex space-x-4">
          {websiteData.navbar!.items.map((ni: NavbarItem) => {
            const tgt = websiteData.pages.find((p) => p.slug === ni.link_url);
            if (!tgt) return null;
            return (
              <a
                key={ni.item_id}
                href={ni.link_url}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveCategory(null);
                  router.push(`/${websiteData.subdomain}${tgt.slug}`);
                }}
                style={websiteData.navbar!.properties.itemStyle}
                className="text-sm font-medium hover:underline"
              >
                {ni.text}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );

  // show category drill-down in place of the page content
  const MainContent = () => {
    if (activeCategory) {
      return (
        <>
          {/* category selector */}
          <div className="p-4">
            <button
              onClick={() => setActiveCategory(null)}
              className="text-blue-600 underline mb-4"
            >
              ← Back to "{currentPage?.title}"
            </button>
          </div>
          <CategoryMenuInCanvas
            locations={websiteData.locations}
            categoryId={activeCategory}
          />
        </>
      );
    }

    // Normal page sections
    // return (
    //   <div className="space-y-0">
    //     {currentPage?.sections.map((sec: SectionType) => (
    //       <div key={sec.section_id} style={sec.properties || {}}>
    //         <div
    //           className="w-full overflow-x-hidden"
    //           style={{
    //             display: "flex",
    //             flexDirection: sec.properties.flexDirection,
    //             justifyContent: sec.properties.justifyContent,
    //             alignItems: sec.properties.alignItems,
    //             gap: sec.properties.gap,
    //           }}
    //         >
    //           {sec.subsections.map((sub) => {
    //             // remove animation before spreading into style
    //             const { animation, style, ...styleProps } = sub.properties; // <-- CHANGE IS HERE

    //             // get your motion config from that optional animation
    //             const { initial, animate, transition } =
    //               getMotionConfig(animation);

    //             return (
    //               <motion.div
    //                 className="max-w-full"
    //                 key={sub.subsection_id}
    //                 style={{ ...styleProps, ...(style || {}) }}
    //                 initial={initial}
    //                 animate={animate}
    //                 transition={transition}
    //               >
    //                 {sub.elements.map((el) => {
    //                   // --- THIS IS THE FIX ---
    //                   // We wrap the element rendering in a try-catch block.
    //                   try {
    //                     return (
    //                       <div key={el.element_id}>{renderElement(el)}</div>
    //                     );
    //                   } catch (error) {
    //                     console.error("Failed to render element:", el, error);
    //                     return (
    //                       <div
    //                         key={el.element_id}
    //                         className="p-4 bg-red-100 text-red-700 border border-red-400 rounded"
    //                       >
    //                         Error: This element could not be displayed.
    //                       </div>
    //                     );
    //                   }
    //                   // --- END OF FIX ---
    //                 })}
    //               </motion.div>
    //             );
    //           })}
    //         </div>
    //       </div>
    //     ))}
    //   </div>
    // );
    // return (
    //   <div className="space-y-0">
    //     {currentPage?.sections.map((sec: SectionType) => {
    //       // 1. Create a safe properties object for the section
    //       const secProperties = sec.properties || {};

    //       // 2. Combine the section's manual properties with its AI-generated style object
    //       const sectionStyle: React.CSSProperties = {
    //         ...secProperties,
    //         ...(secProperties.style || {}),
    //       };

    //       // 3. Keep the special handling for manually uploaded images
    //       if (
    //         sectionStyle.backgroundImage &&
    //         !sectionStyle.backgroundImage.startsWith("linear-gradient") &&
    //         !sectionStyle.backgroundImage.startsWith("radial-gradient")
    //       ) {
    //         sectionStyle.backgroundImage = `url(${api.defaults.baseURL}${sectionStyle.backgroundImage})`;
    //         sectionStyle.backgroundSize = "cover";
    //         sectionStyle.backgroundPosition = "center";
    //       }

    //       return (
    //         // The main section container now has all the correct styles
    //         <div key={sec.section_id} style={sectionStyle}>
    //           {/* This inner div is now just for structure, no style prop needed */}
    //           <div className="w-full overflow-x-hidden flex flex-wrap">
    //             {sec.subsections.map((sub) => {
    //               // 4. Create a safe properties object for the subsection
    //               const subProperties = sub.properties || {};
    //               const { animation, style, ...layoutProps } = subProperties;

    //               // 5. Get animation config
    //               const { initial, animate, transition } =
    //                 getMotionConfig(animation);

    //               // 6. Combine subsection layout styles with its AI style object
    //               const subsectionStyle = { ...layoutProps, ...(style || {}) };

    //               return (
    //                 <motion.div
    //                   className="max-w-full"
    //                   key={sub.subsection_id}
    //                   style={subsectionStyle}
    //                   initial={initial}
    //                   animate={animate}
    //                   transition={transition}
    //                 >
    //                   {sub.elements.map((el) => {
    //                     try {
    //                       return (
    //                         <div key={el.element_id}>{renderElement(el)}</div>
    //                       );
    //                     } catch (error) {
    //                       console.error("Failed to render element:", el, error);
    //                       return (
    //                         <div
    //                           key={el.element_id}
    //                           className="p-4 bg-red-100 text-red-700 border border-red-400 rounded"
    //                         >
    //                           Error: This element could not be displayed.
    //                         </div>
    //                       );
    //                     }
    //                   })}
    //                 </motion.div>
    //               );
    //             })}
    //           </div>
    //         </div>
    //       );
    //     })}
    //   </div>
    // );
    return (
      <div className="space-y-0">
        {currentPage?.sections.map((sec: SectionType) => {
          // 1. Safely get the section's properties, defaulting to an empty object
          const properties = sec.properties || {};

          // 2. Separate styles for the outer container (background, padding)
          const containerStyle: React.CSSProperties = {
            backgroundColor: properties.backgroundColor,
            backgroundImage: properties.backgroundImage,
            padding: properties.padding,
            ...(properties.style || {}), // Merge AI styles, which can override the above
          };

          // 3. Separate styles for the inner layout container (flexbox, gap)
          const layoutStyle: React.CSSProperties = {
            display: "flex",
            flexDirection: properties.flexDirection,
            justifyContent: properties.justifyContent,
            alignItems: properties.alignItems,
            gap: properties.gap,
          };

          // 4. Handle special formatting for manually uploaded background images
          if (
            containerStyle.backgroundImage &&
            !containerStyle.backgroundImage.includes("gradient") // <-- THE ONLY CHANGE IS HERE
          ) {
            containerStyle.backgroundImage = `url(${api.defaults.baseURL}${containerStyle.backgroundImage})`;
            containerStyle.backgroundSize = "cover";
            containerStyle.backgroundPosition = "center";
          }

          return (
            // The outer div gets the container styles
            <div key={sec.section_id} style={containerStyle}>
              {/* The inner div gets the layout styles, arranging the subsections */}
              <div
                className="w-full overflow-x-hidden flex flex-wrap"
                style={layoutStyle}
              >
                {sec.subsections.map((sub) => {
                  // Safely get subsection properties
                  const subProperties = sub.properties || {};
                  const { animation, style, ...subLayoutParams } =
                    subProperties;
                  const { initial, animate, transition } =
                    getMotionConfig(animation);

                  // Combine subsection layout and AI styles
                  const subsectionStyle = {
                    ...subLayoutParams,
                    ...(style || {}),
                  };

                  return (
                    <motion.div
                      className="max-w-full"
                      key={sub.subsection_id}
                      style={subsectionStyle}
                      initial={initial}
                      animate={animate}
                      transition={transition}
                    >
                      {sub.elements.map((el) => {
                        try {
                          return (
                            <div key={el.element_id}>{renderElement(el)}</div>
                          );
                        } catch (error) {
                          console.error("Failed to render element:", el, error);
                          return (
                            <div
                              key={el.element_id}
                              className="p-4 bg-red-100 text-red-700 border border-red-400 rounded"
                            >
                              Error: This element could not be displayed.
                            </div>
                          );
                        }
                      })}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  function renderElement(element: ElementType) {
    const props = element.properties || {};
    const style = props.style || {};
    const BACKEND = api.defaults.baseURL || "";

    // pull out any motion settings (falls back to no‑ops)
    const { initial, animate, transition } = getMotionConfig(props.animation);

    switch (element.element_type) {
      // case "TEXT":
      //   return (
      //     <motion.div
      //       style={style}
      //       initial={initial}
      //       animate={animate}
      //       transition={transition}
      //     >
      //       {props.content}
      //     </motion.div>
      //   );
      case "TEXT":
        const contentHTML = { __html: props.content || "" };
        return (
          <motion.div
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
            dangerouslySetInnerHTML={contentHTML}
          />
        );
      case "BUTTON": {
        const tgt = websiteData.pages.find(
          (p) => p.slug === props.action_value
        );
        return (
          <motion.button
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
            onClick={() => {
              if (tgt) {
                setActiveCategory(null);
                setCurrentPage(tgt);
                router.push(`/${websiteData.subdomain}${tgt.slug}`);
              }
            }}
          >
            {props.text}
          </motion.button>
        );
      }

      case "IMAGE":
        return (
          <motion.img
            src={
              props.src
                ? `${api.defaults.baseURL}${props.src}`
                : "https://placehold.co/600x400"
            }
            alt={props.alt}
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
          />
        );

      case "LIST":
        return (
          <motion.ul
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
          >
            {(props.items || []).map((it: string, i: number) => (
              <li key={i}>{it}</li>
            ))}
          </motion.ul>
        );

      case "DROPDOWN":
        return (
          <motion.select
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
          >
            {(props.options || []).map((o: any, i: number) => (
              <option key={i} value={o.action_value}>
                {o.text}
              </option>
            ))}
          </motion.select>
        );

      case "MENU_ITEM": {
        // --- FIX #1: Check against the correct database ID ---
        const isExpanded = expandedMenuItemId === element.properties.item_id;

        // --- FIX #2: Look up extras using the correct database ID ---
        const itemExtras = extras[element.properties.item_id] || [];

        return (
          <div>
            <motion.div
              className="border rounded-lg p-4 bg-white shadow cursor-pointer"
              style={style}
              initial={initial}
              animate={animate}
              transition={transition}
              onClick={() => handleMenuItemClick(element.properties.item_id)}
            >
              {props.image_url && (
                <img
                  src={`${BACKEND}${props.image_url}`}
                  alt={props.item_name}
                  className="w-full object-cover rounded-md mb-4"
                />
              )}
              <h4 className="font-bold text-gray-600 text-lg">
                {props.item_name}
              </h4>
              <p className="text-sm text-gray-600 my-2">{props.description}</p>
              <p className="font-semibold text-gray-600 text-right">
                ${props.base_price?.toFixed(2)}
              </p>
            </motion.div>

            {/* This conditional block for extras will now work correctly */}
            {isExpanded && (
              <div className="border border-t-0 rounded-b-lg p-4 bg-gray-50 -mt-2">
                <h5 className="font-bold mb-2 text-gray-700">Add Extras:</h5>
                {isLoadingExtras ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : itemExtras.length > 0 ? (
                  <div className="space-y-2">
                    {itemExtras.map((extra) => (
                      <div
                        key={extra.extra_id}
                        className="flex justify-between items-center text-sm"
                      >
                        <span className="font-semibold text-gray-800">
                          {extra.name}
                        </span>
                        <span className="font-semibold text-gray-800">
                          + ${extra.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No extras available for this item.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      }
      case "CATEGORY": {
        const nameStyle = props.nameStyle || {};

        // Check if any hover styles exist
        const hasHover = Object.keys(style).some((k) =>
          k.startsWith("--hover-")
        );

        return (
          <motion.div
            className={`cursor-pointer rounded-lg overflow-hidden shadow transition ${
              hasHover ? "has-hover-effect" : ""
            }`}
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
            onClick={() => setActiveCategory(props.id)}
          >
            {props.image_url && (
              <img
                src={`${BACKEND}${props.image_url}`}
                alt={props.name}
                className="w-full h-40 object-cover"
              />
            )}
            <div className="p-4 bg-white">
              <h4 className="font-bold text-lg" style={nameStyle}>
                {props.name}
              </h4>
            </div>
          </motion.div>
        );
      }

      case "ACCORDION":
        return <Accordion items={props.items || []} style={style} />;

      case "FORM":
        return (
          <motion.form
            style={style}
            className="space-y-4"
            initial={initial}
            animate={animate}
            transition={transition}
            onSubmit={(e) => e.preventDefault()}
          >
            <h3 className="font-bold">{props.title}</h3>
            {(props.fields || []).map((f: FormField) => (
              <div key={f.id}>
                <label>{f.label}</label>
                <input
                  placeholder={f.placeholder}
                  className="border p-2 w-full"
                />
              </div>
            ))}
            <button type="submit">{props.submitButton?.text}</button>
          </motion.form>
        );

      case "MAP":
        return <iframe src={props.src} style={style} />;
      case "AI": {
        // 1. Safely get properties
        const props = element.properties || {};

        // 2. Safely get animation config
        const { initial, animate, transition } = getMotionConfig(
          props.animation
        );

        // 3. NEW: Universal Click Logic
        let isClickable = false;
        let clickAction = () => {}; // Default to an empty function

        // Check for our specific actionType system (from converted Categories/Buttons)
        if (props.actionType === "SET_CATEGORY" && props.actionValue) {
          isClickable = true;
          clickAction = () => setActiveCategory(props.actionValue);
        } else if (props.actionType === "PAGE_NAV" && props.actionValue) {
          const targetPage = websiteData.pages.find(
            (p) => p.slug === props.actionValue
          );
          if (targetPage) {
            isClickable = true;
            clickAction = () => {
              setActiveCategory(null);
              setCurrentPage(targetPage);
              router.push(`/${websiteData.subdomain}${targetPage.slug}`);
            };
          }
        }
        // Fallback to check for the generic linkEnabled system (from other AI refinements)
        else if (props.linkEnabled && props.action_value) {
          const targetPage = websiteData.pages.find(
            (p) => p.slug === props.action_value
          );
          if (targetPage) {
            isClickable = true;
            clickAction = () => {
              setActiveCategory(null);
              setCurrentPage(targetPage);
              router.push(`/${websiteData.subdomain}${targetPage.slug}`);
            };
          }
        }

        return (
          <motion.div
            initial={initial}
            animate={animate}
            transition={transition}
            className={`${
              isClickable ? "cursor-pointer" : ""
            } w-full max-w-full`}
            key={element.element_id}
            onClick={clickAction} // Use the determined click action
          >
            <AiElementRunner key={element.aiPayload?.id} element={element} />
          </motion.div>
        );
      }
      default:
        return <div>Unknown element</div>;
    }
  }

  if (!currentPage) return <div className="p-8">Page not found</div>;

  return (
    <div className="bg-white min-h-screen m-0 p-0 w-full overflow-x-hidden">
      <NavBar />
      <MainContent />
    </div>
  );
};

export default PublicCanvas;
