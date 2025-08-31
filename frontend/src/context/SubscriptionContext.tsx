"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import api from "@/lib/axios";

// Define the shape of the context data
interface SubscriptionContextType {
  subscriptionStatus: string | null;
  creditBalance: number;
  isLoading: boolean;
  fetchSubscriptionStatus: () => Promise<void>;
  storageUsed: number;
  storageLimit: number;
}

// Create the context with a default value
const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

// Create the provider component
export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(
    null
  );
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  // ✅ 2. ADD state for storage usage
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(1_000_000_000); // Default 1GB
  const fetchSubscriptionStatus = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/restaurants/has-restaurant");
      if (res.data.has_restaurant) {
        setSubscriptionStatus(res.data.subscription_status);
        setCreditBalance(res.data.credit_balance || 0);
        // ✅ 3. SET the storage state from the API response
        setStorageUsed(res.data.storage_bytes_used || 0);
        setStorageLimit(res.data.storage_limit_bytes || 1_000_000_000);
      } else {
        setSubscriptionStatus(null);
        setCreditBalance(0);
        setStorageUsed(0);
      }
    } catch (error) {
      console.error("Failed to fetch subscription status", error);
      setSubscriptionStatus(null);
      setCreditBalance(0);
      setStorageUsed(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const value = {
    subscriptionStatus,
    creditBalance,
    isLoading,
    fetchSubscriptionStatus,
    storageUsed,
    storageLimit,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// Create a custom hook for easy access to the context
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider"
    );
  }
  return context;
};
