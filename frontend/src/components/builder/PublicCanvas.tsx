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
const withUnit = (v: any) =>
  typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v))
    ? `${v}px`
    : v;
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
// At the top of PublicCanvas component, after the imports:
// ✅ DEFINE THIS SEPARATE COMPONENT (Outside PublicCanvas)
const PublicVideoElement = ({ props }: { props: any }) => {
  const { initial, animate, transition } = getMotionConfig(props.animation);
  const cardStyle = props.style || {};
  const titleStyle = props.titleStyle || {};
  const metaStyle = props.metaStyle || {};
  const vidStyle = props.videoStyle || {};

  const src = props.src ? resolveImageSrc(props.src) : "";
  const poster = props.poster ? resolveImageSrc(props.poster) : undefined;

  // ✅ Hooks are allowed here because this is a real Component
  const [isOpen, setIsOpen] = useState(false);
  const isExpandable = !!props.isExpandable;
  const showVideo = !isExpandable || isOpen;

  return (
    <motion.div
      className={`bg-white border rounded-xl shadow overflow-hidden ${
        isExpandable ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""
      }`}
      style={cardStyle}
      initial={initial}
      animate={animate}
      transition={transition}
      onClick={() => isExpandable && setIsOpen(!isOpen)}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex-1">
          <h4 style={titleStyle}>{props.title || "Video title"}</h4>
          <span style={metaStyle}>{props.length || ""}</span>
        </div>
        {isExpandable && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transform transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        )}
      </div>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          showVideo ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 pt-0" onClick={(e) => e.stopPropagation()}>
          <video
            src={src}
            poster={poster}
            controls={Boolean(props.controls)}
            style={vidStyle}
          />
        </div>
      </div>
    </motion.div>
  );
};
const CheckoutForm = ({ websiteId }: { websiteId: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { cartTotal } = useCart();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ✅ 1. Add state to hold the customer's details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    // ✅ 2. Pass the shipping details to Stripe when confirming the payment
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/thank-you`,
        receipt_email: email,
        shipping: {
          name: name,
          address: {
            line1: address, // Stripe requires at least line1 for shipping
          },
          phone: phone,
        },
      },
    });

    if (error.type === "card_error" || error.type === "validation_error") {
      setErrorMessage(error.message || "An unexpected error occurred.");
    } else {
      setErrorMessage("An unexpected error occurred.");
    }
    setIsLoading(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-white p-6 rounded-lg shadow-md"
    >
      <h3 className="text-lg font-semibold">Contact & Shipping</h3>
      <div className="grid grid-cols-1 gap-y-4">
        {/* ✅ 3. Connect the input fields to the state */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
          required
          className="p-3 border rounded-md w-full"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          required
          className="p-3 border rounded-md w-full"
        />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Shipping Address"
          required
          className="p-3 border rounded-md w-full"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
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
  // Data for this product
  const [allExtras, setAllExtras] = React.useState<Extra[]>([]);
  const [allOptions, setAllOptions] = React.useState<PublicOptionGroup[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Selections
  const [editedQuantity, setEditedQuantity] = React.useState<number>(
    item.quantity,
  );
  const [editedExtras, setEditedExtras] = React.useState<Set<string>>(
    new Set(item.selectedExtras.map((e) => e.extra_id)),
  );
  const [editedOptions, setEditedOptions] = React.useState<
    Record<string, string>
  >({});

  // Pricing
  const [basePrice, setBasePrice] = React.useState<number>(0); // inferred
  const [editedUnitPrice, setEditedUnitPrice] = React.useState<number>(
    Number(item.unitPrice || 0),
  );

  const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  // Load only what we can call cross-origin: extras & options (no /menu-items/:id)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [extrasRes, optionsRes] = await Promise.all([
          saasApi.get<Extra[]>(
            `/menu-item-extras/extras-for-item/${item.itemId}`,
          ),
          saasApi.get<PublicOptionGroup[]>(
            `/menu-item-options/options-for-item/${item.itemId}`,
          ),
        ]);
        if (cancelled) return;

        const extras = extrasRes.data ?? [];
        const options = optionsRes.data ?? [];
        setAllExtras(extras);
        setAllOptions(options);

        // Rehydrate options: cart stores names → map to current choice_ids
        const initOptions: Record<string, string> = {};
        for (const group of options) {
          const nameFromCart = item.selectedOptions[group.group_name];
          if (!nameFromCart) continue;
          const choice = group.choices.find((c) => c.name === nameFromCart);
          if (choice) initOptions[group.group_id] = choice.choice_id;
        }
        setEditedOptions(initOptions);

        // Infer base price from cart unitPrice minus current selected adjustments
        const extrasSum = (item.selectedExtras || []).reduce(
          (acc, e: any) => acc + toNum(e.price),
          0,
        );
        let optionsSum = 0;
        for (const group of options) {
          const selName = item.selectedOptions[group.group_name];
          if (!selName) continue;
          const choice = group.choices.find((c) => c.name === selName);
          if (choice) optionsSum += toNum(choice.price_adjustment);
        }
        const inferred = Math.max(
          0,
          toNum(item.unitPrice) - extrasSum - optionsSum,
        );
        setBasePrice(inferred);

        // With inferred base we can compute an authoritative current unit price
        setEditedUnitPrice(inferred + extrasSum + optionsSum);
      } catch (err) {
        console.error("EditableCartItem fetch (extras/options) failed:", err);
        // We can still allow qty edits; price will stick to cart’s current unit price
        setBasePrice(0);
        setEditedUnitPrice(toNum(item.unitPrice));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    item.itemId,
    JSON.stringify(item.selectedOptions),
    JSON.stringify(item.selectedExtras),
    item.unitPrice,
  ]);

  // Recompute unit price whenever user toggles anything
  React.useEffect(() => {
    const extrasSum = Array.from(editedExtras).reduce((acc, id) => {
      const ex = allExtras.find((e) => e.extra_id === id);
      return acc + (ex ? toNum(ex.price) : 0);
    }, 0);

    const optionsSum = Object.entries(editedOptions).reduce(
      (acc, [groupId, choiceId]) => {
        const group = allOptions.find((g) => g.group_id === groupId);
        const choice = group?.choices.find((c) => c.choice_id === choiceId);
        return acc + (choice ? toNum(choice.price_adjustment) : 0);
      },
      0,
    );

    const base = basePrice > 0 ? basePrice : toNum(item.unitPrice); // fallback
    setEditedUnitPrice(base + extrasSum + optionsSum);
  }, [
    editedExtras,
    editedOptions,
    allExtras,
    allOptions,
    basePrice,
    item.unitPrice,
  ]);

  const handleExtraToggle = (extraId: string) =>
    setEditedExtras((prev) => {
      const next = new Set(prev);
      next.has(extraId) ? next.delete(extraId) : next.add(extraId);
      return next;
    });

  const handleOptionChange = (groupId: string, choiceId: string) =>
    setEditedOptions((prev) => ({ ...prev, [groupId]: choiceId }));

  const handleSaveChanges = () => {
    if (isLoading) return;
    // Build updated selections
    const newSelectedExtras = allExtras.filter((e) =>
      editedExtras.has(e.extra_id),
    );
    const newSelectedOptions: Record<string, string> = {};
    allOptions.forEach((group) => {
      const choiceId = editedOptions[group.group_id];
      if (!choiceId) return;
      const choice = group.choices.find((c) => c.choice_id === choiceId);
      if (choice) newSelectedOptions[group.group_name] = choice.name;
    });

    const safeUnit =
      toNum(editedUnitPrice) > 0
        ? toNum(editedUnitPrice)
        : toNum(item.unitPrice);
    onSave(item.cartItemId, {
      quantity: editedQuantity,
      unitPrice: safeUnit,
      selectedExtras: newSelectedExtras,
      selectedOptions: newSelectedOptions,
    });
  };

  if (isLoading)
    return <div className="p-4 text-center">Loading Editor...</div>;

  return (
    <div
      className="p-4 border-2 border-indigo-400 rounded-lg bg-indigo-50 space-y-4"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
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
                  <span>+ ${toNum(extra.price).toFixed(2)}</span>
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
                      {toNum(choice.price_adjustment) > 0 && (
                        <span>
                          + ${toNum(choice.price_adjustment).toFixed(2)}
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
          ${toNum(editedUnitPrice).toFixed(2)}
        </span>
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <button
          onClick={handleSaveChanges}
          disabled={isLoading}
          className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:bg-indigo-300"
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
  const { cart, cartTotal, removeFromCart, updateCartItem, clearCart } =
    useCart();
  const [clientSecret, setClientSecret] = useState("");
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [piError, setPiError] = useState<string | null>(null);

  const [codDetails, setCodDetails] = useState({
    name: "",
    email: "",
    address: "",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize Stripe only if explicitly selected
  useEffect(() => {
    if (websiteData.payment_method === "stripe") {
      saasApi
        .get(
          `/users-stripe-account/public/stripe-key/${websiteData.website_id}`,
        )
        .then((res) => {
          if (res.data.publishableKey) {
            setStripePromise(loadStripe(res.data.publishableKey));
          } else {
            setPiError("Stripe is not configured correctly for this site.");
          }
        })
        .catch(() => setPiError("Failed to connect to the payment provider."));
    }
  }, [websiteData.website_id, websiteData.payment_method]);

  // Create Payment Intent only for Stripe
  useEffect(() => {
    setPiError(null);
    if (cart.length === 0 || websiteData.payment_method !== "stripe") {
      setClientSecret("");
      return;
    }
    saasApi
      .post("/checkout/create-payment-intent", {
        cart,
        website_id: websiteData.website_id,
      })
      .then((res) => setClientSecret(res.data.clientSecret || ""))
      .catch(() =>
        setPiError("Could not initialize checkout. Please try again."),
      );
  }, [cart, websiteData]);

  const handleCodSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await saasApi.post("/checkout/submit-cod-order", {
        cart,
        website_id: websiteData.website_id,
        customer_name: codDetails.name,
        customer_email: codDetails.email,
        shipping_address: codDetails.address,
        customer_phone: codDetails.phone,
      });
      clearCart();
      window.location.href = `/thank-you`;
    } catch {
      alert("Error placing your order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="container mx-auto text-center py-20">
        <h1 className="text-3xl font-bold">Your Cart is Empty</h1>
        <button
          onClick={() => setCurrentView("page")}
          className="text-indigo-600 hover:underline mt-4"
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
        className="text-indigo-600 hover:underline mb-8"
      >
        ← Back to Shop
      </button>
      <h1 className="text-3xl font-bold mb-8">Your Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => {
            const isEditing = editingItemId === item.cartItemId;
            return (
              <div
                key={item.cartItemId}
                className="border p-4 rounded-lg shadow-sm bg-white"
              >
                {isEditing ? (
                  <EditableCartItem
                    item={item}
                    onCancel={() => setEditingItemId(null)}
                    onSave={(id, updates) => {
                      updateCartItem(id, updates);
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
                        {Object.entries(item.selectedOptions).map(([g, c]) => (
                          <p key={g}>
                            <strong>{g}:</strong> {c}
                          </p>
                        ))}
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
                        ${(Number(item.unitPrice) * item.quantity).toFixed(2)}
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
            );
          })}
        </div>

        <div className="lg:col-span-1">
          {/* ✅ UPDATED CONDITIONAL LOGIC */}
          {websiteData.payment_method === "stripe" ? (
            <div className="space-y-4">
              {piError && (
                <div className="p-3 rounded bg-red-50 text-red-600 text-sm">
                  {piError}
                </div>
              )}
              {clientSecret && stripePromise ? (
                <Elements
                  options={{ clientSecret, appearance: { theme: "stripe" } }}
                  stripe={stripePromise}
                  key={clientSecret}
                >
                  <CheckoutForm websiteId={websiteData.website_id} />
                </Elements>
              ) : (
                !piError && (
                  <div className="p-6 border rounded-lg bg-gray-50 text-center text-sm text-gray-600">
                    Initializing Secure Checkout…
                  </div>
                )
              )}
            </div>
          ) : websiteData.payment_method === "cod" ? (
            <form
              onSubmit={handleCodSubmit}
              className="space-y-6 bg-white p-6 rounded-lg shadow-md"
            >
              <h3 className="text-lg font-semibold">Contact & Shipping</h3>
              <p className="text-sm text-gray-600">
                Pay with cash upon delivery.
              </p>
              <div className="grid grid-cols-1 gap-y-4">
                <input
                  type="text"
                  value={codDetails.name}
                  onChange={(e) =>
                    setCodDetails({ ...codDetails, name: e.target.value })
                  }
                  placeholder="Full Name"
                  required
                  className="p-3 border rounded-md"
                />
                <input
                  type="email"
                  value={codDetails.email}
                  onChange={(e) =>
                    setCodDetails({ ...codDetails, email: e.target.value })
                  }
                  placeholder="Email Address"
                  required
                  className="p-3 border rounded-md"
                />
                <input
                  type="text"
                  value={codDetails.address}
                  onChange={(e) =>
                    setCodDetails({ ...codDetails, address: e.target.value })
                  }
                  placeholder="Shipping Address"
                  required
                  className="p-3 border rounded-md"
                />
                <input
                  type="tel"
                  value={codDetails.phone}
                  onChange={(e) =>
                    setCodDetails({ ...codDetails, phone: e.target.value })
                  }
                  placeholder="Phone Number"
                  className="p-3 border rounded-md"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-green-600 text-white font-semibold py-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {isSubmitting ? "Placing Order..." : "Place Order"}
              </button>
            </form>
          ) : (
            /* DEFAULT FALLBACK: Display Only */
            <div className="p-6 border rounded-lg bg-gray-50 text-center space-y-4">
              <h3 className="font-semibold text-lg">Order Summary</h3>
              <p className="text-gray-600 text-sm">
                This store is for display only. Please contact us directly to
                finalize your order.
              </p>
              <div className="text-left border-t pt-4">
                <div className="flex justify-between font-bold text-xl">
                  <span>Total:</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
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

// const GatedContent: React.FC<{
//   elementProps: any;
//   children: React.ReactNode;
//   isLoggedIn: boolean;
//   websiteData: PublicWebsiteData;
//   isPageGate?: boolean; // Prop to identify page-level checks
// }> = ({
//   elementProps,
//   children,
//   isLoggedIn,
//   websiteData,
//   isPageGate = false,
// }) => {
//   const router = useRouter(); // Use the router hook
//   const [visibility, setVisibility] = useState<
//     "loading" | "visible" | "hidden" | "gone"
//   >("loading");
//   const purchaseCacheRef = useRef<Record<string, boolean>>({});

//   useEffect(() => {
//     const checkVisibility = async () => {
//       const v = elementProps?.visibility || {};

//       // Helper for creating the correct redirect path based on domain
//       const getRedirectPath = (slug: string) => {
//         if (typeof window === "undefined") return slug;
//         const isMainHost =
//           window.location.hostname === "zygoflow.com" ||
//           window.location.hostname === "www.zygoflow.com";
//         const base = isMainHost ? `/${websiteData.subdomain}` : "";
//         return `${base}${slug}`;
//       };

//       // --- Rule: Admin Emails Required ---
//       const adminEmails = v.admin_emails || [];
//       if (adminEmails.length > 0) {
//         const currentUserEmail = localStorage.getItem(
//           `siteMemberEmail:${websiteData?.subdomain}`,
//         );
//         if (
//           !isLoggedIn ||
//           !currentUserEmail ||
//           !adminEmails.includes(currentUserEmail)
//         ) {
//           if (isPageGate) {
//             router.push(getRedirectPath("/login")); // Redirect if it's a page gate
//             return;
//           }
//           setVisibility("hidden");
//           return;
//         }
//       }

//       // --- Rule: Login Required (for any member) ---
//       if (v.requiresAuth && !isLoggedIn) {
//         if (isPageGate) {
//           router.push(getRedirectPath("/login")); // Redirect if it's a page gate
//           return;
//         }
//         setVisibility("hidden");
//         return;
//       }

//       // --- Rule: Anonymous Only ---
//       if (v.requiresAnonymous && isLoggedIn) {
//         if (isPageGate) {
//           router.push(getRedirectPath("/")); // Redirect to home if a logged-in user tries to access
//           return;
//         }
//         setVisibility("hidden");
//         return;
//       }

//       // --- Your existing purchase logic remains the same ---
//       const checkPurchase = async (productId: string): Promise<boolean> => {
//         const memberId = localStorage.getItem(
//           `siteMemberId:${websiteData?.subdomain}`,
//         );
//         if (!isLoggedIn || !memberId) return false;
//         const cacheKey = `${memberId}_${productId}`;
//         if (typeof purchaseCacheRef.current[cacheKey] !== "undefined") {
//           return purchaseCacheRef.current[cacheKey];
//         }
//         try {
//           const params = new URLSearchParams({
//             website_id: String(websiteData.website_id),
//             member_id: memberId,
//             product_id: productId,
//           });
//           const { data: hasPurchase } = await saasApi.get<boolean>(
//             `/users-stripe-account/${
//               websiteData.subdomain
//             }/has-purchase?${params.toString()}`,
//           );
//           purchaseCacheRef.current[cacheKey] = !!hasPurchase;
//           return !!hasPurchase;
//         } catch {
//           purchaseCacheRef.current[cacheKey] = false;
//           return false;
//         }
//       };

//       if (v.required_product_id) {
//         const hasRequiredProduct = await checkPurchase(v.required_product_id);
//         if (!hasRequiredProduct) {
//           setVisibility("hidden");
//           return;
//         }
//       }

//       // ✅ 2. HIDE ON PURCHASE (The Button Logic)
//       // If user HAS bought it, we want it GONE, not locked.
//       if (v.forbidden_product_id) {
//         const hasForbiddenProduct = await checkPurchase(v.forbidden_product_id);
//         if (hasForbiddenProduct) {
//           setVisibility("gone");
//           return;
//         }
//       }
//       // ✅ 3. REQUIRE PURCHASE (The Content Logic)
//       // If user HAS NOT bought it, we want it LOCKED.

//       // If no rules hide the content, show it
//       setVisibility("visible");
//     };

//     checkVisibility();
//   }, [
//     JSON.stringify(elementProps?.visibility || {}),
//     isLoggedIn,
//     websiteData?.subdomain,
//     websiteData?.website_id,
//     isPageGate,
//     router,
//   ]);

//   if (visibility === "loading") {
//     return (
//       <div className="p-4 text-center text-gray-400">Loading Content...</div>
//     );
//   }
//   if (visibility === "hidden") {
//     const isContainer =
//       elementProps?.padding || elementProps?.display || elementProps?.style;
//     if (isContainer && !isPageGate) {
//       // Don't show "Content Locked" for a full page, as it's redirecting
//       return (
//         <div className="border-2 border-dashed rounded-lg p-8 m-4 text-center text-gray-500 bg-gray-50">
//           <h4 className="font-semibold">Content Locked</h4>
//           <p className="text-sm mt-1">
//             This content is not available for your account.
//           </p>
//         </div>
//       );
//     }
//     return null;
//   }
//   return <>{children}</>;
// };
const GatedContent: React.FC<{
  elementProps: any;
  children: React.ReactNode;
  isLoggedIn: boolean;
  websiteData: PublicWebsiteData;
  isPageGate?: boolean;
}> = ({
  elementProps,
  children,
  isLoggedIn,
  websiteData,
  isPageGate = false,
}) => {
  const router = useRouter();
  // ✅ 1. Update state type to handle specific hidden reasons
  const [visibility, setVisibility] = useState<
    "loading" | "visible" | "locked" | "gone"
  >("loading");

  const purchaseCacheRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const checkVisibility = async () => {
      const v = elementProps?.visibility || {};

      const getRedirectPath = (slug: string) => {
        if (typeof window === "undefined") return slug;
        const isMainHost =
          window.location.hostname === "zygoflow.com" ||
          window.location.hostname === "www.zygoflow.com";
        const base = isMainHost ? `/${websiteData.subdomain}` : "";
        return `${base}${slug}`;
      };

      // --- Rule: Admin Emails (Security Lock) ---
      const adminEmails = v.admin_emails || [];
      if (adminEmails.length > 0) {
        const currentUserEmail = localStorage.getItem(
          `siteMemberEmail:${websiteData?.subdomain}`,
        );
        if (
          !isLoggedIn ||
          !currentUserEmail ||
          !adminEmails.includes(currentUserEmail)
        ) {
          if (isPageGate) {
            router.push(getRedirectPath("/login"));
            return;
          }
          setVisibility("locked"); // Security = Locked
          return;
        }
      }

      // --- Rule: Login Required (Auth Lock) ---
      if (v.requiresAuth && !isLoggedIn) {
        if (isPageGate) {
          router.push(getRedirectPath("/login"));
          return;
        }
        setVisibility("locked"); // Not logged in = Locked
        return;
      }

      // --- Rule: Anonymous Only (e.g. Login Page) ---
      if (v.requiresAnonymous && isLoggedIn) {
        if (isPageGate) {
          router.push(getRedirectPath("/"));
          return;
        }
        setVisibility("gone"); // Logged in user shouldn't see "Login" button -> Just vanish
        return;
      }

      // --- Helper ---
      const checkPurchase = async (productId: string): Promise<boolean> => {
        const memberId = localStorage.getItem(
          `siteMemberId:${websiteData?.subdomain}`,
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
            }/has-purchase?${params.toString()}`,
          );
          purchaseCacheRef.current[cacheKey] = !!hasPurchase;
          return !!hasPurchase;
        } catch {
          purchaseCacheRef.current[cacheKey] = false;
          return false;
        }
      };

      // ✅ 2. HIDE ON PURCHASE (The Button Logic)
      // If user HAS bought it, we want it GONE, not locked.
      if (v.forbidden_product_id) {
        const hasForbiddenProduct = await checkPurchase(v.forbidden_product_id);
        if (hasForbiddenProduct) {
          setVisibility("gone");
          return;
        }
      }

      // ✅ 3. REQUIRE PURCHASE (The Content Logic)
      // If user HAS NOT bought it, we want it LOCKED.
      if (v.required_product_id) {
        const hasRequiredProduct = await checkPurchase(v.required_product_id);
        if (!hasRequiredProduct) {
          setVisibility("locked");
          return;
        }
      }

      setVisibility("visible");
    };

    checkVisibility();
  }, [
    JSON.stringify(elementProps?.visibility || {}),
    isLoggedIn,
    websiteData?.subdomain,
    websiteData?.website_id,
    isPageGate,
    router,
  ]);

  if (visibility === "loading") {
    return (
      <div className="p-4 text-center text-gray-400">Loading Content...</div>
    );
  }

  // ✅ 4. RENDER "GONE" (Return null)
  if (visibility === "gone") {
    return null;
  }

  // ✅ 5. RENDER "LOCKED" (Show the box)
  if (visibility === "locked") {
    const isContainer =
      elementProps?.padding || elementProps?.display || elementProps?.style;

    // Optional: You can filter this further to only show the box for Sections
    if (isContainer && !isPageGate) {
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
  addToCart,
}: {
  currentPage: Page | undefined;
  activeCategory: string | null;
  setActiveCategory: (id: string | null) => void;
  websiteData: PublicWebsiteData;
  lastSectionRef: React.RefObject<HTMLDivElement | null>;
  renderElement: (element: ElementType) => React.ReactNode;
  isLoggedIn: boolean;
  buildSubsectionStyle: (props: any) => React.CSSProperties;
  addToCart: (item: CartItem) => void;
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
          onAddToCart={addToCart}
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

          // 1. Get the background from the correct source
          const rawBg = p.backgroundImage ?? styleProps.backgroundImage;

          // 2. Normalize it correctly (handling gradients vs images)
          let backgroundImage: string | undefined;
          if (typeof rawBg === "string" && rawBg.trim()) {
            backgroundImage = rawBg.startsWith("linear-gradient")
              ? rawBg
              : normalizeBackground(rawBg);
          }

          const containerStyle: React.CSSProperties = {
            backgroundColor: p.backgroundColor ?? styleProps.backgroundColor,
            padding: p.padding ?? styleProps.padding,
            display: p.display ?? styleProps.display,
            flexDirection: p.flexDirection ?? styleProps.flexDirection,
            justifyContent: p.justifyContent ?? styleProps.justifyContent,
            alignItems: p.alignItems ?? styleProps.alignItems,
            gap: p.gap ?? styleProps.gap,
            ...styleProps,
            ...(backgroundImage ? { backgroundImage } : {}),
            // Ensure image covers the full section
            ...(backgroundImage && backgroundImage.startsWith("url(")
              ? { backgroundSize: "cover", backgroundPosition: "center" }
              : {}),
            ...(isLast ? { marginBottom: 0, paddingBottom: 0 } : {}),
          };

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
                  boxSizing: "border-box", // ✅ Add this
                  width: "100%",
                  maxWidth: "100%",
                  overflow: "visible", // ✅ Change from hidden
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
                    boxSizing: "border-box",
                    maxWidth: "100%",
                    width: "100%", // ✅ ADD THIS
                    overflow: "visible", // ✅ ADD THIS
                  }}
                >
                  {sec.subsections.map((sub) => {
                    const subProps = sub.properties || {};
                    const { initial, animate, transition } = getMotionConfig(
                      subProps.animation,
                    );
                    const subsectionStyle = buildSubsectionStyle(subProps);

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
  element: ElementType;
  isPreview: boolean;
  websiteData: PublicWebsiteData; // ✅ ADD THIS
}

// const AiElementRunner: React.FC<AiElementRunnerProps> = ({
//   element,
//   isPreview,
//   websiteData, // ✅ ADD THIS
// }) => {
//   const { aiPayload } = element;
//   const ref = useRef<HTMLDivElement>(null);

//   useLayoutEffect(() => {
//     if (!aiPayload || !ref.current) return;

//     // ✅ THE FIX: Point to merged properties to handle both new and live elements
//     const processedProps = {
//       ...(aiPayload.properties || {}),
//       ...(element.properties || {}),
//     };

//     for (const key of ["src", "poster", "image_url", "backgroundImage"]) {
//       if (processedProps[key])
//         processedProps[key] = resolveImageSrc(processedProps[key]);
//     }

//     let htmlOnly = (aiPayload.aiTemplate || "").replace(
//       /<script[\s\S]*?<\/script>/g,
//       "",
//     );

//     const templateRegex = /<template id="displayTemplate">[\s\S]*?<\/template>/;
//     const templateMatch = htmlOnly.match(templateRegex);
//     const templateContent = templateMatch ? templateMatch[0] : "";

//     if (templateContent) {
//       htmlOnly = htmlOnly.replace(
//         templateContent,
//         '<div id="displayTemplate-placeholder"></div>',
//       );
//     }

//     // Inject merged data into the Mustache template
//     ref.current.innerHTML = Mustache.render(htmlOnly, processedProps);

//     if (templateContent) {
//       const placeholder = ref.current.querySelector(
//         "#displayTemplate-placeholder",
//       );
//       if (placeholder) {
//         const tempDiv = document.createElement("div");
//         tempDiv.innerHTML = templateContent;
//         const templateElement = tempDiv.firstChild;
//         if (templateElement) placeholder.replaceWith(templateElement);
//       }
//     }

//     if (aiPayload.script) {
//       const jsBody = aiPayload.script
//         .replace(/^\s*<script[^>]*>/, "")
//         .replace(/<\/script>\s*$/, "");
//       try {
//         const schemaId = element.properties?.schema_id;
//         const apiClient = isPreview ? saasApi : api;

//         const fn = new Function(
//           "container",
//           "api",
//           "schemaId",
//           "properties",
//           "Mustache",
//           jsBody,
//         );
//         // ✅ ADD subdomain to properties so AI scripts can access it
//         const propsWithSubdomain = {
//           ...processedProps,
//           subdomain: websiteData.subdomain,
//         };
//         fn(ref.current, apiClient, schemaId, propsWithSubdomain, Mustache); // ✅ USE propsWithSubdomain, not processedProps
//       } catch (jsErr) {
//         console.error("Error running AI script:", jsErr);
//       }
//     }
//   }, [aiPayload, element.properties, isPreview]);

//   return <div ref={ref} />;
// };
interface AiElementRunnerProps {
  element: ElementType;
  isPreview: boolean;
  websiteData: PublicWebsiteData; // ✅ ADD THIS
}

const AiElementRunner: React.FC<AiElementRunnerProps> = ({
  element,
  isPreview,
  websiteData, // ✅ ADD THIS
}) => {
  const { aiPayload } = element;
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!aiPayload || !ref.current) return;

    // ✅ THE FIX: Point to merged properties to handle both new and live elements
    const processedProps = {
      ...(aiPayload.properties || {}),
      ...(element.properties || {}),
    };

    // --- START: SMARTER IMAGE RESOLVER ---
    // 1. Standard keys that always need resolving
    const keysToResolve = new Set([
      "src",
      "poster",
      "image_url",
      "backgroundImage",
    ]);

    // 2. Dynamically add keys from editableProps if they are type 'image'
    if (aiPayload.editableProps) {
      aiPayload.editableProps.forEach((prop: any) => {
        if (prop.type === "image") {
          keysToResolve.add(prop.key);
        }
      });
    }

    // 3. Resolve URLs
    keysToResolve.forEach((key) => {
      if (processedProps[key]) {
        processedProps[key] = resolveImageSrc(processedProps[key]);
      }
    });
    // --- END: SMARTER IMAGE RESOLVER ---

    let htmlOnly = (aiPayload.aiTemplate || "").replace(
      /<script[\s\S]*?<\/script>/g,
      "",
    );

    const templateRegex = /<template id="displayTemplate">[\s\S]*?<\/template>/;
    const templateMatch = htmlOnly.match(templateRegex);
    const templateContent = templateMatch ? templateMatch[0] : "";

    if (templateContent) {
      htmlOnly = htmlOnly.replace(
        templateContent,
        '<div id="displayTemplate-placeholder"></div>',
      );
    }

    // Inject merged data into the Mustache template
    ref.current.innerHTML = Mustache.render(htmlOnly, processedProps);

    if (templateContent) {
      const placeholder = ref.current.querySelector(
        "#displayTemplate-placeholder",
      );
      if (placeholder) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = templateContent;
        const templateElement = tempDiv.firstChild;
        if (templateElement) placeholder.replaceWith(templateElement);
      }
    }

    if (aiPayload.script) {
      const jsBody = aiPayload.script
        .replace(/^\s*<script[^>]*>/, "")
        .replace(/<\/script>\s*$/, "");
      try {
        const schemaId = element.properties?.schema_id;
        const apiClient = isPreview ? saasApi : api;

        const fn = new Function(
          "container",
          "api",
          "schemaId",
          "properties",
          "Mustache",
          jsBody,
        );
        // ✅ ADD subdomain to properties so AI scripts can access it
        const propsWithSubdomain = {
          ...processedProps,
          subdomain: websiteData.subdomain,
        };
        fn(ref.current, apiClient, schemaId, propsWithSubdomain, Mustache); // ✅ USE propsWithSubdomain, not processedProps
      } catch (jsErr) {
        console.error("Error running AI script:", jsErr);
      }
    }
  }, [aiPayload, element.properties, isPreview]);

  return <div ref={ref} />;
};
const MenuItemDetails = ({
  item,
  itemExtras,
  itemOptions,
  onAddToCart,
}: {
  item: MenuItem;
  itemExtras: Extra[];
  itemOptions: PublicOptionGroup[];
  onAddToCart: (item: CartItem) => void;
}) => {
  const [selectedExtras, setSelectedExtras] = useState(new Set<string>());
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [quantity, setQuantity] = useState(1);
  const [totalPrice, setTotalPrice] = useState(Number(item.base_price));

  useEffect(() => {
    let currentTotal = Number(item.base_price);
    selectedExtras.forEach((extraId) => {
      const extra = itemExtras.find((e) => e.extra_id === extraId);
      if (extra) currentTotal += Number(extra.price);
    });
    Object.values(selectedOptions).forEach((choiceId) => {
      for (const group of itemOptions) {
        const choice = group.choices.find((c) => c.choice_id === choiceId);
        if (choice) {
          currentTotal += Number(choice.price_adjustment);
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

  const handleExtraToggle = (extraId: string) => {
    setSelectedExtras((prev) => {
      const newSet = new Set(prev);
      newSet.has(extraId) ? newSet.delete(extraId) : newSet.add(extraId);
      return newSet;
    });
  };

  const handleOptionChange = (groupId: string, choiceId: string) => {
    setSelectedOptions((prev) => ({ ...prev, [groupId]: choiceId }));
  };

  const handleAddToCartClick = () => {
    const extrasList = itemExtras.filter((extra) =>
      selectedExtras.has(extra.extra_id),
    );
    const optionsDict: Record<string, string> = {};
    for (const group of itemOptions) {
      const selectedChoiceId = selectedOptions[group.group_id];
      if (selectedChoiceId) {
        const choice = group.choices.find(
          (c) => c.choice_id === selectedChoiceId,
        );
        if (choice) optionsDict[group.group_name] = choice.name;
      }
    }
    const cartItem: CartItem = {
      cartItemId: `${item.item_id}-${Date.now()}`,
      itemId: item.item_id,
      name: item.item_name,
      imageUrl: item.image_url,
      quantity: quantity,
      unitPrice: totalPrice,
      selectedExtras: extrasList,
      selectedOptions: optionsDict,
    };
    onAddToCart(cartItem);
  };

  return (
    <div className="border border-t-0 rounded-b-lg p-4 bg-slate-50 space-y-4">
      {itemExtras.length > 0 && (
        <div>
          <h5 className="font-semibold mb-2 text-slate-800">Add Extras:</h5>
          <div className="space-y-2">
            {itemExtras.map((extra) => (
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
                    checked={selectedExtras.has(extra.extra_id)}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {itemOptions.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          {itemOptions.map((group) => (
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
                        name={`${item.item_id}-${group.group_id}`}
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

      <div className="border-t pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Quantity:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full bg-gray-200 font-bold"
            >
              -
            </button>
            <span className="font-bold w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-full bg-gray-200 font-bold"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold">Total:</span>
          <span className="text-xl font-bold text-indigo-600">
            ${(totalPrice * quantity).toFixed(2)}
          </span>
        </div>
      </div>

      <button
        onClick={handleAddToCartClick}
        className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700"
      >
        Add to Cart
      </button>
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
    null,
  );
  const [extras, setExtras] = useState<Record<string, Extra[]>>({});
  const [options, setOptions] = useState<Record<string, PublicOptionGroup[]>>(
    {},
  );
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    saasApi
      .get<MenuItem[]>(
        `/locations/${locationId}/menu?category_id=${categoryId}`,
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
          `/menu-item-options/options-for-item/${menuItemId}`,
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
  const [priceRegistry, setPriceRegistry] = useState<Record<string, number>>(
    {},
  );

  const { cartCount, addToCart } = useCart(); // ✅ Get addToCart from the hook here

  const [currentView, setCurrentView] = useState("page"); // 'page' or 'cart'
  const router = useRouter();

  useEffect(() => {
    // Prevent horizontal overflow on mobile
    const style = document.createElement("style");
    style.textContent = `
    body, html {
      overflow-x: hidden;
      max-width: 100vw;
    }
    * {
      box-sizing: border-box;
    }
  `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [currentPage, setCurrentPage] = useState<Page | undefined>(initialPage);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [expandedMenuItemId, setExpandedMenuItemId] = useState<string | null>(
    null,
  );
  const [extras, setExtras] = useState<Record<string, Extra[]>>({});
  const [options, setOptions] = useState<Record<string, PublicOptionGroup[]>>(
    {},
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
              `/menu-item-options/options-for-item/${menuItemId}`,
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

  React.useEffect(() => {
    if (!currentPage) return;
    const usedIds = new Set<string>();
    currentPage.sections.forEach((sec) => {
      sec.subsections.forEach((sub) => {
        sub.elements.forEach((el) => {
          const id =
            el.properties?.item_id || el.aiPayload?.properties?.item_id;
          if (id) usedIds.add(id);
        });
      });
    });

    if (usedIds.size > 0) {
      const idList = Array.from(usedIds).join(",");
      api
        .get(`/menu-items/batch-prices?ids=${idList}`)
        .then((res) => setPriceRegistry(res.data))
        .catch((err) => console.error("Public Sync Error", err));
    }
  }, [currentPage]);
  useEffect(() => {
    // Function to check login status
    const checkAuthStatus = () => {
      if (typeof window !== "undefined") {
        const token = localStorage.getItem(
          `siteToken:${websiteData.subdomain}`,
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
        },
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
      (ni: NavbarItem) =>
        (ni.link_url || "").trim().toLowerCase() === "/logout",
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
          <div className="md:hidden px-4 pb-4 border-t bg-white shadow-lg">
            {/* Use a flex column with a gap for vertical spacing */}
            <div className="flex flex-col space-y-4 pt-4">
              {finalItems.map((ni) => {
                // We wrap the renderNavItem output in a div to ensure
                // it behaves as a block element in our flex column
                return (
                  <div
                    key={ni.item_id}
                    className="w-full pb-2 border-b border-gray-50 last:border-0"
                  >
                    {renderNavItem(ni)}
                  </div>
                );
              })}

              {/* Cart Link for Mobile - Made more prominent */}
              <a
                onClick={handleCartClick}
                className="flex justify-between items-center py-2 px-4 bg-indigo-50 text-indigo-700 rounded-lg font-semibold cursor-pointer"
              >
                <span>View Cart</span>
                <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-xs">
                  {cartCount}
                </span>
              </a>
            </div>
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

  // const buildSubsectionStyle = (subProps: any): React.CSSProperties => {
  //   const userStyle = subProps.style || {};
  //   const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  //   // 1. Define the base layout (Grid or Flex)
  //   const base: React.CSSProperties =
  //     subProps.display === "grid"
  //       ? {
  //           display: "grid",
  //           gap: subProps.gap ?? "1rem",
  //           gridTemplateColumns:
  //             subProps.gridTemplateColumns ??
  //             `repeat(${subProps.gridColumns ?? 2}, 1fr)`,
  //         }
  //       : {
  //           display: "flex",
  //           gap: subProps.gap ?? "1rem",
  //           flexDirection: subProps.flexDirection ?? "column",
  //           justifyContent: subProps.justifyContent ?? "flex-start",
  //           alignItems: subProps.alignItems ?? "stretch",
  //         };

  //   // 2. Build the final style object
  //   const finalStyle: React.CSSProperties = {
  //     ...base,
  //     ...userStyle, // Spread user styles to allow specific overrides (like padding)

  //     // POSITIONING LOGIC (Synchronized with withUnit)
  //     position: userStyle.position || "static",
  //     top: withUnit(userStyle.top),
  //     left: withUnit(userStyle.left),
  //     right: withUnit(userStyle.right),
  //     bottom: withUnit(userStyle.bottom),

  //     // CLIPPING & VISIBILITY
  //     // Match the Builder's p-4 class if no specific padding is set
  //     padding: userStyle.padding || "1rem",
  //     // Crucial: Allow relative items to move outside their box without disappearing
  //     overflow: userStyle.position === "relative" ? "visible" : "hidden",
  //     // Lift relative items above standard layout flow
  //     zIndex: userStyle.position === "relative" ? 50 : "auto",
  //   };

  //   return finalStyle;
  // };
  const buildSubsectionStyle = (subProps: any): React.CSSProperties => {
    const userStyle = subProps.style || {};
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    let base: React.CSSProperties = {};

    if (subProps.display === "grid") {
      base = {
        display: "grid",
        gap: subProps.gap ?? "1.5rem",
        gridTemplateColumns: isMobile
          ? "1fr"
          : (subProps.gridTemplateColumns ??
            `repeat(${subProps.gridColumns ?? 2}, 1fr)`),
      };
    } else {
      base = {
        display: "flex",
        gap: subProps.gap ?? "1.5rem",
        flexDirection: isMobile
          ? "column"
          : (subProps.flexDirection ?? "column"),
        justifyContent: subProps.justifyContent ?? "flex-start",
        alignItems: "stretch",
      };
    }

    const finalStyle: React.CSSProperties = {
      ...base,
      ...userStyle,

      // ✅ CRITICAL MOBILE WIDTH FIXES
      width: isMobile ? "100%" : userStyle.width || "auto",
      maxWidth: isMobile ? "none" : userStyle.maxWidth || "none", // ✅ Changed to "none"
      minWidth: isMobile ? "auto" : "auto", // ✅ Changed to "auto"
      boxSizing: "border-box",

      // POSITIONING
      position: userStyle.position || "static",
      top: withUnit(userStyle.top),
      left: withUnit(userStyle.left),
      right: withUnit(userStyle.right),
      bottom: withUnit(userStyle.bottom),

      // PADDING
      padding: isMobile ? "0.5rem" : userStyle.padding || "1rem", // ✅ Reduced mobile padding

      overflow: "visible", // ✅ Changed from conditional to always visible
      zIndex: userStyle.position === "relative" ? 50 : "auto",
    };

    return finalStyle;
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
    // 1. INITIALIZE
    let props = { ...(element.properties || {}) };

    // 2. LIVE PRICE CHECK
    const itemId = props.item_id || element.aiPayload?.properties?.item_id;
    if (itemId && priceRegistry[itemId] !== undefined) {
      props.base_price = priceRegistry[itemId];
    }

    // 3. YOUR ORIGINAL VARIABLES
    const style = props.style || {};
    const { initial, animate, transition } = getMotionConfig(props.animation);
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
            <AiElementRunner
              element={element}
              isPreview={true} // <-- This is the crucial part
              websiteData={websiteData} // ✅ ADD THIS
            />
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
      // ✅ JUST RETURN THE COMPONENT (No logic/hooks here)
      return <PublicVideoElement props={props} />;
    } else if (effectiveType === "MENU_ITEM") {
      // 1. DATA INITIALIZATION
      let props = { ...(element.properties || {}) };
      const itemId = props.item_id || element.aiPayload?.properties?.item_id;

      // 2. THE LIVE SYNC (Hydration)
      // Ensures the price is pulled from the live database registry
      if (itemId && priceRegistry[itemId] !== undefined) {
        props.base_price = priceRegistry[itemId];
      }

      // 3. VARIABLES
      const isExpanded = expandedMenuItemId === itemId;
      const itemExtras = extras[itemId] || [];
      const itemOptions = options[itemId] || [];
      const style = props.style || {};
      const { initial, animate, transition } = getMotionConfig(props.animation);

      return (
        <div key={element.element_id}>
          {/* Main Clickable Card Container */}
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleMenuItemClick(itemId);
            }}
            role="button"
            className="cursor-pointer"
          >
            {element.element_type === "AI" ? (
              /* ✅ THE FIX: Remove style={style} from this container */
              /* Let the AiElementRunner's internal template handle the design */
              <motion.div
                className="relative"
                initial={initial}
                animate={animate}
                transition={transition}
                style={{}} // 👈 KEEP THIS EMPTY
              >
                <AiElementRunner
                  element={{ ...element, properties: props }}
                  isPreview={false}
                  websiteData={websiteData} // ✅ ADD THIS
                />

                {props.chatEnabled && props.whatsappNumber && (
                  <button
                    type="button"
                    className="absolute bottom-3 right-3 rounded-full p-2 bg-green-500 text-white shadow hover:opacity-90"
                    onClick={(e) => {
                      e.stopPropagation();
                      openWhatsApp(props.whatsappNumber, props.chatMessage);
                    }}
                  >
                    <FaWhatsapp size={20} />
                  </button>
                )}
              </motion.div>
            ) : (
              /* ✅ DESIGN 2: THE STANDARD DESIGN */
              /* Hardcoded white background, border, and shadow */
              <motion.div
                className="relative border rounded-lg p-4 bg-white shadow"
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
                  {props.item_name || "Menu Item"}
                </h4>
                <p className="text-sm text-gray-600 my-2">
                  {props.description || "No description available."}
                </p>
                <p className="font-semibold text-gray-600 text-right">
                  ${Number(props.base_price || 0).toFixed(2)}
                </p>
              </motion.div>
            )}
          </div>

          {/* Expandable Details Section */}
          <div
            className={`transition-all duration-500 ease-in-out overflow-hidden ${
              isExpanded ? "max-h-[1000px]" : "max-h-0"
            }`}
          >
            <div onClick={(e) => e.stopPropagation()}>
              {isLoadingDetails && isExpanded ? (
                <div className="border border-t-0 rounded-b-lg p-4 bg-slate-50">
                  <p className="text-sm text-slate-500">Loading details...</p>
                </div>
              ) : (
                isExpanded && (
                  <MenuItemDetails
                    // Pass hydrated props into the details view
                    item={props as MenuItem}
                    itemExtras={itemExtras}
                    itemOptions={itemOptions}
                    onAddToCart={addToCart}
                  />
                )
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
            element={element}
            isPreview={true} // <-- This is the crucial part
            websiteData={websiteData} // ✅ ADD THIS
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
                    `Hi! I'm interested in ${props.item_name || "this item"}`,
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
      const interObject = props.interactivity || {};
      // 1. Map your DB properties to the format performInteractivity expects
      const compatibleProps = {
        ...props,
        interactivity: {
          // If 'interObject.action' exists (like "link"), use it.
          // Otherwise, fall back to 'action_type'
          action: (
            interObject.action ||
            props.action_type ||
            "none"
          ).toLowerCase(),

          // CRITICAL: Prioritize 'href' from the object over the top-level 'action_value'
          href: interObject.href || props.action_value || "",

          product_id: interObject.product_id || props.product_id || "",
        },
      };

      const handleButtonClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 2. Call your existing function with the mapped data
        performInteractivity(compatibleProps);
      };

      return (
        <motion.button
          key={element.element_id}
          style={style} // Background, borders, etc. from sidebar
          initial={initial}
          animate={animate}
          transition={transition}
          onClick={handleButtonClick}
          className="cursor-pointer hover:opacity-90 transition-all shadow-sm px-6 py-2 rounded-md border-none outline-none"
        >
          {props.text || "Button"}
        </motion.button>
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
      return (
        <motion.div
          style={{
            width: "100%",
            maxWidth: "600px", // ✅ ADD A REASONABLE MAX WIDTH
            margin: "0 auto", // ✅ CENTER IT
            boxSizing: "border-box",
          }}
          initial={initial}
          animate={animate}
          transition={transition}
          className="w-full px-6 py-4 md:px-0" // ✅ Increased mobile padding to px-6
        >
          <FormRenderer element={element} websiteData={websiteData} />
        </motion.div>
      );
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
    <div
      className="bg-white m-0 p-0 w-full flex flex-col min-h-[100svh]"
      style={{
        overflowX: "hidden",
        maxWidth: "100vw",
        boxSizing: "border-box",
      }}
    >
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
