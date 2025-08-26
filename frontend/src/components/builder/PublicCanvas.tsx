// frontend/src/components/builder/PublicCanvas.tsx
"use client";
import { motion } from "framer-motion";
import { getMotionConfig } from "./animate";
import Mustache from "mustache";
import AuthFormElement from "@/components/shared/AuthFormElement";
import { resolveImageSrc } from "@/lib/imageUrl";
import { FiMenu, FiX } from "react-icons/fi"; // install react-icons if not already
import saasApi, { API_BASE } from "@/lib/saasApi"; // <-- use the no-cookie client
import { FaWhatsapp } from "react-icons/fa";
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
const normalizeBackground = (bg?: string) => {
  if (!bg) return undefined;
  // if we already have url(...), extract inner and pass through resolver
  if (bg.startsWith("url(")) {
    const inner = bg.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
    return `url(${resolveImageSrc(inner)})`;
  }
  // plain path or absolute url
  return `url(${resolveImageSrc(bg)})`;
};

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
    const imageUrlKeys = ["src", "poster", "image_url", "backgroundImage"];

    // Loop through the properties and fix any relative image paths
    for (const key of imageUrlKeys) {
      if (processedProps[key]) {
        processedProps[key] = resolveImageSrc(processedProps[key]);
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
    containerRef.current
      .querySelectorAll('a[href="#"], a[href=""], a:not([href])')
      .forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

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
    saasApi
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
                // src={`${api.defaults.baseURL}${item.image_url}`}
                src={resolveImageSrc(item.image_url)}
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
    if (!productId) return;

    // member must be logged in
    const subdomain = websiteData.subdomain;
    const memberId =
      typeof window !== "undefined"
        ? localStorage.getItem(`siteMemberId:${subdomain}`)
        : null;

    if (!memberId) {
      alert("Please log in to complete your purchase.");
      return;
    }

    try {
      // Figure out what the user's browser origin should come back to
      const win = typeof window !== "undefined" ? window : null;
      const isMainHost =
        !!win &&
        (win.location.hostname === "zygoflow.com" ||
          win.location.hostname === "www.zygoflow.com");

      // On custom domains → /thank-you (same origin).
      // On zygoflow.com preview → /{subdomain}/thank-you
      const basePath = isMainHost ? `/${subdomain}` : "";
      const siteOrigin = win ? win.location.origin : ""; // https://www.whitemessagecenter.com OR https://zygoflow.com

      const success_url = `${siteOrigin}${basePath}/thank-you`;
      const cancel_url = `${siteOrigin}${basePath}${currentPage?.slug || ""}`;

      // Call your API (no cookies needed)
      const { data } = await saasApi.post(
        `/users-stripe-account/public/websites/${websiteData.website_id}/checkout`,
        {
          product_id: productId,
          member_id: memberId,
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
    const { interactivity: inter = { action: "none" } } = props || {};

    switch (inter.action) {
      case "link": {
        if (!inter.href) return;

        // Same host rule as NavBar
        const isMainHost =
          typeof window !== "undefined" &&
          (window.location.hostname === "zygoflow.com" ||
            window.location.hostname === "www.zygoflow.com");

        const base = isMainHost ? `/${websiteData.subdomain}` : "";

        // normalize internal path
        const raw = String(inter.href).trim();
        const normalized = /^https?:\/\//i.test(raw)
          ? raw
          : raw
          ? raw.startsWith("/")
            ? raw
            : `/${raw}`
          : "/";

        // internal?
        const isExternal = /^https?:\/\//i.test(normalized);
        if (isExternal) {
          window.location.href = normalized;
          return;
        }

        const targetPage = websiteData.pages.find((p) => p.slug === normalized);
        if (!targetPage) {
          // fall back to push anyway
          router.push(`${base}${normalized}`);
          return;
        }

        setActiveCategory(null);
        setCurrentPage(targetPage);
        router.push(`${base}${targetPage.slug}`);
        break;
      }

      case "purchase": {
        if (!inter.product_id) return;
        await startCheckout(inter.product_id);
        break;
      }

      default:
        return;
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
    const [hiddenReason, setHiddenReason] = useState<
      "auth" | "purchase" | null
    >(null);

    // lightweight per-component cache: { `${memberId}_${productId}`: boolean }
    const purchaseCacheRef = useRef<Record<string, boolean>>({});

    useEffect(() => {
      const checkVisibility = async () => {
        const v = elementProps?.visibility || {};

        // 1) anonymous-only
        if (v.requiresAnonymous && isLoggedIn) {
          setHiddenReason("auth");
          setVisibility("hidden");
          return;
        }

        // 2) requires auth
        if (v.requiresAuth && !isLoggedIn) {
          setHiddenReason("auth");
          setVisibility("hidden");
          return;
        }

        // 3) requires purchase (only runs if a product is specified)
        if (v.required_product_id) {
          // must be logged in and have a member id
          const memberId = localStorage.getItem(
            `siteMemberId:${websiteData?.subdomain}`
          );
          if (!isLoggedIn || !memberId || !websiteData) {
            setHiddenReason("auth");
            setVisibility("hidden");
            return;
          }

          const cacheKey = `${memberId}_${v.required_product_id}`;
          const cached = purchaseCacheRef.current[cacheKey];
          if (typeof cached !== "undefined") {
            setHiddenReason(cached ? null : "purchase");
            setVisibility(cached ? "visible" : "hidden");
            return;
          }

          try {
            const params = new URLSearchParams({
              website_id: String(websiteData.website_id),
              member_id: memberId,
              product_id: String(v.required_product_id),
            });

            const { data: hasPurchase } = await saasApi.get<boolean>(
              `/users-stripe-account/${
                websiteData.subdomain
              }/has-purchase?${params.toString()}`
            );

            purchaseCacheRef.current[cacheKey] = !!hasPurchase;
            setHiddenReason(hasPurchase ? null : "purchase");
            setVisibility(hasPurchase ? "visible" : "hidden");
            return;
          } catch {
            // on failure, be safe and deny
            purchaseCacheRef.current[cacheKey] = false;
            setHiddenReason("purchase");
            setVisibility("hidden");
            return;
          }
        }

        // 4) no special rule -> visible
        setHiddenReason(null);
        setVisibility("visible");
      };

      // re-check when rules or login state change
      checkVisibility();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      JSON.stringify(elementProps?.visibility || {}),
      isLoggedIn,
      websiteData?.subdomain,
      websiteData?.website_id,
    ]);

    if (visibility === "loading") {
      return (
        <div className="p-4 text-center text-gray-400">Loading Content...</div>
      );
    }

    if (visibility === "hidden") {
      // consider something a "container" (page/section) if it has layout-ish props
      const isContainer =
        elementProps?.padding || elementProps?.display || elementProps?.style;
      if (isContainer) {
        return (
          <div className="border-2 border-dashed rounded-lg p-8 m-4 text-center text-gray-500 bg-gray-50">
            <h4 className="font-semibold">Content Locked</h4>
            <p className="text-sm mt-1">
              {hiddenReason === "auth"
                ? "You must log in to view this content."
                : "You must purchase a specific product to view this content."}
            </p>
          </div>
        );
      }
      // for small inline elements, render nothing
      return null;
    }

    // visible
    return <>{children}</>;
  };

  // const NavBar = () => {
  //   const subdomain = websiteData.subdomain || "";
  //   const base = `/${subdomain}`;

  //   // safe read for CSR
  //   const isLoggedIn =
  //     typeof window !== "undefined" &&
  //     !!localStorage.getItem(`siteToken:${subdomain}`);

  //   const logout = () => {
  //     if (typeof window !== "undefined") {
  //       localStorage.removeItem(`siteToken:${subdomain}`);
  //       window.location.assign(`${base}/login`);
  //     }
  //   };

  //   // Filter/augment items for auth
  //   const items = websiteData.navbar!.items.filter((ni: NavbarItem) => {
  //     const url = (ni.link_url || "").toLowerCase();
  //     if (isLoggedIn && (url === "/login" || url === "/register")) return false; // hide when logged in
  //     return true;
  //   });

  //   // If logged in and there's no explicit logout item, add one
  //   const hasLogout = items.some(
  //     (ni: NavbarItem) => (ni.link_url || "").toLowerCase() === "/logout"
  //   );
  //   const finalItems: NavbarItem[] =
  //     isLoggedIn && !hasLogout
  //       ? [
  //           ...items,
  //           {
  //             item_id: "auto_logout",
  //             text: "Logout",
  //             link_url: "/logout",
  //           } as any,
  //         ]
  //       : items;

  //   return (
  //     <nav style={websiteData.navbar!.properties}>
  //       <div className="flex items-center justify-between px-6 py-3 shadow-sm">
  //         <div className="font-bold text-xl">Your Logo</div>
  //         <div className="flex space-x-4">
  //           {finalItems.map((ni: NavbarItem) => {
  //             const url = (ni.link_url || "").toLowerCase();

  //             // special action for logout
  //             if (url === "/logout") {
  //               return (
  //                 <button
  //                   key={ni.item_id}
  //                   onClick={logout}
  //                   style={websiteData.navbar!.properties.itemStyle}
  //                   className="text-sm font-medium hover:underline"
  //                 >
  //                   {ni.text || "Logout"}
  //                 </button>
  //               );
  //             }

  //             // normal page links (use your slug->page lookup + router push)
  //             const tgt = websiteData.pages.find((p) => p.slug === ni.link_url);
  //             if (!tgt) return null;

  //             return (
  //               <a
  //                 key={ni.item_id}
  //                 href={ni.link_url}
  //                 onClick={(e) => {
  //                   e.preventDefault();
  //                   setActiveCategory(null);
  //                   router.push(`${base}${tgt.slug}`);
  //                 }}
  //                 style={websiteData.navbar!.properties.itemStyle}
  //                 className="text-sm font-medium hover:underline"
  //               >
  //                 {ni.text}
  //               </a>
  //             );
  //           })}
  //         </div>
  //       </div>
  //     </nav>
  //   );
  // };
  // keep units predictable for offsets
  const NavBar = () => {
    // Are we on the platform host? If yes, prefix routes with /{subdomain}
    const isMainHost =
      typeof window !== "undefined" &&
      (window.location.hostname === "zygoflow.com" ||
        window.location.hostname === "www.zygoflow.com");

    const subdomain = websiteData.subdomain || "";
    const base = isMainHost ? `/${subdomain}` : "";

    const [menuOpen, setMenuOpen] = useState(false);

    const isLoggedIn =
      typeof window !== "undefined" &&
      !!localStorage.getItem(`siteToken:${subdomain}`);

    const logout = () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(`siteToken:${subdomain}`);
        window.location.assign(`${base}/login`);
      }
    };

    // Hide login/register when logged in
    const items = (websiteData.navbar?.items ?? []).filter((ni: NavbarItem) => {
      const url = (ni.link_url || "").trim().toLowerCase();
      if (
        isLoggedIn &&
        (url === "/login" ||
          url === "login" ||
          url === "/register" ||
          url === "register")
      ) {
        return false;
      }
      return true;
    });

    const hasLogout = items.some(
      (ni: NavbarItem) => (ni.link_url || "").trim().toLowerCase() === "/logout"
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

    // ---- helpers -------------------------------------------------------------

    // Normalize internal paths:
    // - empty or "#" -> "/"
    // - ensure leading "/"
    // - keep full http(s) links as-is (external)
    const normalizePath = (raw = "") => {
      const u = raw.trim();
      if (!u || u === "#") return "/";
      if (/^https?:\/\//i.test(u)) return u;
      return u.startsWith("/") ? u : `/${u}`;
    };

    // Render a single nav item (used by desktop + mobile)
    const renderNavItem = (ni: NavbarItem) => {
      const raw = (ni.link_url || "").trim();
      const lower = raw.toLowerCase();

      // Special case: Logout button
      if (lower === "/logout") {
        return (
          <button
            key={ni.item_id}
            onClick={logout}
            style={websiteData.navbar?.properties?.itemStyle}
            className="text-sm font-medium hover:underline"
          >
            {ni.text || "Logout"}
          </button>
        );
      }

      const normalized = normalizePath(raw);
      const isExternal = /^https?:\/\//i.test(normalized);

      // Build href for <a> (external stays as-is, internal gets base prefix)
      const href = isExternal ? normalized : `${base}${normalized}`;

      const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
        // Always close the mobile menu
        setMenuOpen(false);

        if (isExternal) return; // let browser handle external navigation

        // Internal navigation: prevent default and use router
        e.preventDefault();
        setActiveCategory(null);
        router.push(href);
      };

      return (
        <a
          key={ni.item_id}
          href={href}
          onClick={handleClick}
          style={websiteData.navbar?.properties?.itemStyle}
          className="text-sm font-medium hover:underline"
        >
          {ni.text}
        </a>
      );
    };

    // -------------------------------------------------------------------------

    return (
      <nav
        ref={navRef}
        style={websiteData.navbar?.properties}
        className="shadow-sm"
      >
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          {/* Hamburger (mobile) */}
          <button
            className="md:hidden text-2xl"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>

          {/* Logo */}
          <div className="font-bold text-xl">Your Logo</div>

          {/* Desktop nav */}
          <div className="hidden md:flex space-x-4">
            {finalItems.map(renderNavItem)}
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden px-4 pb-4 space-y-2 border-t">
            {finalItems.map(renderNavItem)}
          </div>
        )}
      </nav>
    );
  };

  const navRef = React.useRef<HTMLElement | null>(null);
  const lastSectionRef = React.useRef<HTMLDivElement | null>(null);

  // Make the last section fill the leftover viewport height on mobile when content is short
  useLayoutEffect(() => {
    const applyFill = () => {
      if (!lastSectionRef.current) return;

      // reset first
      lastSectionRef.current.style.minHeight = "";

      const viewportH =
        (window as any).visualViewport?.height || window.innerHeight;

      const docH = document.documentElement.scrollHeight;
      if (docH >= viewportH) return; // content already taller than viewport

      const navH = navRef.current?.offsetHeight || 0;
      const rect = lastSectionRef.current.getBoundingClientRect();

      // Distance from top of viewport to top of last section (including page scroll)
      const topFromViewport = rect.top;

      // How much we still need to reach bottom
      const needed = viewportH - topFromViewport;

      if (needed > 0) {
        lastSectionRef.current.style.minHeight = `${needed}px`;
      }
    };

    applyFill();
    window.addEventListener("resize", applyFill);
    window.addEventListener("orientationchange", applyFill);
    return () => {
      window.removeEventListener("resize", applyFill);
      window.removeEventListener("orientationchange", applyFill);
    };
  }, [currentPage?.slug, currentPage?.sections?.length]);

  const withUnit = (v: any) => (typeof v === "number" ? `${v}px` : v);

  const buildSubsectionStyle = (subProps: any): React.CSSProperties => {
    const base: React.CSSProperties =
      subProps.display === "grid"
        ? {
            display: "grid",
            gap: subProps.gap ?? "1rem",
            gridTemplateColumns:
              subProps.gridTemplateColumns ??
              `repeat(${subProps.gridColumns ?? 2}, 1fr)`,
          }
        : {
            display: "flex",
            gap: subProps.gap ?? "1rem",
            flexDirection: subProps.flexDirection ?? "column",
            justifyContent: subProps.justifyContent ?? "flex-start",
            alignItems: subProps.alignItems ?? "stretch",
          };

    const user: React.CSSProperties = { ...(subProps.style || {}) };

    // normalize offsets if provided
    if (user.top !== undefined) user.top = withUnit(user.top);
    if (user.left !== undefined) user.left = withUnit(user.left);
    if (user.right !== undefined) user.right = withUnit(user.right);
    if (user.bottom !== undefined) user.bottom = withUnit(user.bottom);

    const merged = { ...base, ...user };

    // avoid clipping relative offsets
    if (merged.overflow === undefined) merged.overflow = "visible";

    return merged;
  };
  const openWhatsApp = (phone: string, msg?: string) => {
    if (!phone) return;
    const digits = String(phone).replace(/[^\d]/g, "");
    if (!digits) return;
    const url = `https://wa.me/${digits}${
      msg ? `?text=${encodeURIComponent(msg)}` : ""
    }`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

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
        <div className="space-y-0 flex-1 flex flex-col">
          {currentPage?.sections.map((sec, idx) => {
            const isLast = idx === currentPage.sections.length - 1;
            // Calculate styles here, as they are needed regardless of visibility for the wrapper
            const p = sec.properties || {};
            const styleProps = p.style || {};

            // pick bg from either place
            const rawBg = p.backgroundImage ?? styleProps.backgroundImage;
            let backgroundImage: string | undefined;
            if (typeof rawBg === "string" && rawBg.trim()) {
              backgroundImage = rawBg.startsWith("linear-gradient")
                ? rawBg
                : normalizeBackground(rawBg); // <- uses your resolveImageSrc under the hood
            }
            const containerStyle: React.CSSProperties = {
              backgroundColor: p.backgroundColor ?? styleProps.backgroundColor,
              padding: p.padding ?? styleProps.padding,
              ...(styleProps || {}),
              ...(backgroundImage ? { backgroundImage } : {}),
              ...(backgroundImage && backgroundImage.startsWith("url(")
                ? { backgroundSize: "cover", backgroundPosition: "center" }
                : {}),
              ...(isLast ? { marginBottom: 0, paddingBottom: 0 } : {}),
            };
            if (isLast) {
              if (
                (containerStyle as any).minHeight &&
                String((containerStyle as any).minHeight).includes("vh")
              ) {
                (containerStyle as any).minHeight = "auto";
              }
              if (
                (containerStyle as any).height &&
                String((containerStyle as any).height).includes("vh")
              ) {
                (containerStyle as any).height = "auto";
              }
            }
            if (
              containerStyle.backgroundImage &&
              !String(containerStyle.backgroundImage).includes("gradient")
            ) {
              containerStyle.backgroundImage = resolveImageSrc(
                containerStyle.backgroundImage
              );
              containerStyle.backgroundSize = "cover";
              containerStyle.backgroundPosition = "center";
            }

            return (
              <GatedContent key={sec.section_id} elementProps={sec.properties}>
                <div
                  ref={isLast ? lastSectionRef : undefined} // ⬅️ add this
                  style={{
                    ...containerStyle,
                    ...(isLast ? { flexGrow: 1 } : {}), // <-- make the last section fill the rest
                  }}
                  className={isLast ? "last-section" : undefined}
                >
                  <div
                    className="w-full flex flex-wrap"
                    style={{
                      display: p.display || "flex",
                      flexDirection: p.flexDirection,
                      justifyContent: p.justifyContent,
                      alignItems: p.alignItems,
                      gap: p.gap,
                      // extra safety for last wrapper:
                      ...(isLast ? { marginBottom: 0, paddingBottom: 0 } : {}),
                    }}
                  >
                    {sec.subsections.map((sub) => {
                      const subProps = sub.properties || {};
                      const { initial, animate, transition } = getMotionConfig(
                        subProps.animation
                      );
                      const subsectionStyle = {
                        ...buildSubsectionStyle(subProps),
                        ...(isLast
                          ? { marginBottom: 0, paddingBottom: 0 }
                          : {}),
                      };
                      // ⬇️ NEW: also neutralize vh on LAST subsection (common on mobile)
                      if (isLast) {
                        if (
                          (subsectionStyle as any).minHeight &&
                          String((subsectionStyle as any).minHeight).includes(
                            "vh"
                          )
                        ) {
                          (subsectionStyle as any).minHeight = "auto";
                        }
                        if (
                          (subsectionStyle as any).height &&
                          String((subsectionStyle as any).height).includes("vh")
                        ) {
                          (subsectionStyle as any).height = "auto";
                        }
                      }

                      return (
                        <GatedContent
                          key={sub.subsection_id}
                          elementProps={sub.properties}
                        >
                          <motion.div
                            // className="max-w-full"
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
                  src={resolveImageSrc(props.image_url)}
                  alt={props.name}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-4 bg-white">
                <h4 className="font-bold text-lg text-black" style={nameStyle}>
                  {props.name}
                </h4>
              </div>
            </div>
          )}
        </motion.div>
      );
    } else if (effectiveType === "VIDEO") {
      const cardStyle = props.style || {};
      const titleStyle = props.titleStyle || {};
      const metaStyle = props.metaStyle || {};
      const vidStyle = props.videoStyle || {};

      const src = props.src ? resolveImageSrc(props.src) : "";
      const poster = props.poster ? resolveImageSrc(props.poster) : undefined;

      return (
        <div
          className="bg-white border rounded-xl shadow p-4 space-y-2"
          style={cardStyle}
        >
          <div className="flex items-baseline justify-between">
            <h4 style={titleStyle}>{props.title || "Video title"}</h4>
            <span style={metaStyle}>{props.length || ""}</span>
          </div>

          <video
            src={src}
            poster={poster}
            controls={Boolean(props.controls)}
            style={vidStyle}
          />
        </div>
      );
    } else if (effectiveType === "MENU_ITEM") {
      const isExpanded = expandedMenuItemId === element.properties.item_id;
      const itemExtras = extras[element.properties.item_id] || [];
      const itemOptions = options[element.properties.item_id] || [];

      return (
        <div
          onClick={(e) => {
            e.preventDefault(); // ← stop "#"/empty anchors from scrolling to top
            e.stopPropagation();
            handleMenuItemClick(element.properties.item_id);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleMenuItemClick(element.properties.item_id);
            }
          }}
        >
          {element.element_type === "AI" ? (
            // Wrap AI output so we can position the chat icon correctly
            <div className="relative">
              <AiElementRunner element={element} />
              {props.chatEnabled && props.whatsappNumber && (
                <button
                  type="button"
                  aria-label="Chat on WhatsApp"
                  title="Chat on WhatsApp"
                  className="absolute bottom-3 right-3 rounded-full p-2 bg-green-500 text-white shadow hover:opacity-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWhatsApp(
                      props.whatsappNumber,
                      props.chatMessage ||
                        `Hi! I'm interested in ${props.item_name}`
                    );
                  }}
                >
                  <FaWhatsapp size={20} />
                </button>
              )}
            </div>
          ) : (
            <motion.div
              className="relative border rounded-lg p-4 bg-white shadow cursor-pointer"
              style={style}
              initial={initial}
              animate={animate}
              transition={transition}
            >
              {props.image_url && (
                <img
                  src={resolveImageSrc(props.image_url)}
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

              {/* WhatsApp chat icon (only when enabled and number provided) */}
              {/* WhatsApp chat icon — TOP RIGHT + BIGGER */}
              {props.chatEnabled && props.whatsappNumber && (
                <button
                  type="button"
                  aria-label="Chat on WhatsApp"
                  title="Chat on WhatsApp"
                  className="absolute top-3 right-3 z-10 w-12 h-12 rounded-full flex items-center justify-center bg-[#25D366] text-white shadow-lg hover:scale-105 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWhatsApp(
                      props.whatsappNumber,
                      props.chatMessage ||
                        `Hi! I'm interested in ${props.item_name}`
                    );
                  }}
                >
                  <FaWhatsapp size={28} />
                </button>
              )}
            </motion.div>
          )}

          {isExpanded && (
            <div className="border border-t-0 rounded-b-lg p-4 bg-slate-50 dark:bg-slate-800 space-y-4">
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
      const showWA = !!props.chatEnabled && !!props.whatsappNumber;

      return (
        <div
          onClick={() => performInteractivity(element.properties)}
          className="relative w-full h-full cursor-pointer"
        >
          <AiElementRunner
            key={element.aiPayload?.id || element.element_id}
            element={element}
          />

          {showWA && (
            <button
              type="button"
              aria-label="Chat on WhatsApp"
              title="Chat on WhatsApp"
              className="absolute top-3 right-3 z-10 w-12 h-12 rounded-full flex items-center justify-center bg-[#25D366] text-white shadow-lg hover:scale-105 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                openWhatsApp(
                  props.whatsappNumber,
                  props.chatMessage ||
                    `Hi! I'm interested in ${props.item_name || "this item"}`
                );
              }}
            >
              <FaWhatsapp size={28} />
            </button>
          )}
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
                ? resolveImageSrc(props.src)
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
          {/* no overlay in public view */}
          <iframe
            src={props.src}
            style={{
              width: "100%",
              height: "100%",
              border: "0",
              pointerEvents: "auto", // allow interaction
            }}
            allowFullScreen
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
    <div className="bg-white m-0 p-0 w-full overflow-x-hidden flex flex-col min-h-[100svh]">
      <NavBar />
      <MainContent />
    </div>
  );
};

export default PublicCanvas;
