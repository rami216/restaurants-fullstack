"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

const SuccessPage = () => {
  const router = useRouter();

  // This effect will run once when the page loads
  useEffect(() => {
    // Wait for 3 seconds to give the webhook time to process, then redirect.
    const timer = setTimeout(() => {
      router.push("/main"); // Redirect to your main dashboard page
    }, 3000);

    // Cleanup the timer if the user navigates away
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="h-screen flex flex-col items-center justify-center bg-gradient-to-r from-green-400 to-blue-500 text-white text-center p-4">
      <div className="bg-white text-green-600 rounded-full p-4 mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
        Payment Successful!
      </h1>
      <p className="text-lg mb-8">
        Your account has been updated. Redirecting you back to the dashboard...
      </p>
    </main>
  );
};

export default SuccessPage;
