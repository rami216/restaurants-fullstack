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

  const fetchSubscriptionStatus = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/restaurants/has-restaurant");
      if (res.data.has_restaurant) {
        setSubscriptionStatus(res.data.subscription_status);
        setCreditBalance(res.data.credit_balance || 0);
      } else {
        setSubscriptionStatus(null);
        setCreditBalance(0);
      }
    } catch (error) {
      console.error("Failed to fetch subscription status", error);
      setSubscriptionStatus(null);
      setCreditBalance(0);
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
