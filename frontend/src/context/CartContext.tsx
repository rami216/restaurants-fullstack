"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { Extra } from "@/components/builder/Properties"; // Adjust this import path if needed

/**
 * Defines the shape of a single item within the shopping cart.
 */
export interface CartItem {
  cartItemId: string; // A unique ID for this instance in the cart (e.g., 'item_id-timestamp')
  itemId: string; // The original ID of the menu item
  name: string;
  unitPrice: number; // The calculated price for one unit, including options/extras
  quantity: number;
  imageUrl?: string;
  selectedExtras: Extra[];
  selectedOptions: Record<string, string>; // e.g., { "Size": "Large" }
}

/**
 * Defines the shape of the context provided to all components.
 */
interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

/**
 * The provider component that wraps your application to make the cart state available everywhere.
 */
export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (newItem: CartItem) => {
    setCart((prevCart) => {
      // Check if an identical item (same ID, extras, and options) is already in the cart
      const existingItemIndex = prevCart.findIndex(
        (item) =>
          item.itemId === newItem.itemId &&
          JSON.stringify(item.selectedExtras) ===
            JSON.stringify(newItem.selectedExtras) &&
          JSON.stringify(item.selectedOptions) ===
            JSON.stringify(newItem.selectedOptions)
      );

      if (existingItemIndex > -1) {
        // If it exists, update the quantity of the existing item
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += newItem.quantity;
        return updatedCart;
      } else {
        // If it's a new, unique item, add it to the cart
        return [...prevCart, newItem];
      }
    });
    alert(`${newItem.name} has been added to your cart!`);
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prevCart) =>
      prevCart.filter((item) => item.cartItemId !== cartItemId)
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  // Calculate the total number of items in the cart
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  // Calculate the total price of all items in the cart
  const cartTotal = cart.reduce((total, item) => {
    return total + item.unitPrice * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

/**
 * A custom hook that provides an easy way to access the cart context.
 */
export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
