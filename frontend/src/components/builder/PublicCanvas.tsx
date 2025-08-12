// frontend/src/components/builder/PublicCanvas.tsx
"use client";
import { motion } from "framer-motion";
import { getMotionConfig } from "./animate";
import Mustache from "mustache";
import AuthFormElement from "@/components/shared/AuthFormElement";

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
  PublicOptionGroup,
} from "./Properties";
import api from "@/lib/axios";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Element as BuilderElement } from "./Properties";
import { FormRenderer } from "./FormRenderer"; // <-- 2. Import the new component

interface AiElementRunnerProps {
  element: BuilderElement;
}
const AiElementRunner: React.FC<AiElementRunnerProps> = ({ element }) => {
  const { aiPayload } = element;
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!aiPayload || !containerRef.current) return;

    // --- THIS IS THE FIX ---
    // Get the backend URL and create a safe copy of the properties
    const BACKEND_URL = api.defaults.baseURL || "";
    const processedProps = { ...aiPayload.properties };

    // Define common keys that might contain image URLs
    const imageUrlKeys = ["src", "image_url", "backgroundImage"];

    // Loop through the properties and fix any relative image paths
    for (const key in processedProps) {
      if (imageUrlKeys.includes(key)) {
        const value = processedProps[key];
        if (typeof value === "string" && value.startsWith("/")) {
          processedProps[key] = `${BACKEND_URL}${value}`;
        }
      }
    }
    // --- END OF FIX ---

    // 1) Strip out any <script>…</script> from the HTML/CSS
    let htmlOnly = aiPayload.aiTemplate.replace(
      /<script[\s\S]*?<\/script>/g,
      ""
    );

    // 2) (Your Handlebars conversion logic is good, keep it)
    const loopMatches = [...htmlOnly.matchAll(/{{#each\s+([\w$]+)}}/g)];
    loopMatches.forEach(([fullMatch, arrKey]) => {
      htmlOnly = htmlOnly.replace(fullMatch, `{{#${arrKey}}}`);
      htmlOnly = htmlOnly.replace(/{{\/each}}/, `{{/${arrKey}}}`);
    });
    htmlOnly = htmlOnly.replace(/{{\s*this\s*}}/g, "{{.}}");

    // 3) Render the template with the PROCESSED properties
    let rendered: string;
    try {
      rendered = Mustache.render(htmlOnly, processedProps); // Use the fixed props
    } catch (mErr) {
      console.error("Mustache.render failed, falling back to raw HTML:", mErr);
      rendered = htmlOnly;
    }
    containerRef.current.innerHTML = rendered;

    // 4) Execute JS if provided
    if (aiPayload.script) {
      const jsBody = aiPayload.script
        .replace(/^\s*<script[^>]*>/, "")
        .replace(/<\/script>\s*$/, "");
      try {
        const fn = new Function("container", jsBody);
        fn(containerRef.current);
      } catch (jsErr) {
        console.error("Error running AI script:", jsErr);
      }
    }
  }, [
    aiPayload?.aiTemplate,
    aiPayload?.script,
    JSON.stringify(aiPayload?.properties),
  ]);

  return <div ref={containerRef} />;
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
  const [options, setOptions] = useState<Record<string, PublicOptionGroup[]>>(
    {}
  );

  const [isLoadingDetails, setIsLoadingDetails] = useState(false); // A single loading state
  const handleMenuItemClick = async (menuItemId: string) => {
    if (expandedMenuItemId === menuItemId) {
      setExpandedMenuItemId(null);
      return;
    }

    setIsLoadingDetails(true);
    setExpandedMenuItemId(menuItemId);

    try {
      // Use Promise.all to fetch extras and options concurrently
      const [extrasResponse, optionsResponse] = await Promise.all([
        // Only fetch if we don't have the data already
        extras[menuItemId]
          ? Promise.resolve({ data: extras[menuItemId] })
          : api.get<Extra[]>(`/menu-item-extras/extras-for-item/${menuItemId}`),
        options[menuItemId]
          ? Promise.resolve({ data: options[menuItemId] })
          : api.get<PublicOptionGroup[]>(
              `/menu-item-options/options-for-item/${menuItemId}`
            ),
      ]);
      console.log("OPTIONS API RESPONSE:", optionsResponse.data);
      setExtras((prev) => ({ ...prev, [menuItemId]: extrasResponse.data }));
      setOptions((prev) => ({ ...prev, [menuItemId]: optionsResponse.data }));
    } catch (error) {
      console.error("Failed to fetch item details:", error);
    } finally {
      setIsLoadingDetails(false);
    }
  };
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [purchaseStatusCache, setPurchaseStatusCache] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    // Function to check login status
    const checkAuthStatus = () => {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem(
          `siteToken:${websiteData.subdomain}`
        );
        setIsLoggedIn(!!token);
        // You could also decode the token here to get the user's role if needed
        // const decoded = decodeToken(token);
        // setRole(decoded?.role);
      }
    };

    // Check status on initial load
    checkAuthStatus();

    // Listen for storage changes (e.g., login/logout in another tab)
    window.addEventListener("storage", checkAuthStatus);

    // Clean up the listener when the component unmounts
    return () => {
      window.removeEventListener("storage", checkAuthStatus);
    };
  }, [websiteData.subdomain]); // Re-run if the subdomain changes
  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    // You can also add a refresh or redirect here if you want
    // router.refresh();
  };
  const startCheckout = async (productId: string) => {
    // No longer accepts memberId here
    if (!productId) return;

    // 1. Get member_id from the user's session in localStorage
    const subdomain = websiteData.subdomain;
    const memberId =
      typeof window !== "undefined"
        ? localStorage.getItem(`siteMemberId:${subdomain}`)
        : null;

    // 2. Check if the user is logged in
    if (!memberId) {
      alert("Please log in to complete your purchase.");
      return;
    }

    try {
      // 3. Re-add the logic for ngrok/production origin
      const origin =
        process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");

      const base = websiteData?.subdomain ? `/${websiteData.subdomain}` : "";

      const success_url = `${origin}${base}/thank-you`;
      const cancel_url = `${origin}${base}${currentPage?.slug || ""}`;

      const { data } = await api.post(
        `/users-stripe-account/public/websites/${websiteData.website_id}/checkout`,
        // 4. Use the correct key 'member_id' to match your Python backend
        {
          product_id: productId,
          member_id: memberId, // Use the ID from localStorage
          success_url,
          cancel_url,
        }
      );

      const redirect = data?.checkout_url || data?.url;
      if (redirect) {
        window.location.href = redirect;
        return;
      }
      alert("Checkout session created, but no checkout URL was returned.");
    } catch (err) {
      console.error("Failed to start checkout:", err);
      alert("Sorry — couldn’t start checkout. Please try again.");
    }
  };
  const performInteractivity = async (props: any) => {
    // Use destructuring with a default value to safely get the interactivity object.
    const { interactivity: inter = { action: "none" } } = props || {};

    // Use a switch statement for cleaner handling of different actions.
    switch (inter.action) {
      case "link": {
        if (!inter.href) return;

        const targetPage = websiteData.pages.find((p) => p.slug === inter.href);

        if (targetPage) {
          setActiveCategory(null);
          setCurrentPage(targetPage);
          const base = websiteData?.subdomain
            ? `/${websiteData.subdomain}`
            : "";
          router.push(`${base}${targetPage.slug}`);
        }
        break;
      }

      case "purchase": {
        if (!inter.product_id) return;

        await startCheckout(inter.product_id);
        break;
      }

      // The default case handles "none" or any other unknown actions.
      default: {
        return;
      }
    }
  };

  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);
  const GatedContent: React.FC<{
    elementProps: any;
    children: React.ReactNode;
  }> = ({ elementProps, children }) => {
    const [visibility, setVisibility] = useState<
      "loading" | "visible" | "hidden"
    >("loading");

    useEffect(() => {
      const checkVisibility = async () => {
        const v = elementProps?.visibility || {};

        // 1. Standard Authentication Checks (run first)
        if (v.requiresAnonymous && isLoggedIn) {
          setVisibility("hidden");
          return;
        }
        if (v.requiresAuth && !isLoggedIn) {
          setVisibility("hidden");
          return;
        }

        // 2. Product Purchase Check (runs if the above checks pass)
        if (v.required_product_id) {
          // User must be logged in to check for a purchase
          const memberId = localStorage.getItem(
            `siteMemberId:${websiteData.subdomain}`
          );
          if (!isLoggedIn || !memberId) {
            setVisibility("hidden");
            return;
          }

          const cacheKey = `${memberId}_${v.required_product_id}`;

          // Check the cache first to avoid unnecessary API calls
          if (purchaseStatusCache[cacheKey] !== undefined) {
            setVisibility(purchaseStatusCache[cacheKey] ? "visible" : "hidden");
            return;
          }

          // If not in cache, call the backend to verify the purchase
          try {
            const params = new URLSearchParams({
              website_id: websiteData.website_id,
              member_id: memberId,
              product_id: v.required_product_id,
            });

            const { data: has_purchase } = await api.get<boolean>(
              `/users-stripe-account/${
                websiteData.subdomain
              }/has-purchase?${params.toString()}`
            );

            // Update the cache and set visibility
            setPurchaseStatusCache((prev) => ({
              ...prev,
              [cacheKey]: has_purchase,
            }));
            setVisibility(has_purchase ? "visible" : "hidden");
          } catch {
            // If the API call fails, deny access for safety
            setPurchaseStatusCache((prev) => ({ ...prev, [cacheKey]: false }));
            setVisibility("hidden");
          }
        } else {
          // If no purchase is required, the content is visible
          setVisibility("visible");
        }
      };

      checkVisibility();
    }, [JSON.stringify(elementProps), isLoggedIn]); // Re-run this check if the element's rules or the user's login status changes

    // --- Render based on visibility status ---

    if (visibility === "loading") {
      return (
        <div className="p-4 text-center text-gray-400">Loading Content...</div>
      );
    }

    if (visibility === "hidden") {
      const isContainer = elementProps?.padding || elementProps?.display;
      if (isContainer) {
        // Show a "locked" message for larger elements like pages and sections
        return (
          <div className="border-2 border-dashed rounded-lg p-8 m-4 text-center text-gray-500 bg-gray-50">
            <h4 className="font-semibold">Content Locked</h4>
            <p className="text-sm">
              You must purchase a specific product to view this content.
            </p>
          </div>
        );
      }
      // Return nothing for smaller, inline elements
      return null;
    }

    // If all checks pass, render the actual content
    return <>{children}</>;
  };

  const NavBar = () => {
    const subdomain = websiteData.subdomain || "";
    const base = `/${subdomain}`;

    // safe read for CSR
    const isLoggedIn =
      typeof window !== "undefined" &&
      !!localStorage.getItem(`siteToken:${subdomain}`);

    const logout = () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(`siteToken:${subdomain}`);
        window.location.assign(`${base}/login`);
      }
    };

    // Filter/augment items for auth
    const items = websiteData.navbar!.items.filter((ni: NavbarItem) => {
      const url = (ni.link_url || "").toLowerCase();
      if (isLoggedIn && (url === "/login" || url === "/register")) return false; // hide when logged in
      return true;
    });

    // If logged in and there's no explicit logout item, add one
    const hasLogout = items.some(
      (ni: NavbarItem) => (ni.link_url || "").toLowerCase() === "/logout"
    );
    const finalItems: NavbarItem[] =
      isLoggedIn && !hasLogout
        ? [
            ...items,
            {
              item_id: "auto_logout",
              text: "Logout",
              link_url: "/logout",
            } as any,
          ]
        : items;

    return (
      <nav style={websiteData.navbar!.properties}>
        <div className="flex items-center justify-between px-6 py-3 shadow-sm">
          <div className="font-bold text-xl">Your Logo</div>
          <div className="flex space-x-4">
            {finalItems.map((ni: NavbarItem) => {
              const url = (ni.link_url || "").toLowerCase();

              // special action for logout
              if (url === "/logout") {
                return (
                  <button
                    key={ni.item_id}
                    onClick={logout}
                    style={websiteData.navbar!.properties.itemStyle}
                    className="text-sm font-medium hover:underline"
                  >
                    {ni.text || "Logout"}
                  </button>
                );
              }

              // normal page links (use your slug->page lookup + router push)
              const tgt = websiteData.pages.find((p) => p.slug === ni.link_url);
              if (!tgt) return null;

              return (
                <a
                  key={ni.item_id}
                  href={ni.link_url}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveCategory(null);
                    router.push(`${base}${tgt.slug}`);
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
  };

  // const MainContent = () => {
  //   const sub = websiteData?.subdomain || "";
  //   const basePath = sub ? `/${sub}` : "";
  //   // utilities scoped locally (not at file top)
  //   const canShow = (
  //     props: any,
  //     auth: { isLoggedIn: boolean; role?: string }
  //   ) => {
  //     const v = props?.visibility || {};
  //     if (v.requiresAnonymous) return !auth.isLoggedIn;
  //     if (v.requiresAuth && !auth.isLoggedIn) return false;
  //     if (Array.isArray(v.roles) && v.roles.length) {
  //       return auth.isLoggedIn && v.roles.includes(auth.role || "");
  //     }
  //     return true;
  //   };

  //   const RequireLoginNotice = ({
  //     loginHref = `${basePath}/login`,
  //     registerHref = `${basePath}/register`,
  //   }: {
  //     loginHref?: string;
  //     registerHref?: string;
  //   }) => (
  //     <div className="border rounded-lg p-4 my-4 text-sm bg-yellow-50">
  //       <div className="font-medium mb-1">Requires login</div>
  //       <div className="opacity-80">
  //         This content is for members. Please{" "}
  //         <a className="underline" href={loginHref}>
  //           log in
  //         </a>{" "}
  //         or{" "}
  //         <a className="underline" href={registerHref}>
  //           create an account
  //         </a>
  //         .
  //       </div>
  //     </div>
  //   );

  //   // simplest: compute login status inline from localStorage
  //   // const token =
  //   //   typeof window !== "undefined"
  //   //     ? localStorage.getItem(`siteToken:${websiteData.subdomain}`)
  //   //     : null;
  //   // const isLoggedIn = !!token;
  //   // const role: string | undefined = undefined;

  //   if (activeCategory) {
  //     return (
  //       <>
  //         <div className="p-4">
  //           <button
  //             onClick={() => setActiveCategory(null)}
  //             className="text-blue-600 underline mb-4"
  //           >
  //             ← Back to "{currentPage?.title}"
  //           </button>
  //         </div>
  //         <CategoryMenuInCanvas
  //           locations={websiteData.locations}
  //           categoryId={activeCategory}
  //         />
  //       </>
  //     );
  //   }

  //   // Page-level gate (uses page.properties.visibility)
  //   if (!canShow(currentPage?.properties || {}, { isLoggedIn, role })) {
  //     return <RequireLoginNotice />;
  //   }

  //   // Sections
  //   return (
  //     <div className="space-y-0">
  //       {currentPage?.sections.map((sec) => {
  //         // Section-level gate
  //         if (!canShow(sec.properties || {}, { isLoggedIn, role })) {
  //           return <RequireLoginNotice key={sec.section_id} />;
  //         }

  //         const p = sec.properties || {};
  //         const containerStyle: React.CSSProperties = {
  //           backgroundColor: p.backgroundColor,
  //           backgroundImage: p.backgroundImage,
  //           padding: p.padding,
  //           ...(p.style || {}),
  //         };
  //         const layoutStyle: React.CSSProperties = {
  //           display: "flex",
  //           flexDirection: p.flexDirection,
  //           justifyContent: p.justifyContent,
  //           alignItems: p.alignItems,
  //           gap: p.gap,
  //         };
  //         if (
  //           containerStyle.backgroundImage &&
  //           !containerStyle.backgroundImage.includes("gradient")
  //         ) {
  //           containerStyle.backgroundImage = `url(${api.defaults.baseURL}${containerStyle.backgroundImage})`;
  //           containerStyle.backgroundSize = "cover";
  //           containerStyle.backgroundPosition = "center";
  //         }

  //         return (
  //           <div key={sec.section_id} style={containerStyle}>
  //             <div
  //               className="w-full overflow-x-hidden flex flex-wrap"
  //               style={layoutStyle}
  //             >
  //               {sec.subsections.map((sub) => {
  //                 // gate
  //                 if (!canShow(sub.properties || {}, { isLoggedIn, role })) {
  //                   return <RequireLoginNotice key={sub.subsection_id} />;
  //                 }

  //                 const sp = sub.properties || {};
  //                 // Pull out anything that is NOT a CSS style
  //                 const {
  //                   animation,
  //                   style,
  //                   visibility: _vis, // <-- strip auth visibility
  //                   gridColumns, // <-- custom helper, not a CSS prop
  //                   ...layoutProps // <-- only layout-relevant props remain
  //                 } = sp;

  //                 // motion config
  //                 const { initial, animate, transition } =
  //                   getMotionConfig(animation);

  //                 // Build a safe style object for motion.div
  //                 const subsectionStyle: React.CSSProperties = {
  //                   // Allow only valid CSS-ish layout keys you actually use
  //                   display: layoutProps.display || "flex",
  //                   flexDirection: layoutProps.flexDirection,
  //                   justifyContent: layoutProps.justifyContent,
  //                   alignItems: layoutProps.alignItems,
  //                   gap: layoutProps.gap,
  //                   // prefer explicit grid template if provided; otherwise derive from gridColumns
  //                   ...(layoutProps.gridTemplateColumns
  //                     ? { gridTemplateColumns: layoutProps.gridTemplateColumns }
  //                     : gridColumns
  //                     ? { gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }
  //                     : {}),
  //                   // merge custom style last
  //                   ...(style || {}),
  //                 };

  //                 return (
  //                   <motion.div
  //                     className="max-w-full"
  //                     key={sub.subsection_id}
  //                     style={subsectionStyle}
  //                     initial={initial}
  //                     animate={animate}
  //                     transition={transition}
  //                   >
  //                     {sub.elements.map((el) => {
  //                       // element gate
  //                       if (
  //                         !canShow(el.properties || {}, { isLoggedIn, role })
  //                       ) {
  //                         return <RequireLoginNotice key={el.element_id} />;
  //                       }
  //                       try {
  //                         return (
  //                           <div key={el.element_id}>{renderElement(el)}</div>
  //                         );
  //                       } catch (err) {
  //                         console.error("Failed to render element:", el, err);
  //                         return (
  //                           <div
  //                             key={el.element_id}
  //                             className="p-4 bg-red-100 text-red-700 border border-red-400 rounded"
  //                           >
  //                             Error: This element could not be displayed.
  //                           </div>
  //                         );
  //                       }
  //                     })}
  //                   </motion.div>
  //                 );
  //               })}
  //             </div>
  //           </div>
  //         );
  //       })}
  //     </div>
  //   );
  // };

  const MainContent = () => {
    // This component now relies on the `isLoggedIn` and `role` states from the parent `PublicCanvas` component.
    // The old `canShow` and local `isLoggedIn` calculation have been removed.

    if (activeCategory) {
      return (
        <>
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

    // Wrap the entire page's content in GatedContent to check page-level visibility first.
    return (
      <GatedContent elementProps={currentPage?.properties}>
        <div className="space-y-0">
          {currentPage?.sections.map((sec) => {
            // Calculate styles here, as they are needed regardless of visibility for the wrapper
            const p = sec.properties || {};
            const containerStyle: React.CSSProperties = {
              backgroundColor: p.backgroundColor,
              backgroundImage: p.backgroundImage,
              padding: p.padding,
              ...(p.style || {}),
            };
            if (
              containerStyle.backgroundImage &&
              !containerStyle.backgroundImage.includes("gradient")
            ) {
              containerStyle.backgroundImage = `url(${api.defaults.baseURL}${containerStyle.backgroundImage})`;
              containerStyle.backgroundSize = "cover";
              containerStyle.backgroundPosition = "center";
            }

            return (
              <GatedContent key={sec.section_id} elementProps={sec.properties}>
                <div style={containerStyle}>
                  <div
                    className="w-full overflow-x-hidden flex flex-wrap"
                    style={{
                      display: p.display || "flex",
                      flexDirection: p.flexDirection,
                      justifyContent: p.justifyContent,
                      alignItems: p.alignItems,
                      gap: p.gap,
                    }}
                  >
                    {sec.subsections.map((sub) => {
                      const sp = sub.properties || {};
                      const { animation, style, gridColumns, ...layoutProps } =
                        sp;
                      const { initial, animate, transition } =
                        getMotionConfig(animation);
                      const subsectionStyle: React.CSSProperties = {
                        display: layoutProps.display || "flex",
                        flexDirection: layoutProps.flexDirection,
                        justifyContent: layoutProps.justifyContent,
                        alignItems: layoutProps.alignItems,
                        gap: layoutProps.gap,
                        ...(layoutProps.gridTemplateColumns
                          ? {
                              gridTemplateColumns:
                                layoutProps.gridTemplateColumns,
                            }
                          : gridColumns
                          ? {
                              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                            }
                          : {}),
                        ...(style || {}),
                      };

                      return (
                        <GatedContent
                          key={sub.subsection_id}
                          elementProps={sub.properties}
                        >
                          <motion.div
                            className="max-w-full"
                            style={subsectionStyle}
                            initial={initial}
                            animate={animate}
                            transition={transition}
                          >
                            {sub.elements.map((el) => (
                              <GatedContent
                                key={el.element_id}
                                elementProps={el.properties}
                              >
                                {/* The final rendered element goes here */}
                                {renderElement(el)}
                              </GatedContent>
                            ))}
                          </motion.div>
                        </GatedContent>
                      );
                    })}
                  </div>
                </div>
              </GatedContent>
            );
          })}
        </div>
      </GatedContent>
    );
  };

  function renderElement(element: ElementType) {
    const props = element.properties || {};
    const style = props.style || {};
    const { initial, animate, transition } = getMotionConfig(props.animation);
    const BACKEND = api.defaults.baseURL || "";

    // Determine the element's true purpose for functional logic
    const effectiveType = props.originalType || element.element_type;

    // --- RENDER LOGIC USING if/else if ---

    if (effectiveType === "CATEGORY") {
      const nameStyle = props.nameStyle || {};
      const hasHover = Object.keys(style).some((k) => k.startsWith("--hover-"));

      return (
        <motion.div
          className={`cursor-pointer transition ${
            hasHover ? "has-hover-effect" : ""
          }`}
          initial={initial}
          animate={animate}
          transition={transition}
          onClick={() => setActiveCategory(props.id)} // Your specific onClick logic
        >
          {element.element_type === "AI" ? (
            <AiElementRunner element={element} />
          ) : (
            <div className="rounded-lg overflow-hidden shadow">
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
            </div>
          )}
        </motion.div>
      );
    } else if (effectiveType === "MENU_ITEM") {
      const isExpanded = expandedMenuItemId === element.properties.item_id;
      const itemExtras = extras[element.properties.item_id] || [];
      const itemOptions = options[element.properties.item_id] || [];

      return (
        <div onClick={() => handleMenuItemClick(element.properties.item_id)}>
          {element.element_type === "AI" ? (
            <AiElementRunner element={element} />
          ) : (
            <motion.div
              className="border rounded-lg p-4 bg-white shadow cursor-pointer"
              style={style}
              initial={initial}
              animate={animate}
              transition={transition}
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
          )}

          {isExpanded && (
            <div className="border border-t-0 rounded-b-lg p-4 bg-slate-50 dark:bg-slate-800 -mt-2 space-y-4">
              {isLoadingDetails ? (
                <p className="text-sm text-slate-500">Loading details...</p>
              ) : itemExtras.length > 0 || itemOptions.length > 0 ? (
                <>
                  {/* --- Section for Extras --- */}
                  {itemExtras.length > 0 && (
                    <div>
                      <h5 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">
                        Add Extras:
                      </h5>
                      <div className="flow-root">
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                          {itemExtras.map((extra) => (
                            <li
                              key={extra.extra_id}
                              className="py-2 flex justify-between items-center text-sm"
                            >
                              <span className="text-slate-700 dark:text-slate-300">
                                {extra.name}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                + ${extra.price.toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* --- Section for Options --- */}
                  {itemOptions.length > 0 && (
                    <div className="space-y-4">
                      {itemOptions.map((group) => (
                        <div key={group.group_id}>
                          <h5 className="font-semibold text-slate-800 dark:text-slate-200">
                            {group.group_name}
                          </h5>
                          <div className="flow-root mt-2">
                            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                              {group.choices.map((choice) => (
                                <li
                                  key={choice.choice_id}
                                  className="py-2 flex justify-between items-center text-sm"
                                >
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {choice.name}
                                  </span>
                                  {choice.price_adjustment > 0 && (
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      + ${choice.price_adjustment.toFixed(2)}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  No extras or options available for this item.
                </p>
              )}
            </div>
          )}
        </div>
      );
    } else if (element.element_type === "AI") {
      // Fallback for GENERIC AI elements that don't have a special function
      return (
        <div
          onClick={() => performInteractivity(element.properties)}
          className="w-full h-full cursor-pointer" // Ensures the entire area is clickable
        >
          <AiElementRunner
            key={element.aiPayload?.id || element.element_id}
            element={element}
          />
        </div>
      );
    } else if (effectiveType === "TEXT") {
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
    } else if (effectiveType === "IMAGE") {
      return (
        <motion.div
          style={style}
          initial={initial}
          animate={animate}
          transition={transition}
        >
          <img
            src={
              props.src
                ? `${BACKEND}${props.src}`
                : "https://placehold.co/600x400"
            }
            alt={props.alt || "placeholder"}
            style={{ width: "100%", height: "auto" }}
          />
        </motion.div>
      );
    } else if (effectiveType === "BUTTON") {
      const compatibleProps = {
        ...props, // Copy existing props like text, style, etc.
        interactivity: {
          action: props.action_value ? "link" : "none", // If action_value exists, it's a link
          href: props.action_value || "", // Map action_value to href
        },
      };
      return (
        <motion.div
          style={style}
          initial={initial}
          animate={animate}
          transition={transition}
        >
          <button onClick={() => performInteractivity(compatibleProps)}>
            {props.text || "Button"}
          </button>
        </motion.div>
      );
    } else if (effectiveType === "LIST") {
      return (
        <motion.ul
          style={style}
          initial={initial}
          animate={animate}
          transition={transition}
        >
          {(props.items || []).map((item: string, i: number) => (
            <li key={i}>{item}</li>
          ))}
        </motion.ul>
      );
    } else if (effectiveType === "ACCORDION") {
      return (
        <motion.div
          style={style}
          initial={initial}
          animate={animate}
          transition={transition}
        >
          <Accordion items={props.items || []} style={style} />
        </motion.div>
      );
    } else if (effectiveType === "MAP") {
      return (
        <motion.div
          className="relative"
          style={style}
          initial={initial}
          animate={animate}
          transition={transition}
        >
          <div className="absolute inset-0 z-10 cursor-pointer" />
          <iframe
            src={props.src}
            style={{
              width: "100%",
              height: "100%",
              border: "0",
              pointerEvents: "none",
            }}
            allowFullScreen={false}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Google Map"
          />
        </motion.div>
      );
    } else if (effectiveType === "DROPDOWN") {
      return (
        <motion.div
          style={style}
          initial={initial}
          animate={animate}
          transition={transition}
        >
          <select className="border border-gray-300 rounded p-2">
            {props.label && <option disabled>{props.label}</option>}
            {(props.options || []).map((opt: any, i: number) => (
              <option key={i} value={opt.action_value}>
                {opt.text}
              </option>
            ))}
          </select>
        </motion.div>
      );
    } else if (effectiveType === "LOGIN_FORM") {
      return (
        <motion.div
          style={style}
          initial={initial}
          animate={animate}
          transition={transition}
        >
          <AuthFormElement
            kind="login"
            props={props}
            subdomain={websiteData?.subdomain}
            editMode={false} // live submit
            onSuccess={handleLoginSuccess} // ⬅️ ADD THIS LINE
          />
        </motion.div>
      );
    } else if (effectiveType === "REGISTER_FORM") {
      return (
        <motion.div
          style={style}
          initial={initial}
          animate={animate}
          transition={transition}
        >
          <AuthFormElement
            kind="register"
            props={props}
            subdomain={websiteData?.subdomain}
            editMode={false} // live submit
            onSuccess={() => setIsLoggedIn?.(true)}
          />
        </motion.div>
      );
    } else if (effectiveType === "FORM") {
      return <FormRenderer element={element} websiteData={websiteData} />;
    } else {
      // Default fallback for any truly unknown element
      return (
        <div className="border p-2 bg-gray-300 text-black rounded">
          Unknown Element: {effectiveType}
        </div>
      );
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
