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
import { loadStripe, Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

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
import { useCart, CartItem } from "@/context/CartContext";

const CheckoutForm = ({ websiteId }: { websiteId: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { cartTotal } = useCart();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setIsLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/thank-you` },
    });
    if (error) setErrorMessage(error.message || "An error occurred.");
    setIsLoading(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-white p-6 rounded-lg shadow-md"
    >
      <h3 className="text-lg font-semibold">Contact & Shipping</h3>
      <div className="grid grid-cols-1 gap-y-4">
        <input
          type="text"
          name="name"
          placeholder="Full Name"
          required
          className="p-3 border rounded-md w-full"
        />
        <input
          type="email"
          name="email"
          placeholder="Email Address"
          required
          className="p-3 border rounded-md w-full"
        />
        <input
          type="text"
          name="address"
          placeholder="Shipping Address"
          required
          className="p-3 border rounded-md w-full"
        />
        <input
          name="phone"
          type="tel"
          placeholder="Phone Number (Optional)"
          className="p-3 border rounded-md w-full"
        />
      </div>
      <h3 className="text-lg font-semibold pt-4">Payment Details</h3>
      <div className="p-4 border rounded-md bg-gray-50">
        <PaymentElement />
      </div>
      <button
        disabled={isLoading || !stripe || !elements}
        className="w-full bg-indigo-600 text-white font-semibold py-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
      >
        <span>
          {isLoading ? "Processing..." : `Pay $${cartTotal.toFixed(2)}`}
        </span>
      </button>
      {errorMessage && (
        <div className="text-red-500 text-center">{errorMessage}</div>
      )}
    </form>
  );
};
const EditableCartItem = ({
  item,
  onCancel,
  onSave,
}: {
  item: CartItem;
  onCancel: () => void;
  onSave: (cartItemId: string, updates: Partial<CartItem>) => void;
}) => {
  // State to hold all available options/extras for this product
  const [allExtras, setAllExtras] = useState<Extra[]>([]);
  const [allOptions, setAllOptions] = useState<PublicOptionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [basePrice, setBasePrice] = useState(0);

  // State for the temporary edits, initialized from the item prop
  const [editedQuantity, setEditedQuantity] = useState(item.quantity);
  const [editedExtras, setEditedExtras] = useState(
    new Set(item.selectedExtras.map((e) => e.extra_id))
  );
  const [editedOptions, setEditedOptions] = useState<Record<string, string>>(
    {}
  );

  // ✅ FIX: This state now correctly holds the price for a SINGLE item.
  const [editedUnitPrice, setEditedUnitPrice] = useState(0);

  // Fetch all possible options and extras for this menu item
  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const [itemRes, extrasRes, optionsRes] = await Promise.all([
          api.get(`/menu-items/${item.itemId}`),
          api.get<Extra[]>(`/menu-item-extras/extras-for-item/${item.itemId}`),
          api.get<PublicOptionGroup[]>(
            `/menu-item-options/options-for-item/${item.itemId}`
          ),
        ]);

        setBasePrice(Number(itemRes.data.base_price));
        setAllExtras(extrasRes.data);
        setAllOptions(optionsRes.data);

        const initialOptions: Record<string, string> = {};
        optionsRes.data.forEach((group) => {
          const selectedChoiceName = item.selectedOptions[group.group_name];
          if (selectedChoiceName) {
            const choice = group.choices.find(
              (c) => c.name === selectedChoiceName
            );
            if (choice) {
              initialOptions[group.group_id] = choice.choice_id;
            }
          }
        });
        setEditedOptions(initialOptions);
      } catch (error) {
        console.error("Failed to fetch item details for editing", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [item.itemId, item.selectedOptions]);

  // Recalculate price whenever edits are made
  useEffect(() => {
    if (isLoading) return;
    let currentTotal = basePrice;

    editedExtras.forEach((extraId) => {
      const extra = allExtras.find((e) => e.extra_id === extraId);
      if (extra) currentTotal += Number(extra.price);
    });

    Object.values(editedOptions).forEach((choiceId) => {
      for (const group of allOptions) {
        const choice = group.choices.find((c) => c.choice_id === choiceId);
        if (choice) {
          currentTotal += Number(choice.price_adjustment);
          break;
        }
      }
    });

    setEditedUnitPrice(currentTotal);
  }, [
    editedExtras,
    editedOptions,
    basePrice,
    allExtras,
    allOptions,
    isLoading,
  ]);

  const handleSaveChanges = () => {
    const newSelectedExtras = allExtras.filter((e) =>
      editedExtras.has(e.extra_id)
    );
    const newSelectedOptions: Record<string, string> = {};
    allOptions.forEach((group) => {
      const choiceId = editedOptions[group.group_id];
      if (choiceId) {
        const choice = group.choices.find((c) => c.choice_id === choiceId);
        if (choice) newSelectedOptions[group.group_name] = choice.name;
      }
    });

    const updates: Partial<CartItem> = {
      quantity: editedQuantity,
      unitPrice: editedUnitPrice,
      selectedExtras: newSelectedExtras,
      selectedOptions: newSelectedOptions,
    };
    onSave(item.cartItemId, updates);
  };

  const handleExtraToggle = (extraId: string) =>
    setEditedExtras((prev) => {
      const newSet = new Set(prev);
      newSet.has(extraId) ? newSet.delete(extraId) : newSet.add(extraId);
      return newSet;
    });

  const handleOptionChange = (groupId: string, choiceId: string) =>
    setEditedOptions((prev) => ({ ...prev, [groupId]: choiceId }));

  if (isLoading)
    return <div className="p-4 text-center">Loading Editor...</div>;

  return (
    <div className="p-4 border-2 border-indigo-400 rounded-lg bg-indigo-50 space-y-4">
      <h3 className="font-bold text-lg">Editing: {item.name}</h3>

      {allExtras.length > 0 && (
        <div className="border-t pt-4">
          <h5 className="font-semibold mb-2 text-slate-800">Extras:</h5>
          <div className="space-y-2">
            {allExtras.map((extra) => (
              <label
                key={extra.extra_id}
                className="flex justify-between items-center cursor-pointer text-sm"
              >
                <span>{extra.name}</span>
                <div className="flex items-center space-x-3">
                  <span>+ ${Number(extra.price).toFixed(2)}</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    onChange={() => handleExtraToggle(extra.extra_id)}
                    checked={editedExtras.has(extra.extra_id)}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {allOptions.length > 0 && (
        <div className="space-y-4 border-t pt-4">
          {allOptions.map((group) => (
            <div key={group.group_id}>
              <h5 className="font-semibold text-slate-800">
                {group.group_name}
              </h5>
              <div className="mt-2 space-y-2">
                {group.choices.map((choice) => (
                  <label
                    key={choice.choice_id}
                    className="flex justify-between items-center cursor-pointer text-sm"
                  >
                    <span>{choice.name}</span>
                    <div className="flex items-center space-x-3">
                      {Number(choice.price_adjustment) > 0 && (
                        <span>
                          + ${Number(choice.price_adjustment).toFixed(2)}
                        </span>
                      )}
                      <input
                        type="radio"
                        name={`${item.cartItemId}-${group.group_id}`}
                        className="h-5 w-5 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        onChange={() =>
                          handleOptionChange(group.group_id, choice.choice_id)
                        }
                        checked={
                          editedOptions[group.group_id] === choice.choice_id
                        }
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <span className="font-semibold">Quantity:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditedQuantity((q) => Math.max(1, q - 1))}
            className="w-8 h-8 rounded-full bg-gray-200 font-bold"
          >
            -
          </button>
          <span className="font-bold w-8 text-center">{editedQuantity}</span>
          <button
            onClick={() => setEditedQuantity((q) => q + 1)}
            className="w-8 h-8 rounded-full bg-gray-200 font-bold"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-md font-bold">New Price per Item:</span>
        <span className="text-lg font-bold text-indigo-600">
          ${editedUnitPrice.toFixed(2)}
        </span>
      </div>
      <div className="flex gap-2 pt-4 border-t">
        <button
          onClick={handleSaveChanges}
          className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg"
        >
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-300 px-4 py-2 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const CartView = ({
  websiteData,
  setCurrentView,
}: {
  websiteData: PublicWebsiteData;
  setCurrentView: (view: string) => void;
}) => {
  const { cart, cartTotal, removeFromCart, updateCartItem } = useCart(); // ✅ Get the new updateCartItem function
  const [clientSecret, setClientSecret] = useState("");
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null); // ✅ State to track which item is being edited

  useEffect(() => {
    // This fetches the website-specific Stripe key
    saasApi
      .get(`/users-stripe-account/public/stripe-key/${websiteData.website_id}`)
      .then((res) => {
        if (res.data.publishableKey) {
          setStripePromise(loadStripe(res.data.publishableKey));
        }
      })
      .catch((err) => console.error("Could not load Stripe key.", err));
  }, [websiteData.website_id]);

  useEffect(() => {
    // This creates the payment intent when the cart changes
    if (cart.length > 0 && websiteData) {
      saasApi
        .post("/checkout/create-payment-intent", {
          cart,
          website_id: websiteData.website_id,
        })
        .then((res) => setClientSecret(res.data.clientSecret))
        .catch((err) => console.error("Failed to create payment intent", err));
    }
  }, [cart, cartTotal, websiteData]);

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: { theme: "stripe" },
  };

  if (cart.length === 0) {
    return (
      <div className="container mx-auto text-center py-20">
        <h1 className="text-3xl font-bold">Your Cart is Empty</h1>
        <button
          onClick={() => setCurrentView("page")}
          className="text-indigo-600 hover:underline mt-4 inline-block"
        >
          ← Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <button
        onClick={() => setCurrentView("page")}
        className="text-indigo-600 hover:underline mb-8 inline-block"
      >
        ← Back to Shop
      </button>
      <h1 className="text-3xl font-bold mb-8">Your Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <div
              key={item.cartItemId}
              className="border p-4 rounded-lg shadow-sm bg-white"
            >
              {/* ✅ CONDITIONAL RENDERING: Show editor or static view */}
              {editingItemId === item.cartItemId ? (
                <EditableCartItem
                  item={item}
                  onCancel={() => setEditingItemId(null)}
                  onSave={(cartItemId, updates) => {
                    updateCartItem(cartItemId, updates);
                    setEditingItemId(null);
                  }}
                />
              ) : (
                <div className="flex items-center">
                  <img
                    src={item.imageUrl || "https://placehold.co/100x100"}
                    alt={item.name}
                    className="w-24 h-24 object-cover rounded-md"
                  />
                  <div className="ml-4 flex-grow">
                    <h2 className="font-semibold text-lg">{item.name}</h2>
                    <div className="text-sm text-gray-600">
                      {Object.entries(item.selectedOptions).map(
                        ([group, choice]) => (
                          <p key={group}>
                            <strong>{group}:</strong> {choice}
                          </p>
                        )
                      )}
                      {item.selectedExtras.length > 0 && (
                        <p>
                          <strong>Extras:</strong>{" "}
                          {item.selectedExtras.map((e) => e.name).join(", ")}
                        </p>
                      )}
                      <p>
                        <strong>Quantity:</strong> {item.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg">
                      ${(item.unitPrice * item.quantity).toFixed(2)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.cartItemId)}
                      className="text-red-500 text-sm hover:underline"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setEditingItemId(item.cartItemId)}
                      className="text-indigo-600 text-sm hover:underline ml-2"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="lg:col-span-1">
          {clientSecret && stripePromise && (
            <Elements options={options} stripe={stripePromise}>
              <CheckoutForm websiteId={websiteData.website_id} />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
};

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
// frontend/src/components/builder/PublicCanvas.tsx

const GatedContent: React.FC<{
  elementProps: any;
  children: React.ReactNode;
  isLoggedIn: boolean;
  websiteData: PublicWebsiteData;
}> = ({ elementProps, children, isLoggedIn, websiteData }) => {
  const [visibility, setVisibility] = useState<
    "loading" | "visible" | "hidden"
  >("loading");
  const [hiddenReason, setHiddenReason] = useState<"auth" | "purchase" | null>(
    null
  );
  const purchaseCacheRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const checkVisibility = async () => {
      const v = elementProps?.visibility || {};

      // Rule: Anonymous Only
      if (v.requiresAnonymous && isLoggedIn) {
        setVisibility("hidden");
        return;
      }

      // Rule: Login Required
      if (v.requiresAuth && !isLoggedIn) {
        setVisibility("hidden");
        return;
      }

      // Helper function to check purchase status & use cache
      const checkPurchase = async (productId: string): Promise<boolean> => {
        const memberId = localStorage.getItem(
          `siteMemberId:${websiteData?.subdomain}`
        );
        if (!isLoggedIn || !memberId) return false;

        const cacheKey = `${memberId}_${productId}`;
        if (typeof purchaseCacheRef.current[cacheKey] !== "undefined") {
          return purchaseCacheRef.current[cacheKey];
        }
        try {
          const params = new URLSearchParams({
            website_id: String(websiteData.website_id),
            member_id: memberId,
            product_id: productId,
          });
          const { data: hasPurchase } = await saasApi.get<boolean>(
            `/users-stripe-account/${
              websiteData.subdomain
            }/has-purchase?${params.toString()}`
          );
          purchaseCacheRef.current[cacheKey] = !!hasPurchase;
          return !!hasPurchase;
        } catch {
          purchaseCacheRef.current[cacheKey] = false;
          return false;
        }
      };

      // Rule: Must have purchased a product
      if (v.required_product_id) {
        const hasRequiredProduct = await checkPurchase(v.required_product_id);
        if (!hasRequiredProduct) {
          setVisibility("hidden");
          return;
        }
      }

      // ✅ NEW: Rule: Must NOT have purchased a product
      if (v.forbidden_product_id) {
        const hasForbiddenProduct = await checkPurchase(v.forbidden_product_id);
        if (hasForbiddenProduct) {
          setVisibility("hidden");
          return;
        }
      }

      // If no rules hide the content, show it
      setVisibility("visible");
    };

    checkVisibility();
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
    const isContainer =
      elementProps?.padding || elementProps?.display || elementProps?.style;
    if (isContainer) {
      return (
        <div className="border-2 border-dashed rounded-lg p-8 m-4 text-center text-gray-500 bg-gray-50">
          <h4 className="font-semibold">Content Locked</h4>
          <p className="text-sm mt-1">
            This content is not available for your account.
          </p>
        </div>
      );
    }
    return null;
  }
  return <>{children}</>;
};

const MainContent = ({
  currentPage,
  activeCategory,
  setActiveCategory,
  websiteData,
  lastSectionRef,
  renderElement,
  isLoggedIn,
  buildSubsectionStyle,
  addToCart, // ✅ ADD THIS PROP
}: {
  currentPage: Page | undefined;
  activeCategory: string | null;
  setActiveCategory: (id: string | null) => void;
  websiteData: PublicWebsiteData;
  lastSectionRef: React.RefObject<HTMLDivElement | null>;
  renderElement: (element: ElementType) => React.ReactNode;
  isLoggedIn: boolean;
  buildSubsectionStyle: (props: any) => React.CSSProperties;
  addToCart: (item: CartItem) => void; // ✅ DEFINE THE PROP TYPE
}) => {
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
          onAddToCart={addToCart} // ✅ PASS THE PROP DOWNCategoryMenuInCanvas
        />
      </>
    );
  }

  return (
    <GatedContent
      elementProps={currentPage?.properties}
      isLoggedIn={isLoggedIn}
      websiteData={websiteData}
    >
      <div className="space-y-0 flex-1 flex flex-col">
        {currentPage?.sections.map((sec, idx) => {
          const isLast = idx === currentPage.sections.length - 1;
          const p = sec.properties || {};
          const styleProps = p.style || {};
          const rawBg = p.backgroundImage ?? styleProps.backgroundImage;
          let backgroundImage: string | undefined;
          if (typeof rawBg === "string" && rawBg.trim()) {
            backgroundImage = rawBg.startsWith("linear-gradient")
              ? rawBg
              : normalizeBackground(rawBg);
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
            <GatedContent
              key={sec.section_id}
              elementProps={sec.properties}
              isLoggedIn={isLoggedIn}
              websiteData={websiteData}
            >
              <div
                ref={isLast ? lastSectionRef : undefined}
                style={{
                  ...containerStyle,
                  ...(isLast ? { flexGrow: 1 } : {}),
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
                      ...(isLast ? { marginBottom: 0, paddingBottom: 0 } : {}),
                    };
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
                        isLoggedIn={isLoggedIn}
                        websiteData={websiteData}
                      >
                        <motion.div
                          style={subsectionStyle}
                          initial={initial}
                          animate={animate}
                          transition={transition}
                        >
                          {sub.elements.map((el) => (
                            <GatedContent
                              key={el.element_id}
                              elementProps={el.properties}
                              isLoggedIn={isLoggedIn}
                              websiteData={websiteData}
                            >
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
const MenuItemDetails = ({
  item,
  itemExtras,
  itemOptions,
  onAddToCart, // ✅ 1. Accept the handler function as a prop
}: {
  item: MenuItem;
  itemExtras: Extra[];
  itemOptions: PublicOptionGroup[];
  onAddToCart: (item: CartItem) => void; // ✅ 2. Define the prop's type
}) => {
  // State to track which extras are selected (using their IDs)
  // const { addToCart } = useCart();
  const [selectedExtras, setSelectedExtras] = useState(new Set<string>());
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});

  // State to hold the final calculated price
  const [totalPrice, setTotalPrice] = useState(item.base_price);

  useEffect(() => {
    let currentTotal = item.base_price;

    selectedExtras.forEach((extraId) => {
      const extra = itemExtras.find((e) => e.extra_id === extraId);
      if (extra) {
        currentTotal += Number(extra.price); // Ensure price is a number
      }
    });

    Object.values(selectedOptions).forEach((choiceId) => {
      for (const group of itemOptions) {
        const choice = group.choices.find((c) => c.choice_id === choiceId);
        if (choice) {
          currentTotal += Number(choice.price_adjustment); // Ensure price is a number
          break;
        }
      }
    });

    setTotalPrice(currentTotal);
  }, [
    selectedExtras,
    selectedOptions,
    item.base_price,
    itemExtras,
    itemOptions,
  ]);

  // Handler for toggling an extra (checkbox)
  const handleExtraToggle = (extraId: string) => {
    setSelectedExtras((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(extraId)) {
        newSet.delete(extraId);
      } else {
        newSet.add(extraId);
      }
      return newSet;
    });
  };

  // Handler for changing an option (radio button)
  const handleOptionChange = (groupId: string, choiceId: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupId]: choiceId,
    }));
  };
  const handleAddToCartClick = () => {
    // This function creates the item and calls the prop function
    const extrasList = itemExtras.filter((extra) =>
      selectedExtras.has(extra.extra_id)
    );
    const optionsDict: Record<string, string> = {};
    for (const group of itemOptions) {
      const selectedChoiceId = selectedOptions[group.group_id];
      if (selectedChoiceId) {
        const choice = group.choices.find(
          (c) => c.choice_id === selectedChoiceId
        );
        if (choice) optionsDict[group.group_name] = choice.name;
      }
    }
    const cartItem: CartItem = {
      cartItemId: `${item.item_id}-${Date.now()}`,
      itemId: item.item_id,
      name: item.item_name,
      imageUrl: item.image_url,
      quantity: 1,
      unitPrice: totalPrice,
      selectedExtras: extrasList,
      selectedOptions: optionsDict,
    };

    // ✅ 3. Call the function that was passed down from the parent
    onAddToCart(cartItem);
  };

  return (
    <div className="border border-t-0 rounded-b-lg p-4 bg-slate-50 dark:bg-slate-800 space-y-4">
      {/* --- Section for Extras (using checkboxes) --- */}
      {itemExtras.length > 0 && (
        <div>
          <h5 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">
            Add Extras:
          </h5>
          <div className="space-y-2">
            {itemExtras.map((extra) => (
              <label
                key={extra.extra_id}
                className="flex justify-between items-center cursor-pointer text-sm"
              >
                <span className="text-slate-700 dark:text-slate-300">
                  {extra.name}
                </span>
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    + ${extra.price.toFixed(2)}
                  </span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    onChange={() => handleExtraToggle(extra.extra_id)}
                    checked={selectedExtras.has(extra.extra_id)}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* --- Section for Options (using radio buttons) --- */}
      {itemOptions.length > 0 && (
        <div className="space-y-4">
          {itemOptions.map((group) => (
            <div key={group.group_id}>
              <h5 className="font-semibold text-slate-800 dark:text-slate-200">
                {group.group_name}
              </h5>
              <div className="mt-2 space-y-2">
                {group.choices.map((choice) => (
                  <label
                    key={choice.choice_id}
                    className="flex justify-between items-center cursor-pointer text-sm"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      {choice.name}
                    </span>
                    <div className="flex items-center space-x-3">
                      {choice.price_adjustment > 0 && (
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          + ${choice.price_adjustment.toFixed(2)}
                        </span>
                      )}
                      <input
                        type="radio"
                        name={group.group_id} // This groups the radio buttons
                        className="h-5 w-5 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        onChange={() =>
                          handleOptionChange(group.group_id, choice.choice_id)
                        }
                        checked={
                          selectedOptions[group.group_id] === choice.choice_id
                        }
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Total Price Display --- */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4 flex justify-between items-center">
        <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Total:
        </span>
        <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
          ${totalPrice.toFixed(2)}
        </span>
      </div>
      {/* ✅ 4. Add the button and connect it to the new handler */}
      {item.is_shippable && (
        <button
          onClick={handleAddToCartClick}
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700"
        >
          Add to Cart
        </button>
      )}
    </div>
  );
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
  onAddToCart, // ✅ ADD THIS PROP
}: {
  locations: Location[];
  categoryId: string;
  onAddToCart: (item: CartItem) => void; // ✅ DEFINE THE PROP TYPE
}) => {
  const [locationId, setLocationId] = useState(locations[0]?.location_id || "");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [expandedMenuItemId, setExpandedMenuItemId] = useState<string | null>(
    null
  );
  const [extras, setExtras] = useState<Record<string, Extra[]>>({});
  const [options, setOptions] = useState<Record<string, PublicOptionGroup[]>>(
    {}
  );
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    saasApi
      .get<MenuItem[]>(
        `/locations/${locationId}/menu?category_id=${categoryId}`
      )
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  }, [locationId, categoryId]);

  const handleMenuItemClick = async (menuItemId: string) => {
    if (expandedMenuItemId === menuItemId) {
      setExpandedMenuItemId(null);
      return;
    }
    setIsLoadingDetails(true);
    setExpandedMenuItemId(menuItemId);
    try {
      const [extrasResponse, optionsResponse] = await Promise.all([
        api.get<Extra[]>(`/menu-item-extras/extras-for-item/${menuItemId}`),
        api.get<PublicOptionGroup[]>(
          `/menu-item-options/options-for-item/${menuItemId}`
        ),
      ]);
      setExtras((prev) => ({ ...prev, [menuItemId]: extrasResponse.data }));
      setOptions((prev) => ({ ...prev, [menuItemId]: optionsResponse.data }));
    } catch (error) {
      console.error("Failed to fetch item details:", error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  return (
    <div className="p-4">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const isExpanded = expandedMenuItemId === item.item_id;
          const itemExtras = extras[item.item_id] || [];
          const itemOptions = options[item.item_id] || [];

          return (
            <div key={item.item_id}>
              {/* Main Card */}
              <div
                onClick={() => handleMenuItemClick(item.item_id)}
                className="border rounded-lg bg-white shadow hover:shadow-lg transition overflow-hidden cursor-pointer"
                style={{ maxWidth: 280 }}
              >
                <div className="w-full aspect-[4/3] overflow-hidden">
                  <img
                    src={resolveImageSrc(item.image_url)}
                    alt={item.item_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-base mb-1">
                    {item.item_name}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">
                    {item.description}
                  </p>
                  <p className="font-medium">
                    ${Number(item.base_price).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Expandable Details Section */}
              <div
                className={`transition-all duration-500 ease-in-out overflow-hidden ${
                  isExpanded ? "max-h-[1000px]" : "max-h-0"
                }`}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  {/* ✅ IMPROVEMENT: Only show loading for the currently expanding item */}
                  {isLoadingDetails && isExpanded ? (
                    <div className="border border-t-0 rounded-b-lg p-4 bg-slate-50">
                      <p className="text-sm text-slate-500">
                        Loading details...
                      </p>
                    </div>
                  ) : (
                    <MenuItemDetails
                      // ✅ FIX: Pass the entire 'item' object
                      item={item}
                      itemExtras={itemExtras}
                      itemOptions={itemOptions}
                      onAddToCart={onAddToCart} // ✅ PASS THE PROP DOWN
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
  const { cartCount, addToCart } = useCart(); // ✅ Get addToCart from the hook here

  const [currentView, setCurrentView] = useState("page"); // 'page' or 'cart'
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

  const NavBar = ({ cartCount }: { cartCount: number }) => {
    // ✅ Get the live cart count from the context

    // --- Existing state and variables ---
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

    // --- Logic to filter nav items (unchanged) ---
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

    // --- Helper functions (unchanged) ---
    const normalizePath = (raw = "") => {
      const u = raw.trim();
      if (!u || u === "#") return "/";
      if (/^https?:\/\//i.test(u)) return u;
      return u.startsWith("/") ? u : `/${u}`;
    };

    // ✅ NEW: Click handler for the cart icon
    const handleCartClick = () => {
      setMenuOpen(false);
      setCurrentView("cart"); // This switches the view inside PublicCanvas
    };

    const renderNavItem = (ni: NavbarItem) => {
      const raw = (ni.link_url || "").trim();
      const lower = raw.toLowerCase();

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
      const href = isExternal ? normalized : `${base}${normalized}`;

      const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
        setMenuOpen(false);
        if (isExternal) return;
        e.preventDefault();
        setActiveCategory(null);
        setCurrentView("page"); // Ensure we switch back to page view on nav clicks
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

    return (
      <nav
        ref={navRef}
        style={websiteData.navbar?.properties}
        className="shadow-sm"
      >
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <button
            className="md:hidden text-2xl"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>

          <div className="font-bold text-xl">Your Logo</div>

          <div className="hidden md:flex items-center space-x-4">
            {finalItems.map(renderNavItem)}

            {/* ✅ ADDED: Cart Icon for Desktop */}
            <button onClick={handleCartClick} className="relative p-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden px-4 pb-4 space-y-2 border-t">
            {finalItems.map(renderNavItem)}

            {/* ✅ ADDED: Cart Link for Mobile */}
            <a
              onClick={handleCartClick}
              className="text-sm font-medium hover:underline cursor-pointer"
            >
              Cart ({cartCount})
            </a>
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
      const props = element.properties || {};
      const style = props.style || {};
      const { initial, animate, transition } = getMotionConfig(props.animation);

      return (
        // This outer div no longer needs an onClick, we'll move it down
        <div>
          {/* Main Card - Add the onClick handler here */}
          <div
            onClick={(e) => {
              e.preventDefault();
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
              // ... (Your AI Runner JSX for the card, no changes needed here)
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
              // ... (Your regular card JSX, no changes needed here)
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
                <p className="text-sm text-gray-600 my-2">
                  {props.description}
                </p>
                <p className="font-semibold text-gray-600 text-right">
                  ${props.base_price?.toFixed(2)}
                </p>
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
          </div>

          {/* ✅ FIX: This wrapper div handles the smooth animation */}
          <div
            className={`transition-all duration-500 ease-in-out overflow-hidden ${
              isExpanded ? "max-h-[1000px]" : "max-h-0"
            }`}
          >
            {/* The stopPropagation click handler is still needed here */}
            <div onClick={(e) => e.stopPropagation()}>
              {isLoadingDetails ? (
                <div className="border border-t-0 rounded-b-lg p-4 bg-slate-50">
                  <p className="text-sm text-slate-500">Loading details...</p>
                </div>
              ) : (
                <MenuItemDetails
                  // ✅ FIX: Pass the entire 'props' object as the 'item' prop
                  item={props as MenuItem}
                  itemExtras={itemExtras}
                  itemOptions={itemOptions}
                  onAddToCart={addToCart} // ✅ Pass the function down
                />
              )}
            </div>
          </div>
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
      {/* ✅ FIX: Pass cartCount as a prop to the NavBar */}
      <NavBar cartCount={cartCount} />

      {currentView === "page" ? (
        <MainContent
          currentPage={currentPage}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          websiteData={websiteData}
          lastSectionRef={lastSectionRef}
          renderElement={renderElement}
          isLoggedIn={isLoggedIn}
          buildSubsectionStyle={buildSubsectionStyle}
          addToCart={addToCart}
        />
      ) : (
        <CartView websiteData={websiteData} setCurrentView={setCurrentView} />
      )}
    </div>
  );
};

export default PublicCanvas;
